import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/notifications/channels";
import { openAppButton } from "@/lib/telegram/messages";
import { todayIso } from "@/lib/dates";
import {
  evaluateLevelUp,
  levelMetrics,
  type LevelMetrics,
  type ProgressSet,
} from "@/lib/progression/level-check";
import type { Level } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Предложение перейти на следующий уровень (GIMN-028, блок F).
 *
 * Вызывается после завершённой тренировки. Ничего не переключает: ставит
 * отметку, что предложение показано, отдаёт данные модалке и пишет человеку
 * в Telegram — на случай, если он закрыл приложение, не долистав до конца.
 *
 * Спрашиваем не чаще раза в неделю. Отказ — это ответ, а не ошибка; человек,
 * которому вопрос задают каждую тренировку, перестаёт читать вопросы вообще.
 */

export const OFFER_COOLDOWN_DAYS = 7;

export type LevelUpOffer = {
  /** Имя для обращения: модалка живёт в бегунке тренировки, профиля там нет. */
  name: string;
  nextLevel: Level;
  workouts: number;
  growthPct: number;
  startWeightKg: number | null;
  currentWeightKg: number | null;
};

function offerFrom(name: string, next: Level, metrics: LevelMetrics): LevelUpOffer {
  return {
    name,
    nextLevel: next,
    workouts: metrics.workouts,
    growthPct: metrics.growthPct ?? 0,
    startWeightKg: metrics.startWeightKg,
    currentWeightKg: metrics.currentWeightKg,
  };
}

/** Текст в Telegram. Без разметки — как и весь бот (SPEC 5.8). */
export function levelUpText(offer: LevelUpOffer): string {
  const growth =
    offer.startWeightKg && offer.currentWeightKg
      ? `Рабочий вес вырос с ${offer.startWeightKg} до ${offer.currentWeightKg} кг — это +${offer.growthPct}%.`
      : `Рабочий вес вырос на ${offer.growthPct}%.`;

  return [
    `${offer.name}, за ${offer.workouts} тренировок вы прошли уровень «Новичок» целиком.`,
    growth,
    "Откройте приложение — предложим перейти на средний уровень. Останетесь на прежнем, если пока не хочется.",
  ].join("\n");
}

/**
 * Проверяет условия и, если всё сошлось, предлагает. Возвращает предложение
 * для модалки или null. Ошибки глушатся: это довесок к сохранению тренировки,
 * и упасть он права не имеет.
 */
export async function maybeOfferLevelUp(
  supabase: ServerClient,
  userId: string,
): Promise<LevelUpOffer | null> {
  try {
    const [{ data: user }, { data: profile }] = await Promise.all([
      supabase.from("users").select("name, mode").eq("id", userId).maybeSingle(),
      // "*": level_up_offered_at появляется с миграцией 0025, а деплой и
      // миграция не атомарны — перечисление уронило бы запрос вместе с
      // difficulty до её применения.
      supabase.from("user_profiles_general").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    // Уровни считаются по силовой работе, а её ведёт только общий режим.
    if (!user || user.mode !== "general" || !profile) return null;

    const offeredAt = (profile as { level_up_offered_at?: string | null }).level_up_offered_at;
    if (offeredAt) {
      const days = (Date.now() - new Date(offeredAt).getTime()) / 86_400_000;
      if (days < OFFER_COOLDOWN_DAYS) return null;
    }

    const { data: sets } = await supabase
      .from("workout_sets")
      .select("date, exercise_id, reps, weight_kg")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1000);

    const metrics = levelMetrics((sets ?? []) as ProgressSet[], todayIso());
    const check = evaluateLevelUp(profile.difficulty, metrics);
    if (!check.eligible || !check.nextLevel) return null;

    const offer = offerFrom(user.name, check.nextLevel, metrics);

    const { error } = await supabase
      .from("user_profiles_general")
      .update({ level_up_offered_at: new Date().toISOString() } as never)
      .eq("user_id", userId);

    // Отметку поставить не вышло (миграция ещё не применена) — не пишем и в
    // Telegram: иначе сообщение будет приходить после каждой тренировки.
    if (error) {
      console.error("level up offer flag failed:", error.message);
      return null;
    }

    await sendNotification(userId, "telegram", "level_up", levelUpText(offer), openAppButton());

    return offer;
  } catch (e) {
    console.error("level up check failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
}
