import { fail, ok, parseBody } from "@/lib/api";
import { generateWorkoutSchema } from "@/lib/schemas/workout-feedback";
import { createClient } from "@/lib/supabase/server";
import {
  applyAdjustment,
  buildWorkout,
  estimateMinutes,
  fitPlanWorkout,
  targetMinutes,
} from "@/lib/workout-engine/generator";
import { resolveSequenceSlug } from "@/lib/workout-engine/weekly-cycle";
import { addDays, dayOfWeek as dayOfWeekOf, todayIso, weekStartOf } from "@/lib/dates";
import { resolveWorkoutLength } from "@/lib/workout-engine/length";
import { accessFromProfile } from "@/lib/workout-engine/equipment";
import { applyDosageAll, loadDosage } from "@/lib/workout-engine/dosage";
import { deriveRestrictions, type ExtendedAnswers } from "@/lib/diagnostics/extended";
import { isMode, type Mode } from "@/lib/modes";
import type {
  ExerciseRow,
  Level,
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

/**
 * «Трудные» упражнения прошлой календарной недели (GIMN-010): пропущены (❌)
 * или отмечены «тяжело» (⚠️) хотя бы дважды. Неделя берётся прошлая, поэтому
 * набор замен стабилен всю текущую неделю — адаптация раз в неделю.
 */
const STRUGGLE_THRESHOLD = 2;

async function strugglingLastWeek(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  dateStr: string,
  mode: Mode,
): Promise<string[]> {
  const thisWeek = weekStartOf(dateStr);
  const { data: workouts } = await supabase
    .from("user_workouts")
    .select("id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .gte("scheduled_date", addDays(thisWeek, -7))
    .lt("scheduled_date", thisWeek);
  const ids = (workouts ?? []).map((w) => w.id);
  if (ids.length === 0) return [];

  const { data: marks } = await supabase
    .from("workout_feedback")
    .select("exercise_id, status")
    .in("user_workout_id", ids)
    .in("status", ["skipped", "difficult"]);

  const counts = new Map<string, number>();
  for (const m of marks ?? []) {
    if (m.exercise_id) counts.set(m.exercise_id, (counts.get(m.exercise_id) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= STRUGGLE_THRESHOLD).map(([id]) => id);
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

  const dateStr = parsed.data.date ?? todayIso();
  const dayOfWeek = dayOfWeekOf(dateStr);

  // Режим определяем ДО поиска готовой тренировки: у каждого режима она своя,
  // иначе переключившийся человек получил бы чужую программу «уже на сегодня».
  const { data: profile } = await supabase
    .from("users")
    .select("mode, workout_length")
    .eq("id", user.id)
    .maybeSingle();

  const mode: Mode = isMode(profile?.mode) ? profile.mode : "general";

  const existing = await supabase
    .from("user_workouts")
    .select("id, status, exercises_snapshot")
    .eq("user_id", user.id)
    .eq("mode", mode)
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

  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("calculated_intensity, pain_areas, blood_pressure_ok, extended_answers")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Углублённая диагностика (GIMN-011): недоступные положения, ограниченные
  // зоны; «давление скачет при нагрузке» — как давление не в норме.
  const restrictions = deriveRestrictions(diagnostics?.extended_answers as ExtendedAnswers | null | undefined);
  const bloodPressureOk = restrictions.bpRisk ? false : (diagnostics?.blood_pressure_ok ?? null);

  const { data: planDay } = await supabase
    .from("user_week_plan")
    .select("focus, intensity, is_rest_day, duration_min")
    .eq("user_id", user.id)
    .eq("mode", mode)
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

  // Весь справочник (50 строк): из него же добираем упражнения до длительности дня.
  const [{ data: exercises }, { data: generalProfile }] = await Promise.all([
    supabase.from("exercises").select("*"),
    supabase
      .from("user_profiles_general")
      // "*": колонка gym_equipment появляется только с миграцией 0021, а
      // деплой кода и миграция не атомарны — перечисление колонок уронило
      // бы весь запрос до её применения (см. user-context.ts).
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  // Снаряжение — вопрос анкеты общего режима (GIMN-014, GIMN-028). Передаём
  // как есть, а отсекает снаряд в режиме Бехтерева сам подбор, по режиму
  // (GIMN-022): анкета общего режима может быть заполнена и у того, кто
  // сейчас занимается по Бехтерева — режимов у человека бывает два сразу.
  const access = accessFromProfile(generalProfile ?? {});

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
    mode,
    intensity,
    painAreas: (diagnostics?.pain_areas as string[] | undefined) ?? [],
    bloodPressureOk,
    excludeExerciseIds,
    excludeJoints,
    access,
  });

  if (built.exercises.length === 0) {
    return fail("Не удалось собрать тренировку: все упражнения отфильтрованы", 409);
  }

  const [length, struggling] = [
    resolveWorkoutLength(profile?.workout_length, mode, diagnostics?.calculated_intensity),
    await strugglingLastWeek(supabase, user.id, dateStr, mode),
  ];

  const snapshot = fitPlanWorkout(built.exercises, {
    pool: (exercises ?? []) as ExerciseRow[],
    mode,
    focus: planDay?.focus ?? sequence.focus_joint,
    targetMin: targetMinutes(
      planDay?.duration_min,
      sequence.total_duration_min,
      planIntensity ?? baseIntensity,
      intensity,
    ),
    intensity,
    difficulty: (generalProfile?.difficulty as Level | undefined) ?? null,
    isRestDay: planDay?.is_rest_day ?? false,
    painAreas: (diagnostics?.pain_areas as string[] | undefined) ?? [],
    bloodPressureOk,
    excludeExerciseIds,
    excludeJoints,
    length,
    struggling,
    restrictions,
    access,
  });

  // Дозировка накладывается последней: подбор решает, ЧТО делать, дозировка —
  // сколько подходов и с каким весом. Для гимнастики строк нет, и занятие
  // остаётся таким, каким его собрал подбор.
  const level = (generalProfile?.difficulty as Level | undefined) ?? "beginner";
  const dosage = await loadDosage(supabase, snapshot.map((e) => e.exercise_id), level, mode);
  const dosed = applyDosageAll(snapshot, dosage);

  const { data: created, error } = await supabase
    .from("user_workouts")
    .insert({
      user_id: user.id,
      mode,
      scheduled_date: dateStr,
      status: "planned",
      generated_from_sequence_id: sequence.id,
      source: "plan",
      exercises_snapshot: dosed,
    })
    .select("id")
    .single();

  if (error) {
    console.error("workout insert failed:", error.message);
    return fail("Не удалось сохранить тренировку", 500);
  }

  return ok({
    workout_id: created.id,
    exercises: dosed,
    total_duration_min: estimateMinutes(dosed),
    focus: planDay?.focus ?? sequence.focus_joint,
    intensity,
    is_rest_day: planDay?.is_rest_day ?? false,
    skipped: built.skipped,
    length,
    reused: false,
  });
}
