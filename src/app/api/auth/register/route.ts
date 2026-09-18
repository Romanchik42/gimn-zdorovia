import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { registerSchema } from "@/lib/schemas/user";
import { provisionUser } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/auth/register — регистрация по email (резервный способ входа).
 * Профиль и реферальный код заводятся здесь же, чтобы пользователь
 * не мог попасть в приложение без строки в users.
 *
 * Аккаунт создаётся сервисным ключом сразу подтверждённым, как и при входе
 * через Telegram. Через signUp при включённом в Supabase «Confirm email»
 * сессии нет, а встроенный SMTP Supabase шлёт письма только участникам
 * команды проекта — обычный человек застревал бы на входе.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, registerSchema);
  if (parsed.error) return parsed.error;

  const { name, email, password, referral_code, referral_source } = parsed.data;

  if (!rateLimit(`register:${email.toLowerCase()}`, 5, 60_000)) {
    return fail("Слишком много попыток. Подождите минуту.", 429);
  }

  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (created.error) {
    const msg = created.error.message.toLowerCase();
    if (created.error.status === 422 || msg.includes("already") || msg.includes("registered")) {
      return fail("Такой email уже зарегистрирован. Попробуйте войти.", 409);
    }
    return fail(created.error.message, 400);
  }

  let provisioned;
  try {
    provisioned = await provisionUser({
      authUserId: created.data.user.id,
      name,
      email,
      referralCode: referral_code ?? null,
      referralSource: referral_source ?? "link",
    });
  } catch (e) {
    console.error("register: provision failed", e);
    return fail("Аккаунт создан, но профиль не удалось подготовить", 500);
  }

  // Сессию открывает серверный клиент — куки уходят в этом же ответе.
  const supabase = await createClient();
  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (signIn.error) {
    console.error("register: signIn failed", signIn.error.message);
    return ok({ user_id: provisioned.userId, is_new_user: true, next_step: "login" });
  }

  return ok({
    user_id: provisioned.userId,
    is_new_user: provisioned.isNewUser,
    next_step: provisioned.isNewUser ? "onboarding_mode" : "app",
  });
}
