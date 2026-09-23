import { fail, ok, parseBody } from "@/lib/api";
import { workoutSetSchema } from "@/lib/schemas/workout-sets";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";

/**
 * POST /api/workout/sets — записать выполненный подход (GIMN-028).
 *
 * Перезапись, а не добавление: человек правит подход прямо во время
 * занятия — ошибся в повторах, поднял вес. Уникальный ключ
 * (пользователь, упражнение, дата, номер подхода) делает повторную
 * отправку исправлением, а не второй записью.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, workoutSetSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const input = parsed.data;

  const { data, error } = await supabase
    .from("workout_sets")
    .upsert(
      {
        user_id: user.id,
        user_workout_id: input.user_workout_id ?? null,
        exercise_id: input.exercise_id,
        date: input.date ?? todayIso(),
        set_number: input.set_number,
        reps: input.reps,
        weight_kg: input.weight_kg ?? null,
        rpe: input.rpe ?? null,
      },
      { onConflict: "user_id,exercise_id,date,set_number" },
    )
    .select("id")
    .single();

  if (error) {
    console.error("workout set upsert failed:", error.message);
    return fail("Не удалось записать подход", 500);
  }

  return ok({ id: data.id });
}

/**
 * GET /api/workout/sets?exercise_id=… — последние подходы по упражнению.
 * Нужен карточке: показать, с чего человек начинал в прошлый раз.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const exerciseId = new URL(request.url).searchParams.get("exercise_id");
  if (!exerciseId) return fail("Не указано упражнение", 400);

  const { data, error } = await supabase
    .from("workout_sets")
    .select("id, date, set_number, reps, weight_kg, rpe")
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId)
    .order("date", { ascending: false })
    .order("set_number", { ascending: true })
    .limit(30);

  if (error) {
    console.error("workout sets load failed:", error.message);
    return fail("Не удалось загрузить подходы", 500);
  }

  return ok({ sets: data ?? [] });
}
