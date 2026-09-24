import "server-only";

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Клиент базы можно подменить — этим пользуется проверка check:auth.
 * Живая база для правил о попытках и частоте не нужна, а проверка,
 * которой нужна живая база, не запускается никогда.
 */
type Db = ReturnType<typeof createAdminClient>;

/**
 * Одноразовые коды входа (GIMN-029).
 *
 * Общее ядро для SMS и почты: канал отличается только способом доставки,
 * а правила одни. Правила такие:
 *
 *   код живёт 5 минут — дольше он лежит в чужой ленте уведомлений;
 *   три неверных ввода — и код сгорает, чтобы перебор из тысячи вариантов
 *     не заканчивался успехом;
 *   три запроса в час на один номер — чтобы приложением нельзя было
 *     заваливать человека сообщениями;
 *   минута между запросами — чтобы «отправить ещё раз» не превращалось
 *     в очередь из десяти сообщений.
 *
 * Хранится хэш, а не код: таблица с кодами в открытом виде — это список
 * готовых ключей от чужих аккаунтов на пять минут вперёд.
 */

export const CODE_TTL_MIN = 5;
export const MAX_ATTEMPTS = 3;
export const MAX_REQUESTS_PER_HOUR = 3;
export const RESEND_COOLDOWN_SEC = 60;

export type OtpChannel = "sms" | "email";

/**
 * Телефон к единому виду: +7XXXXXXXXXX.
 *
 * Люди пишут номер как привыкли — «8 (999) 123-45-67», «+7 999 1234567».
 * Без приведения один и тот же человек выглядел бы тремя разными, и ни
 * ограничение по частоте, ни поиск профиля не работали бы.
 */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("7") || digits.startsWith("8"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  // Иностранный номер: принимаем как есть, если он похож на номер.
  if (digits.length >= 11 && digits.length <= 15 && raw.trim().startsWith("+")) {
    return `+${digits}`;
  }
  return null;
}

export function normalizeEmail(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? value : null;
}

export function normalizeIdentifier(channel: OtpChannel, raw: string): string | null {
  return channel === "sms" ? normalizePhone(raw) : normalizeEmail(raw);
}

/**
 * Показ номера в тексте: +7 999 ***-45-67. Полный номер в интерфейсе не
 * нужен — человек и так знает свой, а вот подтверждение «код ушёл туда,
 * куда вы просили» нужно.
 */
export function maskIdentifier(channel: OtpChannel, value: string): string {
  if (channel === "sms") {
    return value.length > 6 ? `${value.slice(0, 5)}***${value.slice(-4)}` : value;
  }
  const [name, domain] = value.split("@");
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

/** Шесть цифр из криптостойкого источника: Math.random здесь не годится. */
function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString("hex");
}

function storeValue(code: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${hashCode(code, salt)}`;
}

/** Сравнение постоянного времени: по скорости ответа код подобрать нельзя. */
function codeMatches(code: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = hashCode(code, salt);
  const a = Buffer.from(actual, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type IssueResult =
  | { ok: true; id: string; code: string; expiresAt: string }
  | { ok: false; error: string; status: number };

/**
 * Выдаёт код и записывает его хэш. Сам код возвращается ВЫЗЫВАЮЩЕМУ, чтобы
 * тот отправил его в SMS или письмом, и больше нигде не появляется — ни в
 * ответе браузеру, ни в логах.
 */
export async function issueCode(
  channel: OtpChannel,
  identifier: string,
  client?: Db,
): Promise<IssueResult> {
  const admin = client ?? createAdminClient();

  // Просроченные чистим по ходу дела: отдельный крон ради одной таблицы
  // — лишняя движущаяся часть, а строки эти никому не нужны уже через
  // пять минут после создания.
  await admin.from("auth_otp").delete().lt("expires_at", new Date().toISOString());

  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { data: recent, error: recentError } = await admin
    .from("auth_otp")
    .select("created_at")
    .eq("identifier", identifier)
    .gte("created_at", hourAgo)
    .order("created_at", { ascending: false });

  if (recentError) {
    console.error("otp: history read failed", recentError.message);
    return { ok: false, error: "Не удалось отправить код. Попробуйте позже.", status: 500 };
  }

  const history = recent ?? [];
  if (history.length >= MAX_REQUESTS_PER_HOUR) {
    return {
      ok: false,
      error: "Слишком много запросов. Попробуйте через час или войдите через Telegram.",
      status: 429,
    };
  }

  const last = history[0]?.created_at;
  if (last) {
    const sinceSec = (Date.now() - new Date(last).getTime()) / 1000;
    if (sinceSec < RESEND_COOLDOWN_SEC) {
      const wait = Math.ceil(RESEND_COOLDOWN_SEC - sinceSec);
      return { ok: false, error: `Код уже отправлен. Повторить можно через ${wait} сек.`, status: 429 };
    }
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString();

  const { data, error } = await admin
    .from("auth_otp")
    .insert({
      identifier,
      channel,
      code_hash: storeValue(code),
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("otp: insert failed", error?.message);
    return { ok: false, error: "Не удалось отправить код. Попробуйте позже.", status: 500 };
  }

  return { ok: true, id: data.id, code, expiresAt };
}

/**
 * Снимает выданный код. Нужен, когда отправка не удалась: иначе строка
 * осталась бы висеть, съела бы одну из трёх попыток в час и заставила бы
 * человека минуту ждать повтора — из-за сбоя, к которому он непричастен.
 */
export async function revokeCode(id: string, client?: Db): Promise<void> {
  const admin = client ?? createAdminClient();
  const { error } = await admin.from("auth_otp").delete().eq("id", id);
  if (error) console.error("otp: revoke failed", error.message);
}

export type CheckResult = { ok: true } | { ok: false; error: string; status: number };

/**
 * Проверяет код. При успехе строка удаляется — код одноразовый и второй
 * попытки входа по нему быть не должно.
 */
export async function checkCode(
  channel: OtpChannel,
  identifier: string,
  code: string,
  client?: Db,
): Promise<CheckResult> {
  const admin = client ?? createAdminClient();

  const { data: row, error } = await admin
    .from("auth_otp")
    .select("id, code_hash, attempts, expires_at")
    .eq("identifier", identifier)
    .eq("channel", channel)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("otp: read failed", error.message);
    return { ok: false, error: "Не удалось проверить код", status: 500 };
  }

  if (!row) {
    return { ok: false, error: "Код не найден или истёк. Запросите новый.", status: 400 };
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await admin.from("auth_otp").delete().eq("id", row.id);
    return { ok: false, error: "Слишком много попыток. Запросите новый код.", status: 429 };
  }

  if (!codeMatches(code, row.code_hash)) {
    const left = MAX_ATTEMPTS - row.attempts - 1;
    await admin
      .from("auth_otp")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return {
      ok: false,
      error: left > 0 ? `Неверный код. Осталось попыток: ${left}.` : "Неверный код. Запросите новый.",
      status: 400,
    };
  }

  await admin.from("auth_otp").delete().eq("id", row.id);
  return { ok: true };
}
