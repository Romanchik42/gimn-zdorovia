import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { deleteMessage, sendMessage, type InlineButton } from "@/lib/telegram/bot";

/**
 * Состояние чата с ботом (telegram_chats). В личке chat_id = Telegram id человека.
 *
 * - «Домашнее» сообщение — одно на чат, с кнопкой приложения; повторный
 *   /start заменяет его, после регистрации оно убирается совсем — остаётся
 *   кнопка «Открыть» у поля ввода.
 * - Сообщения о тренировке (напоминания, /today) убираются, когда человек
 *   перешёл в приложение: дело сделано, чат не копит старые «пора заниматься».
 *   Меню и отчёты остаются — к ним возвращаются.
 *
 * Удалять Telegram даёт только сообщения моложе 48 часов; остальное просто
 * забываем — deleteMessage не бросает.
 */

type Admin = ReturnType<typeof createAdminClient>;

async function chatRow(admin: Admin, chatId: number) {
  const { data } = await admin
    .from("telegram_chats")
    .select("home_message_id, workout_message_ids")
    .eq("chat_id", chatId)
    .maybeSingle();
  return data;
}

/** Ставит новое «домашнее» сообщение и убирает прежнее. */
export async function showHome(chatId: number, text: string, buttons: InlineButton[][]): Promise<void> {
  const admin = createAdminClient();
  const row = await chatRow(admin, chatId);

  // Сначала шлём новое: если отправка сорвётся, в чате останется прежняя кнопка.
  const id = await sendMessage(chatId, text, buttons);

  const previous = row?.home_message_id ? Number(row.home_message_id) : null;
  if (previous && previous !== id) await deleteMessage(chatId, previous);

  const { error } = await admin
    .from("telegram_chats")
    .upsert({ chat_id: chatId, home_message_id: id, updated_at: new Date().toISOString() });
  if (error) console.error("telegram_chats upsert failed:", error.message);
}

/** После регистрации «домашнее» с приглашением войти больше не нужно. */
export async function clearHome(chatId: number): Promise<void> {
  const admin = createAdminClient();
  const row = await chatRow(admin, chatId);
  if (!row?.home_message_id) return;
  await deleteMessage(chatId, Number(row.home_message_id));
  await admin
    .from("telegram_chats")
    .update({ home_message_id: null, updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
}

/** Запоминает сообщение о тренировке, чтобы убрать его после перехода в приложение. */
export async function rememberWorkoutMessage(chatId: number, messageId: number): Promise<void> {
  const admin = createAdminClient();
  const row = await chatRow(admin, chatId);
  // Держим только свежие: старше 48 часов Telegram всё равно удалить не даст.
  const ids = [...((row?.workout_message_ids as number[] | undefined) ?? []).map(Number), messageId].slice(-10);
  const { error } = await admin
    .from("telegram_chats")
    .upsert({ chat_id: chatId, workout_message_ids: ids, updated_at: new Date().toISOString() });
  if (error) console.error("telegram_chats workout ids failed:", error.message);
}

/** Человек открыл приложение — убираем из чата напоминания о тренировке. */
export async function clearWorkoutMessages(chatId: number): Promise<number> {
  const admin = createAdminClient();
  const row = await chatRow(admin, chatId);
  const ids = ((row?.workout_message_ids as number[] | undefined) ?? []).map(Number);
  if (ids.length === 0) return 0;

  const results = await Promise.all(ids.map((id) => deleteMessage(chatId, id)));
  await admin
    .from("telegram_chats")
    .update({ workout_message_ids: [], updated_at: new Date().toISOString() })
    .eq("chat_id", chatId);
  return results.filter(Boolean).length;
}
