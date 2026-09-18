import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { serverEnv } from "@/lib/env";

/**
 * Привязка Telegram к аккаунту, созданному по email.
 *
 * Без неё напоминания и отчёты (они ходят только в Telegram) никогда не
 * дошли бы до тех, кто регистрировался почтой. Ссылка t.me/<бот>?start=<payload>
 * несёт id пользователя и подпись HMAC — таблица токенов не нужна, а подделать
 * привязку чужого аккаунта нельзя без bot token.
 *
 * Формат payload: "L" + 32 hex (uuid без дефисов) + 12 hex подписи = 45 символов
 * (Telegram разрешает до 64, только [A-Za-z0-9_-]).
 */

const PREFIX = "L";
const SIG_LENGTH = 12;

function sign(hex: string): string {
  return createHmac("sha256", serverEnv().TELEGRAM_BOT_TOKEN)
    .update(`tg-link:${hex}`)
    .digest("hex")
    .slice(0, SIG_LENGTH);
}

export function linkPayload(userId: string): string {
  const hex = userId.replace(/-/g, "").toLowerCase();
  return `${PREFIX}${hex}${sign(hex)}`;
}

export function linkUrl(userId: string): string {
  const bot = serverEnv().TELEGRAM_BOT_USERNAME;
  return `https://t.me/${bot}?start=${linkPayload(userId)}`;
}

/** Возвращает user_id, если payload — подлинная ссылка привязки, иначе null. */
export function parseLinkPayload(payload: string): string | null {
  const match = /^L([0-9a-f]{32})([0-9a-f]{12})$/.exec(payload);
  if (!match) return null;

  const [, hex, sig] = match;
  const expected = Buffer.from(sign(hex));
  const received = Buffer.from(sig);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
