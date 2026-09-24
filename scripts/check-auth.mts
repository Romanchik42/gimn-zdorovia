/**
 * Проверка входа по одноразовому коду (GIMN-029).
 *
 * Здесь проверяются обещания, которые держат чужой аккаунт закрытым:
 *
 *   код одноразовый — второй вход по тому же коду невозможен;
 *   три неверных ввода сжигают код — иначе тысячу вариантов перебирают
 *     за минуту, и шесть цифр перестают что-либо значить;
 *   просроченный код не подходит;
 *   в базе лежит хэш, а не код — утечка таблицы не должна быть списком
 *     готовых ключей;
 *   три запроса в час и минута между ними — чтобы приложением нельзя
 *     было заваливать человека сообщениями за наш счёт.
 *
 * Клиент базы поддельный: живая база для этих правил не нужна, а проверка,
 * которой нужна живая база, не запускается никогда.
 *
 * Запуск: npm run check:auth
 */
import {
  CODE_TTL_MIN,
  MAX_ATTEMPTS,
  MAX_REQUESTS_PER_HOUR,
  RESEND_COOLDOWN_SEC,
  checkCode,
  issueCode,
  maskIdentifier,
  normalizeEmail,
  normalizeIdentifier,
  normalizePhone,
  revokeCode,
} from "@/lib/auth/otp";

/* ------------------------- поддельный клиент базы ------------------------- */

type OtpRow = {
  id: string;
  identifier: string;
  channel: string;
  code_hash: string;
  attempts: number;
  expires_at: string;
  created_at: string;
};

type Filter = (row: OtpRow) => boolean;

function fakeDb() {
  const rows: OtpRow[] = [];
  let seq = 0;

  function builder(kind: "select" | "delete" | "update", patch?: Partial<OtpRow>) {
    const filters: Filter[] = [];
    let sortKey: keyof OtpRow | null = null;
    let ascending = true;
    let max = Infinity;

    const api = {
      eq(col: keyof OtpRow, value: unknown) {
        filters.push((r) => r[col] === value);
        return api;
      },
      gt(col: keyof OtpRow, value: string) {
        filters.push((r) => String(r[col]) > value);
        return api;
      },
      gte(col: keyof OtpRow, value: string) {
        filters.push((r) => String(r[col]) >= value);
        return api;
      },
      lt(col: keyof OtpRow, value: string) {
        filters.push((r) => String(r[col]) < value);
        return api;
      },
      order(col: keyof OtpRow, opts?: { ascending?: boolean }) {
        sortKey = col;
        ascending = opts?.ascending ?? true;
        return api;
      },
      limit(n: number) {
        max = n;
        return api;
      },
      matched(): OtpRow[] {
        let found = rows.filter((r) => filters.every((f) => f(r)));
        if (sortKey) {
          const key = sortKey;
          found = [...found].sort((a, b) =>
            ascending ? String(a[key]).localeCompare(String(b[key])) : String(b[key]).localeCompare(String(a[key])),
          );
        }
        return found.slice(0, max);
      },
      run() {
        const found = api.matched();
        if (kind === "delete") {
          for (const row of found) {
            const at = rows.indexOf(row);
            if (at >= 0) rows.splice(at, 1);
          }
          return { data: null, error: null };
        }
        if (kind === "update") {
          for (const row of found) Object.assign(row, patch);
          return { data: null, error: null };
        }
        return { data: found, error: null };
      },
      maybeSingle() {
        const found = api.matched();
        return Promise.resolve({ data: found[0] ?? null, error: null });
      },
      then(resolve: (value: { data: OtpRow[] | null; error: null }) => unknown) {
        return Promise.resolve(api.run()).then(resolve);
      },
    };
    return api;
  }

  const client = {
    from() {
      return {
        select() {
          return builder("select");
        },
        delete() {
          return builder("delete");
        },
        update(patch: Partial<OtpRow>) {
          return builder("update", patch);
        },
        insert(row: Omit<OtpRow, "id" | "attempts" | "created_at">) {
          seq += 1;
          const full: OtpRow = {
            id: `otp-${seq}`,
            attempts: 0,
            created_at: new Date().toISOString(),
            ...row,
          };
          rows.push(full);
          return {
            select() {
              return {
                single: () => Promise.resolve({ data: { id: full.id }, error: null }),
              };
            },
          };
        },
      };
    },
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, rows };
}

/* -------------------------------- проверки -------------------------------- */

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const PHONE = "+79991234567";

console.log("Пороги:");
{
  // Числами, а не через сами константы. Проверка «после MAX_ATTEMPTS
  // промахов код сгорает» верна при любом MAX_ATTEMPTS — вместе с порогом
  // сдвигается и цикл. А поднятый порог здесь означает, что шесть цифр
  // можно перебирать дольше, то есть чужой аккаунт становится дешевле.
  check(`попыток ввода ${MAX_ATTEMPTS}`, MAX_ATTEMPTS === 3, String(MAX_ATTEMPTS));
  check(`запросов в час ${MAX_REQUESTS_PER_HOUR}`, MAX_REQUESTS_PER_HOUR === 3, String(MAX_REQUESTS_PER_HOUR));
  check(`пауза между запросами ${RESEND_COOLDOWN_SEC} сек`, RESEND_COOLDOWN_SEC === 60, String(RESEND_COOLDOWN_SEC));
  check(`код живёт ${CODE_TTL_MIN} минут`, CODE_TTL_MIN === 5, String(CODE_TTL_MIN));
}

console.log("\nПриведение номера и адреса:");
{
  check("восьмёрка становится семёркой", normalizePhone("8 (999) 123-45-67") === PHONE, String(normalizePhone("8 (999) 123-45-67")));
  check("плюс семь как есть", normalizePhone("+7 999 1234567") === PHONE);
  check("десять цифр без кода страны", normalizePhone("9991234567") === PHONE);
  check("все три записи дают один номер — иначе ограничения обходятся сменой формата",
    new Set([normalizePhone("8 999 123 45 67"), normalizePhone("+79991234567"), normalizePhone("9991234567")]).size === 1);
  check("мусор отклонён", normalizePhone("123") === null && normalizePhone("телефон") === null);
  check("иностранный номер с плюсом принят", normalizePhone("+441234567890") === "+441234567890");

  check("почта в нижнем регистре", normalizeEmail("  Ivan@Example.RU ") === "ivan@example.ru");
  check("адрес без собачки отклонён", normalizeEmail("ivan.example.ru") === null);
  check("адрес без домена отклонён", normalizeEmail("ivan@example") === null);
  check("канал выбирает нужное приведение", normalizeIdentifier("sms", "89991234567") === PHONE);
}

console.log("\nПоказ идентификатора:");
{
  const masked = maskIdentifier("sms", PHONE);
  check("середина номера скрыта", !masked.includes("9123"), masked);
  check("последние цифры видны — по ним человек узнаёт свой номер", masked.endsWith("4567"), masked);
  const email = maskIdentifier("email", "ivanov@example.ru");
  check("имя ящика скрыто, домен виден", email.startsWith("iv") && email.endsWith("@example.ru"), email);
}

console.log("\nКод в базе:");
{
  const db = fakeDb();
  const issued = await issueCode("sms", PHONE, db.client);
  check("код выдан", issued.ok);
  if (issued.ok) {
    check("шесть цифр", /^\d{6}$/.test(issued.code), issued.code);
    const stored = db.rows[0].code_hash;
    check("в базе не сам код", !stored.includes(issued.code), stored.slice(0, 20));
    check("в базе соль и хэш", stored.split(":").length === 2);
  }

  // Второй код тому же человеку — после снятия ограничения по частоте.
  db.rows[0].created_at = new Date(Date.now() - 10 * 60_000).toISOString();
  const second = await issueCode("sms", PHONE, db.client);
  check("разные выдачи дают разные хэши даже при совпадении цифр",
    second.ok && db.rows[0].code_hash !== db.rows[1].code_hash);
}

console.log("\nОдноразовость и перебор:");
{
  const db = fakeDb();
  const issued = await issueCode("sms", PHONE, db.client);
  if (!issued.ok) throw new Error("код не выдан");

  const wrong = issued.code === "000000" ? "111111" : "000000";

  const first = await checkCode("sms", PHONE, wrong, db.client);
  check("неверный код отклонён", !first.ok);
  check("попытка засчитана", db.rows[0].attempts === 1, String(db.rows[0].attempts));
  check("сказано, сколько осталось", !first.ok && first.error.includes("Осталось"), !first.ok ? first.error : "");

  for (let i = 1; i < MAX_ATTEMPTS; i++) await checkCode("sms", PHONE, wrong, db.client);
  const burned = await checkCode("sms", PHONE, issued.code, db.client);
  check(`после ${MAX_ATTEMPTS} промахов не подходит даже верный код`, !burned.ok, burned.ok ? "вошёл" : burned.error);
  check("сгоревшая строка удалена", db.rows.length === 0, String(db.rows.length));
}

{
  const db = fakeDb();
  const issued = await issueCode("email", "ivan@example.ru", db.client);
  if (!issued.ok) throw new Error("код не выдан");

  const ok1 = await checkCode("email", "ivan@example.ru", issued.code, db.client);
  check("верный код пускает", ok1.ok);
  check("строка погашена", db.rows.length === 0);

  const ok2 = await checkCode("email", "ivan@example.ru", issued.code, db.client);
  check("тот же код второй раз не пускает", !ok2.ok, ok2.ok ? "вошёл повторно" : ok2.error);
}

console.log("\nСрок годности:");
{
  const db = fakeDb();
  const issued = await issueCode("sms", PHONE, db.client);
  if (!issued.ok) throw new Error("код не выдан");

  db.rows[0].expires_at = new Date(Date.now() - 1000).toISOString();
  const expired = await checkCode("sms", PHONE, issued.code, db.client);
  check("просроченный код не подходит", !expired.ok, expired.ok ? "вошёл" : expired.error);

  db.rows[0].expires_at = new Date(Date.now() + 60_000).toISOString();
  const fresh = await checkCode("sms", PHONE, issued.code, db.client);
  check("тот же код в срок подходит — значит режет именно срок", fresh.ok);
}

console.log("\nЧастота запросов:");
{
  const db = fakeDb();
  const ages = [30, 20, 10]; // минут назад
  for (const minutes of ages) {
    const r = await issueCode("sms", PHONE, db.client);
    if (!r.ok) throw new Error(`отказ на ${minutes}-й минуте: ${r.error}`);
    db.rows[db.rows.length - 1].created_at = new Date(Date.now() - minutes * 60_000).toISOString();
  }
  const fourth = await issueCode("sms", PHONE, db.client);
  check(`четвёртый запрос за час отклонён (порог ${MAX_REQUESTS_PER_HOUR})`, !fourth.ok, fourth.ok ? "выдан" : fourth.error);
  check("и это 429, а не ошибка сервера", !fourth.ok && fourth.status === 429, !fourth.ok ? String(fourth.status) : "");

  // Тот же человек час спустя — снова можно.
  for (const row of db.rows) row.created_at = new Date(Date.now() - 2 * 3_600_000).toISOString();
  const later = await issueCode("sms", PHONE, db.client);
  check("через час запрет снят — значит считается именно час", later.ok, later.ok ? "" : later.error);

  // Другому человеку запрет не мешает.
  const other = await issueCode("sms", "+79990000000", db.client);
  check("чужой номер не заблокирован", other.ok);
}

console.log("\nПовторная отправка:");
{
  const db = fakeDb();
  const first = await issueCode("sms", PHONE, db.client);
  check("первый код выдан", first.ok);

  const immediate = await issueCode("sms", PHONE, db.client);
  check(`сразу повторить нельзя (${RESEND_COOLDOWN_SEC} сек)`, !immediate.ok, immediate.ok ? "выдан" : immediate.error);
  check("в отказе сказано, сколько ждать", !immediate.ok && /\d+ сек/.test(immediate.error));

  db.rows[0].created_at = new Date(Date.now() - (RESEND_COOLDOWN_SEC + 5) * 1000).toISOString();
  const after = await issueCode("sms", PHONE, db.client);
  check("после паузы можно — значит режет именно пауза", after.ok, after.ok ? "" : after.error);
}

console.log("\nСнятие невыданного кода:");
{
  const db = fakeDb();
  const issued = await issueCode("sms", PHONE, db.client);
  if (!issued.ok) throw new Error("код не выдан");

  // Так поступает роут, когда провайдер не смог отправить сообщение.
  await revokeCode(issued.id, db.client);
  check("строка удалена", db.rows.length === 0);

  const retry = await issueCode("sms", PHONE, db.client);
  check("сбой отправки не съедает попытку и не заставляет ждать", retry.ok, retry.ok ? "" : retry.error);
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
