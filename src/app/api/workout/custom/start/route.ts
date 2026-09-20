import { fail, ok, parseBody } from "@/lib/api";
import { customStartSchema } from "@/lib/schemas/workout";
import { createClient } from "@/lib/supabase/server";
import { snapshotFrom } from "@/lib/workout-engine/custom-builder";
import { estimateMinutes } from "@/lib/workout-engine/generator";
import { loadTrainingContext } from "@/lib/workout-engine/user-context";
import { todayIso } from "@/lib/dates";
import type { ExerciseRow } from "@/lib/supabase/types";

/**
 * POST /api/workout/custom/start — «Начать сейчас» из конструктора или шаблона.
 * Порядок и дозировку берём из тела как есть: это решение пользователя.
 * Упражнения перечитываем из БД, чтобы в снимок не попали данные с клиента.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, customStartSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const items = [...parsed.data.exercises_order].sort((a, b) => a.order - b.order);
  const ids = [...new Set(items.map((i) => i.exercise_id))];

  const { data: rows } = await supabase.from("exercises").select("*").in("id", ids);
  const byId = new Map(((rows ?? []) as ExerciseRow[]).map((e) => [e.id, e]));

  const ctx = await loadTrainingContext(supabase, user.id);

  const snapshot = items
    .filter((i) => byId.has(i.exercise_id))
    .map((i, index) =>
      snapshotFrom(
        byId.get(i.exercise_id)!,
        index + 1,
        { duration_sec: i.duration_sec, repetitions: i.repetitions, rest_sec: i.rest_sec },
        ctx.contraindications,
      ),
    );

  if (snapshot.length === 0) return fail("Упражнения не найдены", 404);

  const templateId = parsed.data.custom_workout_id ?? null;

  const { data, error } = await supabase
    .from("user_workouts")
    .insert({
      user_id: user.id,
      mode: ctx.mode,
      scheduled_date: todayIso(),
      status: "planned",
      source: templateId ? "template" : "custom",
      custom_workout_id: templateId,
      exercises_snapshot: snapshot,
    })
    .select("id")
    .single();

  if (error) {
    console.error("custom start insert failed:", error.message);
    return fail("Не удалось начать тренировку", 500);
  }

  if (templateId) {
    const { data: tpl } = await supabase
      .from("user_custom_workouts")
      .select("times_used")
      .eq("id", templateId)
      .maybeSingle();

    await supabase
      .from("user_custom_workouts")
      .update({ times_used: (tpl?.times_used ?? 0) + 1, last_used_at: new Date().toISOString() })
      .eq("id", templateId);
  }

  return ok({ workout_id: data.id, total_duration_min: estimateMinutes(snapshot) });
}
