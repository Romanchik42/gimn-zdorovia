import { fail, ok, parseBody } from "@/lib/api";
import { workoutFeedbackSchema } from "@/lib/schemas/workout-feedback";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseSnapshot } from "@/lib/supabase/types";

/**
 * POST /api/workout/feedback (SPEC 3.4).
 * Отметка по упражнению. Повторная отметка перезаписывает прежнюю —
 * пользователь может вернуться назад и передумать.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, workoutFeedbackSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { user_workout_id, exercise_id, status, notes } = parsed.data;

  const { data: workout } = await supabase
    .from("user_workouts")
    .select("id, status, exercises_snapshot, started_at")
    .eq("id", user_workout_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workout) return fail("Тренировка не найдена", 404);

  const { error } = await supabase.from("workout_feedback").upsert(
    {
      user_id: user.id,
      user_workout_id,
      exercise_id,
      status,
      notes: notes ?? null,
    },
    { onConflict: "user_workout_id,exercise_id" },
  );

  if (error) {
    console.error("feedback upsert failed:", error.message);
    return fail("Не удалось сохранить отметку", 500);
  }

  // Первая отметка переводит тренировку в работу — так частичная сохраняется.
  if (workout.status === "planned") {
    await supabase
      .from("user_workouts")
      .update({ status: "in_progress", started_at: workout.started_at ?? new Date().toISOString() })
      .eq("id", user_workout_id);
  }

  const snapshot = (workout.exercises_snapshot ?? []) as ExerciseSnapshot[];

  const { count } = await supabase
    .from("workout_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_workout_id", user_workout_id);

  const marked = count ?? 0;
  const total = snapshot.length;
  const isComplete = total > 0 && marked >= total;

  if (isComplete) {
    await supabase
      .from("user_workouts")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", user_workout_id);
  }

  // Для «⚠️ Плохо» клиент отдельно откроет модалку симптомов (US-04).
  return ok({
    marked,
    total,
    is_complete: isComplete,
    needs_symptom_check: status === "difficult",
  });
}
