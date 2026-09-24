import "server-only";

import { provisionUser } from "@/lib/auth/provision";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OtpChannel } from "@/lib/auth/otp";
import type { ReferralSource } from "@/lib/supabase/types";

/**
 * Вход по подтверждённому коду (GIMN-029).
 *
 * Сюда приходят только проверенные идентификаторы: код уже сверен и
 * погашен вызывающим роутом. Задача этого модуля — найти или завести
 * пользователя и открыть сессию, как это делает telegram-session для
 * Telegram.
 *
 * Сессия открывается одноразовой ссылкой, а не паролем. У Telegram пароль
 * выводится из токена бота, и его знает сервер; здесь пароля нет ни у кого
 * — вход по коду тем и отличается. generateLink письма не шлёт, а
 * verifyOtp тут же гасит ссылку и ставит куки.
 */

/** Синтетический адрес для входа по телефону — настоящей почты у нас нет. */
export function phoneEmail(phone: string): string {
  return `sms${phone.replace(/\D/g, "")}@phone.gimn.local`;
}

export type OtpSessionResult =
  | { ok: true; userId: string; isNewUser: boolean }
  | { ok: false; error: string; status: number };

/**
 * Имя нового пользователя.
 *
 * Telegram отдаёт имя сам, а код в SMS не говорит о человеке ничего.
 * Выдумывать «Пользователь» не будем: приветствие на главной уже умеет
 * обходиться без имени и скажет просто «Здравствуйте», а имя человек
 * впишет в настройках, когда захочет. Ложное имя в приветствии неприятнее
 * отсутствующего.
 */
function initialName(channel: OtpChannel, identifier: string): string {
  if (channel !== "email") return "";
  const local = identifier.split("@")[0]?.replace(/[._-]+/g, " ").trim() ?? "";
  return local.length >= 2 && local.length <= 100 ? local : "";
}

export async function openOtpSession(
  channel: OtpChannel,
  identifier: string,
  referral: { code?: string | null; source?: ReferralSource },
): Promise<OtpSessionResult> {
  const admin = createAdminClient();
  const column = channel === "sms" ? "phone" : "email";
  const authEmail = channel === "sms" ? phoneEmail(identifier) : identifier;

  const { data: known, error: knownError } = await admin
    .from("users")
    .select("id")
    .eq(column, identifier)
    .maybeSingle();

  if (knownError) {
    console.error("otp session: lookup failed", knownError.message);
    return { ok: false, error: "Не удалось войти", status: 500 };
  }

  let authUserId = known?.id ?? null;

  if (!authUserId) {
    const created = await admin.auth.admin.createUser({
      email: authEmail,
      email_confirm: true,
      user_metadata: channel === "sms" ? { phone: identifier } : { email: identifier },
    });

    if (created.error) {
      // Аккаунт в auth мог остаться от прерванной регистрации — без строки
      // в users. Тогда входим в него, а не заводим второй.
      const list = await admin.auth.admin.listUsers();
      const found = list.data?.users.find((u) => u.email === authEmail);
      if (!found) {
        console.error("otp session: createUser failed", created.error.message);
        return { ok: false, error: "Не удалось создать аккаунт", status: 500 };
      }
      authUserId = found.id;
    } else {
      authUserId = created.data.user.id;
    }
  }

  let provisioned;
  try {
    provisioned = await provisionUser({
      authUserId,
      name: initialName(channel, identifier),
      email: channel === "email" ? identifier : null,
      referralCode: referral.code ?? null,
      referralSource: referral.source ?? "link",
    });
  } catch (e) {
    console.error("otp session: provision failed", e);
    return { ok: false, error: "Не удалось подготовить профиль", status: 500 };
  }

  // Телефон в профиль пишем отдельно: provisionUser про него не знает, а
  // по нему же идёт поиск при следующем входе.
  if (channel === "sms") {
    const { error } = await admin
      .from("users")
      .update({ phone: identifier })
      .eq("id", provisioned.userId);
    if (error) console.error("otp session: phone save failed", error.message);
  }

  const { data: authUser } = await admin.auth.admin.getUserById(provisioned.userId);
  const accountEmail = authUser.user?.email ?? authEmail;

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email: accountEmail });
  const tokenHash = link.data?.properties?.hashed_token;

  if (!tokenHash) {
    console.error("otp session: generateLink failed", link.error?.message);
    return { ok: false, error: "Не удалось открыть сессию", status: 500 };
  }

  const supabase = await createClient();
  const verified = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });

  if (verified.error) {
    console.error("otp session: verifyOtp failed", verified.error.message);
    return { ok: false, error: "Не удалось открыть сессию", status: 500 };
  }

  return { ok: true, userId: provisioned.userId, isNewUser: provisioned.isNewUser };
}
