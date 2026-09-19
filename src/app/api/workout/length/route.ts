import { fail, parseBody } from "@/lib/api";
import { changeWorkoutLengthSchema } from "@/lib/schemas/workout";
import { createClient } from "@/lib/supabase/server";
import { POST as generateWorkout } from "@/app/api/workout/generate/route";

/**
 * POST /api/workout/length — «Сколько сегодня потянете?» перед стартом (GIMN-010).
 *
 * Запоминает выбор в профиле и пересобирает сегодняшнюю тренировку. Менять
 * можно только до первой отметки: начатое занятие не перекраиваем.
 * Сборку делает тот же обработчик, что и обычная генерация, — логика одна.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, changeWorkoutLengthSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const { workout_id, length } = parsed.data;

  const { data: workout } = await supabase
    .from("user_workouts")
    .select("id, scheduled_date, status, source")
    .eq("id", workout_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workout) return fail("Тренировка не найдена", 404);
  if (workout.source !== "plan") return fail("Длину можно менять только у тренировки из плана", 400);
  if (workout.status !== "planned" && workout.status !== "in_progress") {
    return fail("Эта тренировка уже завершена", 409);
  }

  const { count } = await supabase
    .from("workout_feedback")
    .select("id", { count: "exact", head: true })
    .eq("user_workout_id", workout.id);
  if ((count ?? 0) > 0) return fail("Занятие уже началось — длину поменять нельзя", 409);

  const { error: saveError } = await supabase.from("users").update({ workout_length: length }).eq("id", user.id);
  if (saveError) {
    console.error("workout length save failed:", saveError.message);
    return fail("Не удалось сохранить выбор", 500);
  }

  const { error: deleteError } = await supabase.from("user_workouts").delete().eq("id", workout.id);
  if (deleteError) {
    console.error("workout delete failed:", deleteError.message);
    return fail("Не удалось пересобрать тренировку", 500);
  }

  return generateWorkout(
    new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: workout.scheduled_date }),
    }),
  );
}
