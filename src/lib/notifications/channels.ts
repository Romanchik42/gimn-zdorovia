import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { trySend, type InlineButton } from "@/lib/telegram/bot";
import type { NotificationLogRow } from "@/lib/supabase/types";

/**
 * Каналы уведомлений (GIMN-028, блок F).
 *
 * Отправлять умеет только Telegram — остальные каналы заведены заглушками,
 * чтобы у вызывающего кода был один вход. Заглушка возвращает отказ, а не
 * бросает исключение: уведомление — не главное действие, и несуществующий
 * канал не должен ронять тренировку, ради которой всё затевалось.
 *
 * Реальные email, SMS и соцсети — в GIMN-029, вместе с их адресами в профиле.
 */

export const CHANNELS = ["telegram", "email", "sms", "vk", "apple", "google"] as const;
export type Channel = (typeof CHANNELS)[number];

export type SendResult =
  | { ok: true }
  | { ok: false; error: string; unavailable: boolean };

/** Какие каналы действительно доставляют сообщение. */
export function availableChannels(): Channel[] {
  return ["telegram"];
}

const PLACEHOLDER_REASON: Record<Exclude<Channel, "telegram">, string> = {
  email: "Почты в профиле пока нет (GIMN-029)",
  sms: "SMS не подключены (GIMN-029)",
  vk: "Вход через VK не подключён (GIMN-029)",
  apple: "Вход через Apple не подключён (GIMN-029)",
  google: "Вход через Google не подключён (GIMN-029)",
};

/**
 * Одно уведомление в один канал. Факт отправки пишется в журнал — по нему
 * крон и эта прогрессия понимают, что человеку уже писали, и не пишут второй
 * раз. Неудача тоже пишется: молчание канала должно быть видно.
 */
export async function sendNotification(
  userId: string,
  channel: Channel,
  type: NotificationLogRow["type"],
  text: string,
  buttons?: InlineButton[][],
): Promise<SendResult> {
  if (channel !== "telegram") {
    return { ok: false, error: PLACEHOLDER_REASON[channel], unavailable: true };
  }

  const admin = createAdminClient();
  const { data: user } = await admin.from("users").select("telegram_id").eq("id", userId).maybeSingle();

  if (!user?.telegram_id) {
    return { ok: false, error: "Telegram не привязан", unavailable: true };
  }

  const result = await trySend(user.telegram_id, text, buttons);

  await admin.from("notifications_log").insert({
    user_id: userId,
    type,
    channel,
    status: result.ok ? "sent" : "failed",
    error: result.ok ? null : result.error,
  });

  return result.ok ? { ok: true } : { ok: false, error: result.error, unavailable: result.unreachable };
}
