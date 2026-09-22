import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { buildWorkout, estimateMinutes } from "@/lib/workout-engine/generator";
import { DEFAULT_WEEK_PLAN, resolveSequenceSlug } from "@/lib/workout-engine/weekly-cycle";
import { MEAL_ORDER, hashSeed, planWeek } from "@/lib/nutrition-engine/menu";
import { DEFAULT_TARGET_KCAL } from "@/lib/nutrition-engine/service";
import { dayOfWeek, todayIso } from "@/lib/dates";
import type { Mode } from "@/lib/modes";
import type { ExerciseRow, ExerciseSnapshot, MealRow, SequenceItem } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Показательный день чужого режима (GIMN-012, блок A2).
 *
 * Считается целиком в памяти по усреднённому профилю: ни личной анкеты,
 * ни записи в БД. Это принципиально — просмотр не должен оставлять следов,
 * иначе «посмотреть» незаметно превращалось бы в «начать заниматься».
 */

export type ModePreview = {
  mode: Mode;
  focus: string;
  durationMin: number;
  exercises: ExerciseSnapshot[];
  meals: { meal_type: string; name: string; kcal: number }[];
  targetKcal: number;
};

export async function buildModePreview(
  supabase: ServerClient,
  mode: Mode,
): Promise<ModePreview | null> {
  const today = todayIso();
  const dow = dayOfWeek(today);

  // День берём из рекомендуемого плана режима — это и есть «средний профиль».
  const planDay =
    DEFAULT_WEEK_PLAN[mode].find((d) => d.day_of_week === dow) ?? DEFAULT_WEEK_PLAN[mode][0];

  const slug = resolveSequenceSlug(mode, planDay.focus, planDay.is_rest_day);
  const query = supabase
    .from("workout_sequences")
    .select("exercises_order, focus_joint, total_duration_min")
    .eq("mode", mode);

  const [{ data: sequence }, { data: exercises }, { data: meals }] = await Promise.all([
    (slug ? query.eq("slug", slug) : query.eq("day_of_week", dow)).limit(1).maybeSingle(),
    supabase.from("exercises").select("*"),
    supabase.from("meals").select("*"),
  ]);

  if (!sequence) return null;

  const bySlug = new Map<string, ExerciseRow>(
    ((exercises ?? []) as ExerciseRow[]).map((e) => [e.slug, e]),
  );

  // Без противопоказаний и поправок: анкеты этого режима у человека ещё нет.
  const built = buildWorkout({
    items: (sequence.exercises_order ?? []) as SequenceItem[],
    exercisesBySlug: bySlug,
    mode,
    intensity: "medium",
    painAreas: [],
    bloodPressureOk: null,
  });

  const mealRows = (meals ?? []) as MealRow[];
  const day = planWeek({
    meals: mealRows,
    targetKcal: DEFAULT_TARGET_KCAL,
    dates: [today],
    seed: hashSeed(`preview:${mode}:${today}`),
  })[0];

  const byId = new Map(mealRows.map((m) => [m.id, m]));
  const order = new Map(MEAL_ORDER.map((t, i) => [t, i]));

  return {
    mode,
    focus: planDay.focus,
    durationMin: estimateMinutes(built.exercises) || planDay.duration_min,
    exercises: built.exercises,
    meals: (day?.slots ?? [])
      .slice()
      .sort((a, b) => (order.get(a.meal_type) ?? 0) - (order.get(b.meal_type) ?? 0))
      .flatMap((s) => {
        const meal = byId.get(s.meal_id);
        return meal
          ? [{ meal_type: s.meal_type, name: meal.name, kcal: Math.round(meal.total_kcal * s.portion) }]
          : [];
      }),
    targetKcal: DEFAULT_TARGET_KCAL,
  };
}
