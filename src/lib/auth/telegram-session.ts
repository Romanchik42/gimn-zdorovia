import "server-only";

import { provisionUser, telegramEmail, telegramPassword } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ReferralSource } from "@/lib/supabase/types";

/**
 * Вход по уже проверенной личности Telegram — общий для виджета входа
 * и для приложения, открытого кнопкой из бота (Web App). Подпись проверяет
 * вызывающий роут: сюда приходят только данные, которым можно верить.
 *
 * Находит или заводит пользователя в Supabase Auth, готовит профиль
 * и открывает сессию (куки ставит серверный клиент).
 */

export type TelegramIdentity = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type TelegramSessionResult =
  | { ok: true; userId: string; isNewUser: boolean }
  | { ok: false; error: string; status: number };

export async function openTelegramSession(
  identity: TelegramIdentity,
  referral: { code?: string | null; source?: ReferralSource },
): Promise<TelegramSessionResult> {
  const admin = createAdminClient();
  const email = telegramEmail(identity.id);
  const password = telegramPassword(identity.id);
  const name = [identity.first_name, identity.last_name].filter(Boolean).join(" ") || "Пользователь";

  // Профиль по telegram_id мог быть создан раньше — тогда просто входим.
  const known = await admin.from("users").select("id").eq("telegram_id", identity.id).maybeSingle();

  let authUserId = known.data?.id ?? null;

  if (!authUserId) {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { telegram_id: identity.id, telegram_username: identity.username, name },
    });

    if (created.error) {
      // Аккаунт мог уже существовать в auth без строки в users — тогда ищем его.
      const list = await admin.auth.admin.listUsers();
      const found = list.data?.users.find((u) => u.email === email);
      if (!found) {
        console.error("telegram auth: createUser failed", created.error.message);
        return { ok: false, error: "Не удалось создать аккаунт", status: 500 };
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
      telegramId: identity.id,
      telegramUsername: identity.username ?? null,
      referralCode: referral.code ?? null,
      // Источник — откуда пришло приглашение, а не чем вошли: вход через
      // Telegram по ссылке из QR — это канал «qr».
      referralSource: referral.source ?? "telegram",
    });
  } catch (e) {
    console.error("telegram auth: provision failed", e);
    return { ok: false, error: "Не удалось подготовить профиль", status: 500 };
  }

  const supabase = await createClient();

  // Аккаунт мог быть заведён по почте, а Telegram к нему привязан позже
  // (подписанная ссылка из настроек). Пароля от него у нас нет, поэтому
  // открываем сессию одноразовой ссылкой: generateLink письмо не отправляет,
  // а verifyOtp тут же её погашает и ставит куки.
  const { data: authUser } = await admin.auth.admin.getUserById(provisioned.userId);
  const accountEmail = authUser.user?.email ?? email;

  if (accountEmail !== email) {
    const link = await admin.auth.admin.generateLink({ type: "magiclink", email: accountEmail });
    const tokenHash = link.data?.properties?.hashed_token;
    const verified = tokenHash
      ? await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash })
      : null;
    if (!verified || verified.error) {
      console.error("telegram auth: linked-account sign-in failed", link.error?.message ?? verified?.error?.message);
      return { ok: false, error: "Не удалось открыть сессию", status: 500 };
    }
    return { ok: true, userId: provisioned.userId, isNewUser: provisioned.isNewUser };
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password });

  if (signIn.error) {
    console.error("telegram auth: signIn failed", signIn.error.message);
    return { ok: false, error: "Не удалось открыть сессию", status: 500 };
  }

  return { ok: true, userId: provisioned.userId, isNewUser: provisioned.isNewUser };
}
