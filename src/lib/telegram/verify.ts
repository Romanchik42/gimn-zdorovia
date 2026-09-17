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
