import "server-only";

import { createHmac } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import {
  MAX_CODE_ATTEMPTS,
  generateReferralCode,
  normalizeReferralCode,
} from "@/lib/referral/code-generator";
import type { Mode, ReferralSource } from "@/lib/supabase/types";
import { DEFAULT_WEEK_PLAN } from "@/lib/workout-engine/weekly-cycle";

/**
 * Создание профиля пользователя: реферальный код, привязка пригласившего,
 * недельный план по умолчанию. Всё делается под service_role, потому что
 * на момент вставки строки в users её ещё не видит ни одна RLS-политика.
 */

/** Синтетический email для входа через Telegram — реального адреса у нас нет. */
export function telegramEmail(telegramId: number): string {
  return `tg${telegramId}@telegram.gimn.local`;
}

/**
 * Детерминированный пароль для Telegram-аккаунта.
 * Выводится из bot token, который знает только сервер, — пользователю он
 * не показывается и через него нельзя войти, не пройдя проверку подписи.
 */
export function telegramPassword(telegramId: number): string {
  const { TELEGRAM_BOT_TOKEN } = serverEnv();
  return createHmac("sha256", TELEGRAM_BOT_TOKEN).update(`tg-auth:${telegramId}`).digest("hex");
}

type ProvisionArgs = {
  authUserId: string;
  name: string;
  mode?: Mode;
  email?: string | null;
  telegramId?: number | null;
  telegramUsername?: string | null;
  referralCode?: string | null;
  referralSource?: ReferralSource;
};

export type ProvisionResult = {
  userId: string;
  referralCode: string;
  isNewUser: boolean;
};

export async function provisionUser(args: ProvisionArgs): Promise<ProvisionResult> {
  const admin = createAdminClient();

  const existing = await admin
    .from("users")
    .select("id, referral_code")
    .eq("id", args.authUserId)
    .maybeSingle();

  if (existing.data) {
    return {
      userId: existing.data.id,
      referralCode: existing.data.referral_code,
      isNewUser: false,
    };
  }

  // Кто пригласил — определяем на сервере по коду. Клиенту тут не доверяем (SPEC 5.8).
  let referrerId: string | null = null;
  const inviteCode = args.referralCode ? normalizeReferralCode(args.referralCode) : "";
  if (inviteCode) {
    const referrer = await admin
      .from("users")
      .select("id")
      .eq("referral_code", inviteCode)
      .maybeSingle();
    // Свой собственный код не считается приглашением.
    if (referrer.data && referrer.data.id !== args.authUserId) {
      referrerId = referrer.data.id;
    }
  }

  // Коллизия кода маловероятна, но обрабатывается ретраем (SPEC 2.4).
  let referralCode = "";
  let inserted = false;
  let lastError: string | null = null;

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS && !inserted; attempt++) {
    referralCode = generateReferralCode();

    const { error } = await admin.from("users").insert({
      id: args.authUserId,
      name: args.name,
      mode: args.mode ?? "general",
      email: args.email ?? null,
      telegram_id: args.telegramId ?? null,
      telegram_username: args.telegramUsername ?? null,
      referral_code: referralCode,
      referred_by: referrerId,
      referred_at: referrerId ? new Date().toISOString() : null,
    });

    if (!error) {
      inserted = true;
      break;
    }

    // 23505 — unique_violation. Если конфликт по referral_code, пробуем снова.
    if (error.code === "23505" && error.message.includes("referral_code")) {
      lastError = error.message;
      continue;
    }

    throw new Error(`Не удалось создать профиль: ${error.message}`);
  }

  if (!inserted) {
    throw new Error(
      `Не удалось подобрать свободный реферальный код за ${MAX_CODE_ATTEMPTS} попыток: ${lastError}`,
    );
  }

  if (referrerId) {
    // Запись в referrals — для аналитики. Провал не должен ломать регистрацию.
    const { error } = await admin.from("referrals").insert({
      referrer_id: referrerId,
      referred_id: args.authUserId,
      referral_code: inviteCode,
      source: args.referralSource ?? "link",
    });
    if (error) console.error("referrals insert failed:", error.message);

    await admin
      .from("referral_clicks")
      .update({ converted: true })
      .eq("referral_code", inviteCode)
      .eq("converted", false);
  }

  await createDefaultWeekPlan(args.authUserId, args.mode ?? "general");

  return { userId: args.authUserId, referralCode, isNewUser: true };
}

/** Недельный план по умолчанию под режим (SPEC 5.4). */
export async function createDefaultWeekPlan(userId: string, mode: Mode): Promise<void> {
  const admin = createAdminClient();

  const rows = DEFAULT_WEEK_PLAN[mode].map((day) => ({
    user_id: userId,
    day_of_week: day.day_of_week,
    focus: day.focus,
    duration_min: day.duration_min,
    intensity: day.intensity,
    is_rest_day: day.is_rest_day,
    is_custom: false,
  }));

  const { error } = await admin.from("user_week_plan").upsert(rows, {
    onConflict: "user_id,day_of_week",
  });

  if (error) throw new Error(`Не удалось создать недельный план: ${error.message}`);
}
