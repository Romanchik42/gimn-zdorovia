import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { telegramLoginSchema } from "@/lib/schemas/user";
import { verifyTelegramLogin } from "@/lib/telegram/verify";
import { provisionUser, telegramEmail, telegramPassword } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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

  const admin = createAdminClient();
  const email = telegramEmail(payload.id);
  const password = telegramPassword(payload.id);
  const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ") || "Пользователь";

  // Профиль по telegram_id мог быть создан раньше — тогда просто входим.
  const known = await admin
    .from("users")
    .select("id, mode, tour_completed")
    .eq("telegram_id", payload.id)
    .maybeSingle();

  let authUserId = known.data?.id ?? null;

  if (!authUserId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_id: payload.id, telegram_username: payload.username, name },
    });

    if (created.error) {
      // Аккаунт мог уже существовать в auth без строки в users — тогда ищем его.
      const list = await admin.auth.admin.listUsers();
      const found = list.data?.users.find((u) => u.email === email);
      if (!found) {
        console.error("telegram auth: createUser failed", created.error.message);
        return fail("Не удалось создать аккаунт", 500);
      }
      authUserId = found.id;
      // Пароль мог быть выведен из другого токена — приводим к текущему.
      await admin.auth.admin.updateUserById(found.id, { password });
    } else {
      authUserId = created.data.user.id;
    }
  }

  let provisioned;
  try {
    provisioned = await provisionUser({
      authUserId,
      name,
      email: null,
      telegramId: payload.id,
      telegramUsername: payload.username ?? null,
      referralCode: payload.referral_code ?? null,
      // Источник — откуда пришло приглашение, а не чем вошли: вход через
      // Telegram по ссылке из QR — это канал «qr».
      referralSource: payload.referral_source ?? "telegram",
    });
  } catch (e) {
    console.error("telegram auth: provision failed", e);
    return fail("Не удалось подготовить профиль", 500);
  }

  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    console.error("telegram auth: signIn failed", signIn.error.message);
    return fail("Не удалось открыть сессию", 500);
  }

  return ok({
    user_id: provisioned.userId,
    is_new_user: provisioned.isNewUser,
    next_step: provisioned.isNewUser ? "onboarding_mode" : "app",
  });
}
