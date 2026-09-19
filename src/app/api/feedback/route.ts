import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { FEEDBACK_TYPE_LABELS, feedbackSchema } from "@/lib/schemas/feedback";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { trySend } from "@/lib/telegram/bot";

/**
 * POST /api/feedback — отзыв, ошибка или идея из настроек (GIMN-011).
 *
 * Главное — сохранить в БД; уведомление в Telegram best-effort: не дошло —
 * человек всё равно получает «спасибо», а запись на месте.
 * Получатели: админы с привязанным Telegram и TELEGRAM_ADMIN_CHAT_ID из окружения.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, feedbackSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  if (!rateLimit(`feedback:${user.id}`, 5, 10 * 60_000)) {
    return fail("Слишком много сообщений подряд. Попробуйте позже.", 429);
  }

  const { type, text } = parsed.data;

  const { data: saved, error } = await supabase
    .from("feedback")
    .insert({ user_id: user.id, type, text })
    .select("id")
    .single();

  if (error) {
    console.error("feedback insert failed:", error.message);
    return fail("Не удалось отправить. Попробуйте ещё раз.", 500);
  }

  const notified = await notifyAdmins(user.id, type, text).catch((e) => {
    console.error("feedback notify failed:", e);
    return 0;
  });

  return ok({ id: saved.id, notified });
}

async function notifyAdmins(userId: string, type: keyof typeof FEEDBACK_TYPE_LABELS, text: string): Promise<number> {
  const admin = createAdminClient();
  const { data: author } = await admin.from("users").select("name, telegram_username").eq("id", userId).maybeSingle();
  const { data: admins } = await admin
    .from("users")
    .select("telegram_id")
    .eq("is_admin", true)
    .not("telegram_id", "is", null);

  const chats = new Set<number>();
  for (const a of admins ?? []) if (a.telegram_id) chats.add(Number(a.telegram_id));
  try {
    const fromEnv = serverEnv().TELEGRAM_ADMIN_CHAT_ID;
    if (typeof fromEnv === "number") chats.add(fromEnv);
  } catch {
    // окружение не настроено — уведомление просто не уходит
  }
  if (chats.size === 0) return 0;

  // parse_mode не используем: имя или текст со звёздочками ничего не сломают.
  const who = author?.telegram_username ? `${author.name} (@${author.telegram_username})` : (author?.name ?? "Пользователь");
  const message = [`Гимн.здоровья — ${FEEDBACK_TYPE_LABELS[type]}`, `От: ${who}`, "", text].join("\n");

  let sent = 0;
  for (const chatId of chats) {
    const result = await trySend(chatId, message);
    if (result.ok) sent++;
    else console.error("feedback telegram failed:", result.error);
  }
  return sent;
}
