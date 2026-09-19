import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { telegramWebAppSchema } from "@/lib/schemas/user";
import { verifyWebAppInitData } from "@/lib/telegram/verify";
import { openTelegramSession } from "@/lib/auth/telegram-session";
import { clearWorkoutMessages } from "@/lib/telegram/chat";

/**
 * POST /api/auth/telegram-webapp — вход в приложение, открытое кнопкой бота.
 *
 * Telegram передаёт в Web App строку initData, подписанную токеном бота.
 * Проверяем подпись и возраст и открываем сессию так же, как для виджета
 * входа, — человеку не нужно ничего нажимать.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, telegramWebAppSchema);
  if (parsed.error) return parsed.error;

  let env;
  try {
    env = serverEnv();
  } catch (e) {
    console.error("telegram webapp auth: env not configured", e);
    return fail("Вход через Telegram пока не настроен", 503);
  }

  const verdict = verifyWebAppInitData(parsed.data.init_data, env.TELEGRAM_BOT_TOKEN);
  if (!verdict.ok) {
    return fail(`Не удалось подтвердить вход через Telegram: ${verdict.reason}`, 401);
  }

  if (!rateLimit(`tg-auth:${verdict.user.id}`, 10, 60_000)) {
    return fail("Слишком много попыток входа. Подождите минуту.", 429);
  }

  const session = await openTelegramSession(verdict.user, {
    code: parsed.data.referral_code,
    source: parsed.data.referral_source,
  });
  if (!session.ok) return fail(session.error, session.status);

  // Перешёл в приложение — напоминания о тренировке в чате больше не нужны.
  await clearWorkoutMessages(verdict.user.id).catch((e) => console.error("workout messages cleanup failed:", e));

  return ok({
    user_id: session.userId,
    is_new_user: session.isNewUser,
    next_step: session.isNewUser ? "onboarding_mode" : "app",
  });
}
