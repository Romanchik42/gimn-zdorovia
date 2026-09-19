import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { telegramLoginSchema } from "@/lib/schemas/user";
import { verifyTelegramLogin } from "@/lib/telegram/verify";
import { openTelegramSession } from "@/lib/auth/telegram-session";

/**
 * POST /api/auth/telegram — вход через Telegram Login Widget (SPEC 3.1).
 *
 * 1. Проверяем подпись HMAC-SHA256 — до этого данным из тела не верим вообще.
 * 2. Находим или заводим пользователя в Supabase Auth.
 * 3. Открываем сессию (куки ставит серверный клиент).
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, telegramLoginSchema);
  if (parsed.error) return parsed.error;

  const payload = parsed.data;

  if (!rateLimit(`tg-auth:${payload.id}`, 10, 60_000)) {
    return fail("Слишком много попыток входа. Подождите минуту.", 429);
  }

  let env;
  try {
    env = serverEnv();
  } catch (e) {
    console.error("telegram auth: env not configured", e);
    return fail("Вход через Telegram пока не настроен", 503);
  }

  const verdict = verifyTelegramLogin(
    {
      id: payload.id,
      first_name: payload.first_name,
      last_name: payload.last_name,
      username: payload.username,
      photo_url: payload.photo_url,
      auth_date: payload.auth_date,
      hash: payload.hash,
    },
    env.TELEGRAM_BOT_TOKEN,
  );

  if (!verdict.ok) {
    return fail(`Не удалось подтвердить вход через Telegram: ${verdict.reason}`, 401);
  }

  const session = await openTelegramSession(payload, {
    code: payload.referral_code,
    source: payload.referral_source,
  });
  if (!session.ok) return fail(session.error, session.status);

  return ok({
    user_id: session.userId,
    is_new_user: session.isNewUser,
    next_step: session.isNewUser ? "onboarding_mode" : "app",
  });
}
