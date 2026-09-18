import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { registerSchema } from "@/lib/schemas/user";
import { provisionUser } from "@/lib/auth/provision";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/register — регистрация по email (резервный способ входа).
 * Профиль и реферальный код заводятся здесь же, чтобы пользователь
 * не мог попасть в приложение без строки в users.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, registerSchema);
  if (parsed.error) return parsed.error;

  const { name, email, password, referral_code, referral_source } = parsed.data;

  if (!rateLimit(`register:${email.toLowerCase()}`, 5, 60_000)) {
    return fail("Слишком много попыток. Подождите минуту.", 429);
  }

  const supabase = await createClient();

  const signUp = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (signUp.error) {
    const msg = signUp.error.message.toLowerCase();
    if (msg.includes("already") || msg.includes("registered")) {
      return fail("Такой email уже зарегистрирован. Попробуйте войти.", 409);
    }
    return fail(signUp.error.message, 400);
  }

  const authUser = signUp.data.user;
  if (!authUser) {
    // Включено подтверждение email — сессии пока нет, профиль заведём при первом входе.
    return ok({ user_id: null, is_new_user: true, next_step: "confirm_email" });
  }

  try {
    const provisioned = await provisionUser({
      authUserId: authUser.id,
      name,
      email,
      referralCode: referral_code ?? null,
      referralSource: referral_source ?? "link",
    });

    return ok({
      user_id: provisioned.userId,
      is_new_user: provisioned.isNewUser,
      next_step: provisioned.isNewUser ? "onboarding_mode" : "app",
    });
  } catch (e) {
    console.error("register: provision failed", e);
    return fail("Аккаунт создан, но профиль не удалось подготовить", 500);
  }
}
