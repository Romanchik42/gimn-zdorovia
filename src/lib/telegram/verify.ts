import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Проверка подписи Telegram Login Widget (SPEC 3.1).
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * Схема: secret = SHA256(bot_token); ожидаемый hash = HMAC_SHA256(data_check_string, secret).
 * data_check_string — все поля кроме hash, отсортированы по ключу, склеены "\n".
 */

export type TelegramLoginPayload = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/** Больше суток — считаем подпись протухшей. */
const MAX_AUTH_AGE_SEC = 86_400;

export function verifyTelegramLogin(
  payload: TelegramLoginPayload,
  botToken: string,
): { ok: true } | { ok: false; reason: string } {
  const { hash, ...fields } = payload;

  if (!hash) return { ok: false, reason: "нет hash" };

  const dataCheckString = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  // Длины обязаны совпасть до timingSafeEqual — иначе он бросает.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "подпись не совпала" };
  }

  const ageSec = Math.floor(Date.now() / 1000) - payload.auth_date;
  if (ageSec > MAX_AUTH_AGE_SEC) {
    return { ok: false, reason: "данные авторизации устарели" };
  }

  return { ok: true };
}

export type WebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

/**
 * Проверка initData Telegram Web App — приложение, открытое кнопкой из бота.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Отличие от виджета входа — в ключе: secret = HMAC_SHA256(key="WebAppData", bot_token).
 * data_check_string — все поля кроме hash (включая signature), отсортированы
 * по ключу, «ключ=значение», склеены "\n"; значения — уже раскодированные.
 */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
): { ok: true; user: WebAppUser } | { ok: false; reason: string } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "нет hash" };

  const dataCheckString = [...params.entries()]
    .filter(([k]) => k !== "hash")
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");

  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "подпись не совпала" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > MAX_AUTH_AGE_SEC) {
    return { ok: false, reason: "данные авторизации устарели" };
  }

  let user: WebAppUser;
  try {
    user = JSON.parse(params.get("user") ?? "") as WebAppUser;
  } catch {
    return { ok: false, reason: "нет данных пользователя" };
  }
  if (!Number.isInteger(user?.id) || user.id <= 0) return { ok: false, reason: "нет данных пользователя" };

  return { ok: true, user };
}

/**
 * Сверка secret_token вебхука (SPEC 5.11).
 * Telegram присылает его в заголовке X-Telegram-Bot-Api-Secret-Token.
 */
export function verifyWebhookSecret(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
