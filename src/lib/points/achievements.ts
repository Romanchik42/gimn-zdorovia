import "server-only";

import { todayIso } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

import { STREAK_TARGET_DAYS, WORKOUTS_TARGET, completionDay, currentStreak } from "./milestones";
import { POINTS_RULES, awardPoints } from "./service";

/**
 * Начисления, обещанные в разделе «Баллы», кроме отзывов (те — в
 * feedback-review): друг зарегистрировался, друг оплатил, серия 30 дней,
 * сотая тренировка.
 *
 * Каждое начисление идёт со ссылкой (reference_type + reference_id), и
 * уникальный индекс uniq_points_ref не даст выдать его дважды — сколько бы
 * раз эти функции ни позвали. Поэтому их можно звать «на всякий случай».
 *
 * Ничего не бросают: баллы — приятное дополнение, а не повод уронить
 * регистрацию, оплату или конец тренировки.
 */

/** Друг зарегистрировался по приглашению — баллы пригласившему. */
export async function awardReferralRegistered(referrerId: string, referredId: string): Promise<void> {
  try {
    await awardPoints(
      referrerId,
      POINTS_RULES.REFERRAL_REGISTERED,
      "Друг зарегистрировался по вашему приглашению",
      "REFERRAL_REGISTERED",
      referredId,
    );
  } catch (e) {
    console.error("referral registered award failed:", e);
  }
}

/** Приглашённый оплатил подписку — баллы пригласившему, один раз за друга. */
export async function awardReferralPaid(payerId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("referred_by").eq("id", payerId).maybeSingle();
    if (!data?.referred_by) return;

    await awardPoints(
      data.referred_by,
      POINTS_RULES.REFERRAL_PAID,
      "Приглашённый друг оформил подписку",
      "REFERRAL_PAID",
      payerId,
    );
  } catch (e) {
    console.error("referral paid award failed:", e);
  }
}

/** После завершённой тренировки: серия 30 дней и сотая тренировка. */
export async function awardWorkoutMilestones(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();

    const { count } = await admin
      .from("user_workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");

    if ((count ?? 0) >= WORKOUTS_TARGET) {
      await awardPoints(
        userId,
        POINTS_RULES.WORKOUTS_100,
        `${WORKOUTS_TARGET} тренировок всего`,
        "WORKOUTS_100",
        userId,
      );
    }

    // Серии хватает истории чуть длиннее цели: дальше она уже засчитана.
    const since = new Date(Date.now() - (STREAK_TARGET_DAYS + 5) * 86_400_000).toISOString();
    const { data: recent } = await admin
      .from("user_workouts")
      .select("completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .gte("completed_at", since);

    const days = (recent ?? []).flatMap((r) => (r.completed_at ? [completionDay(r.completed_at)] : []));
    const streak = currentStreak(days, todayIso());

    if (streak.length >= STREAK_TARGET_DAYS && streak.startedOn) {
      await awardPoints(
        userId,
        POINTS_RULES.STREAK_30_DAYS,
        `${STREAK_TARGET_DAYS} дней тренировок подряд`,
        "STREAK_30_DAYS",
        streak.startedOn,
      );
    }
  } catch (e) {
    console.error("workout milestones award failed:", e);
  }
}
