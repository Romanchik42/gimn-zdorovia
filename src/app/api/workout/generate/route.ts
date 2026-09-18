import { fail, ok, parseBody } from "@/lib/api";
import { generateWorkoutSchema } from "@/lib/schemas/workout-feedback";
import { createClient } from "@/lib/supabase/server";
import { buildWorkout, applyAdjustment } from "@/lib/workout-engine/generator";
import { isoDayOfWeek, resolveSequenceSlug } from "@/lib/workout-engine/weekly-cycle";
import type {
  ExerciseRow,
  SequenceIntensity,
  SequenceItem,
} from "@/lib/supabase/types";

const INTENSITY_ORDER: SequenceIntensity[] = ["low", "medium", "normal"];

function lighterOf(a: SequenceIntensity, b: SequenceIntensity): SequenceIntensity {
  return INTENSITY_ORDER[Math.min(INTENSITY_ORDER.indexOf(a), INTENSITY_ORDER.indexOf(b))];
}

/** В плане шкала low/medium/high, у шаблонов — low/medium/normal. */
function planIntensityToSequence(value: string | null | undefined): SequenceIntensity | null {
  if (value === "high") return "normal";
  if (value === "medium" || value === "low") return value;
  return null;
}

/** Сколько дней после побочки действует поправка к нагрузке. */
const ADJUSTMENT_WINDOW_DAYS = 7;

/**
 * POST /api/workout/generate (SPEC 3.3).
 * Идемпотентен по дате: если тренировка на день уже есть и не завершена,
 * возвращаем её же — иначе выход и повторный вход плодили бы дубли.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, generateWorkoutSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const dateStr = parsed.data.date ?? new Date().toISOString().slice(0, 10);
  const date = new Date(`${dateStr}T00:00:00`);
  const dayOfWeek = isoDayOfWeek(date);

  const existing = await supabase
    .from("user_workouts")
    .select("id, status, exercises_snapshot")
    .eq("user_id", user.id)
    .eq("scheduled_date", dateStr)
    .eq("source", "plan")
    .in("status", ["planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing.data) {
    return ok({
      workout_id: existing.data.id,
      exercises: existing.data.exercises_snapshot,
      total_duration_min: null,
      reused: true,
    });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("mode")
    .eq("id", user.id)
    .maybeSingle();

  const mode = profile?.mode ?? "general";

  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("calculated_intensity, pain_areas, blood_pressure_ok")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: planDay } = await supabase
    .from("user_week_plan")
    .select("focus, intensity, is_rest_day")
    .eq("user_id", user.id)
    .eq("day_of_week", dayOfWeek)
    .maybeSingle();

  // Последняя побочка задаёт поправку к нагрузке (SPEC 5.2), но только свежая:
  // эпизод месячной давности не должен вечно занижать программу.
  const adjustmentSince = new Date(Date.now() - ADJUSTMENT_WINDOW_DAYS * 86_400_000).toISOString();
  const { data: lastSideEffect } = await supabase
    .from("side_effect_events")
    .select("applied_adjustment, exercise_id, created_at")
    .eq("user_id", user.id)
    .gte("created_at", adjustmentSince)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const planIntensity = planIntensityToSequence(planDay?.intensity);
  const diagIntensity = diagnostics?.calculated_intensity as SequenceIntensity | undefined;

  // При Бехтерева диагностика — потолок: план может сделать легче, но не тяжелее.
  const baseIntensity: SequenceIntensity =
    mode === "behtereva" && diagIntensity
      ? lighterOf(diagIntensity, planIntensity ?? diagIntensity)
      : (planIntensity ?? diagIntensity ?? "medium");

  const intensity = applyAdjustment(baseIntensity, lastSideEffect?.applied_adjustment);

  // Шаблон выбираем по фокусу дня из плана пользователя; если фокус не
  // сопоставлен — берём шаблон по дню недели. Интенсивность применяем сверху.
  const planSlug = resolveSequenceSlug(mode, planDay?.focus, planDay?.is_rest_day ?? false);
  const sequenceQuery = supabase
    .from("workout_sequences")
    .select("id, slug, exercises_order, focus_joint, total_duration_min")
    .eq("mode", mode);
  const { data: sequence } = await (planSlug
    ? sequenceQuery.eq("slug", planSlug)
    : sequenceQuery.eq("day_of_week", dayOfWeek)
  )
    .limit(1)
    .maybeSingle();

  if (!sequence) {
    return fail("На этот день нет шаблона тренировки. Проверьте, применён ли seed.", 404);
  }

  const items = (sequence.exercises_order ?? []) as SequenceItem[];
  const slugs = items.map((i) => i.slug);

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .in("slug", slugs);

  const bySlug = new Map<string, ExerciseRow>(
    ((exercises ?? []) as ExerciseRow[]).map((e) => [e.slug, e]),
  );

  const adjustment = lastSideEffect?.applied_adjustment;
  const excludeExerciseIds =
    adjustment === "skip_exercise" && lastSideEffect?.exercise_id ? [lastSideEffect.exercise_id] : [];

  // skip_joint: убираем всю зону, на которой случилась побочка.
  let excludeJoints: string[] = [];
  if (adjustment === "skip_joint" && lastSideEffect?.exercise_id) {
    const { data: culprit } = await supabase
      .from("exercises")
      .select("target_joint")
      .eq("id", lastSideEffect.exercise_id)
      .maybeSingle();
    if (culprit) excludeJoints = [culprit.target_joint];
  }

  const built = buildWorkout({
    items,
    exercisesBySlug: bySlug,
    intensity,
    painAreas: (diagnostics?.pain_areas as string[] | undefined) ?? [],
    bloodPressureOk: diagnostics?.blood_pressure_ok ?? null,
    excludeExerciseIds,
    excludeJoints,
  });

  if (built.exercises.length === 0) {
    return fail("Не удалось собрать тренировку: все упражнения отфильтрованы", 409);
  }

  const { data: created, error } = await supabase
    .from("user_workouts")
    .insert({
      user_id: user.id,
      scheduled_date: dateStr,
      status: "planned",
      generated_from_sequence_id: sequence.id,
      source: "plan",
      exercises_snapshot: built.exercises,
    })
    .select("id")
    .single();

  if (error) {
    console.error("workout insert failed:", error.message);
    return fail("Не удалось сохранить тренировку", 500);
  }

  return ok({
    workout_id: created.id,
    exercises: built.exercises,
    total_duration_min: built.totalDurationMin,
    focus: planDay?.focus ?? sequence.focus_joint,
    intensity,
    is_rest_day: planDay?.is_rest_day ?? false,
    skipped: built.skipped,
    reused: false,
  });
}
