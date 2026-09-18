import { fail, ok, parseBody } from "@/lib/api";
import { sideEffectSchema } from "@/lib/schemas/workout-feedback";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseRow, SideEffectRuleRow } from "@/lib/supabase/types";

/**
 * POST /api/workout/side-effect (US-04, SPEC 5.2).
 * Правила берутся из side_effect_rules в БД, а не из кода, — чтобы их
 * можно было править без деплоя.
 */

/** Окно для правила «покажись врачу». */
const DOCTOR_WINDOW_DAYS = 7;

export async function POST(request: Request) {
  const parsed = await parseBody(request, sideEffectSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { user_workout_id, exercise_id, symptom, description, action_taken } = parsed.data;

  let exercise: ExerciseRow | null = null;
  if (exercise_id) {
    const { data } = await supabase.from("exercises").select("*").eq("id", exercise_id).maybeSingle();
    exercise = (data as ExerciseRow | null) ?? null;
  }

  const { data: rulesData } = await supabase
    .from("side_effect_rules")
    .select("*")
    .eq("symptom", symptom)
    .order("priority", { ascending: true });

  const rules = (rulesData ?? []) as SideEffectRuleRow[];
  const rule = pickRule(rules, exercise);

  if (!rule) {
    return fail("Для этого симптома не настроено правило. Проверьте, применён ли seed.", 404);
  }

  const { error } = await supabase.from("side_effect_events").insert({
    user_id: user.id,
    user_workout_id,
    exercise_id: exercise_id ?? null,
    symptom,
    description: description ?? null,
    action_taken,
    applied_adjustment: rule.next_workout_adjustment,
  });

  if (error) {
    console.error("side effect insert failed:", error.message);
    return fail("Не удалось сохранить сообщение", 500);
  }

  // «Просто тяжело» — не побочка, в счётчик для врача не идёт (US-04).
  const since = new Date(Date.now() - DOCTOR_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("side_effect_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("symptom", "just_hard")
    .gte("created_at", since);

  const recentCount = count ?? 0;
  const showDoctorBanner =
    symptom !== "just_hard" && recentCount >= rule.require_doctor_visit_threshold;

  return ok({
    advice: [...(rule.advice ?? [])].sort((a, b) => a.order - b.order),
    next_workout_adjustment: rule.next_workout_adjustment,
    skip_exercise: rule.skip_exercise,
    recent_events: recentCount,
    show_doctor_banner: showDoctorBanner,
    doctor_message: showDoctorBanner
      ? "За неделю вы несколько раз отмечали плохое самочувствие. Рекомендуем консультацию врача-ревматолога."
      : null,
  });
}

/**
 * Выбирает самое конкретное подходящее правило.
 * Правила с непустыми conditions приоритетнее общих — они уже отсортированы
 * по priority, поэтому берём первое, чьи условия совпали.
 */
function pickRule(rules: SideEffectRuleRow[], exercise: ExerciseRow | null): SideEffectRuleRow | null {
  const matches = rules.filter((r) => {
    const c = r.conditions ?? {};
    if (c.exercise_type && c.exercise_type !== exercise?.type) return false;
    if (c.target_joint && c.target_joint !== exercise?.target_joint) return false;
    return true;
  });

  if (matches.length === 0) return null;

  // Специфичные (с условиями) выигрывают у общих при равном priority.
  matches.sort((a, b) => {
    const specA = Object.keys(a.conditions ?? {}).length;
    const specB = Object.keys(b.conditions ?? {}).length;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return specB - specA;
  });

  return matches[0];
}
