import "server-only";

import { serverEnv } from "@/lib/env";

/**
 * Тонкий клиент Telegram Bot API.
 *
 * parse_mode НЕ используем нигде (SPEC 5.8): текст уходит как есть, поэтому
 * имя пользователя или название блюда со звёздочками и скобками не может
 * сломать разметку или внедрить ссылку.
 */

const API = "https://api.telegram.org";

export type InlineButton = { text: string; url: string };

type TelegramResult = { ok: boolean; description?: string; error_code?: number };

function endpoint(method: string): string {
  return `${API}/bot${serverEnv().TELEGRAM_BOT_TOKEN}/${method}`;
}

function keyboard(buttons?: InlineButton[][]) {
  return buttons?.length ? { inline_keyboard: buttons } : undefined;
}

export class TelegramError extends Error {
  constructor(
    message: string,
    readonly code?: number,
  ) {
    super(message);
  }

  /** Пользователь заблокировал бота или удалил чат — слать ему больше нечего. */
  get isUnreachable(): boolean {
    return this.code === 403 || this.code === 400;
  }
}

async function call(method: string, init: RequestInit): Promise<void> {
  const res = await fetch(endpoint(method), { ...init, cache: "no-store" });
  const json = (await res.json().catch(() => ({ ok: false }))) as TelegramResult;
  if (!json.ok) {
    throw new TelegramError(json.description ?? `Telegram ${method} failed`, json.error_code);
  }
}

export async function sendMessage(
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<void> {
  await call("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: keyboard(buttons),
      link_preview_options: { is_disabled: true },
    }),
  });
}

export async function sendPhoto(
  chatId: number,
  png: Buffer,
  caption: string,
  buttons?: InlineButton[][],
): Promise<void> {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("caption", caption);
  form.set("photo", new Blob([new Uint8Array(png)], { type: "image/png" }), "invite-qr.png");
  const markup = keyboard(buttons);
  if (markup) form.set("reply_markup", JSON.stringify(markup));

  await call("sendPhoto", { method: "POST", body: form });
}

/** Отправка, которая не роняет рассылку: возвращает ошибку вместо исключения. */
export async function trySend(
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<{ ok: true } | { ok: false; error: string; unreachable: boolean }> {
  try {
    await sendMessage(chatId, text, buttons);
    return { ok: true };
  } catch (e) {
    const err = e instanceof TelegramError ? e : new TelegramError(String(e));
    return { ok: false, error: err.message, unreachable: err.isUnreachable };
  }
}
