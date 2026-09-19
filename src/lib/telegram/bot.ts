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

/**
 * url — обычная ссылка (откроется в браузере), web_app — наше приложение
 * внутри Telegram. web_app-кнопки работают только в личных чатах, а бот
 * и отвечает только в личке.
 */
export type InlineButton = { text: string; url: string } | { text: string; web_app: { url: string } };

type TelegramResult<T = unknown> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

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

async function call<T = unknown>(method: string, init: RequestInit): Promise<T> {
  const res = await fetch(endpoint(method), { ...init, cache: "no-store" });
  const json = (await res.json().catch(() => ({ ok: false }))) as TelegramResult<T>;
  if (!json.ok) {
    throw new TelegramError(json.description ?? `Telegram ${method} failed`, json.error_code);
  }
  return json.result as T;
}

function postJson(body: unknown): RequestInit {
  return { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/** Отправляет сообщение и возвращает его message_id. */
export async function sendMessage(
  chatId: number,
  text: string,
  buttons?: InlineButton[][],
): Promise<number> {
  const sent = await call<{ message_id: number }>("sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: keyboard(buttons),
      link_preview_options: { is_disabled: true },
    }),
  });
  return sent.message_id;
}

/**
 * Удаляет сообщение. Telegram разрешает это в течение 48 часов — и для
 * сообщений пользователя в личке, и для своих. Не бросает: удалить не
 * вышло (старое, уже удалено) — чату от этого хуже не становится.
 */
export async function deleteMessage(chatId: number, messageId: number): Promise<boolean> {
  try {
    await call("deleteMessage", postJson({ chat_id: chatId, message_id: messageId }));
    return true;
  } catch {
    return false;
  }
}

/** Постоянная кнопка рядом с полем ввода: открывает приложение внутри Telegram. */
export async function setMenuButton(text: string, url: string): Promise<void> {
  await call("setChatMenuButton", postJson({ menu_button: { type: "web_app", text, web_app: { url } } }));
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
