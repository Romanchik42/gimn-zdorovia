import { fail, ok, parseBody } from "@/lib/api";
import { levelUpAnswerSchema } from "@/lib/schemas/progression";
import { createClient } from "@/lib/supabase/server";
import { evaluateLevelUp, levelMetrics, nextLevel, type ProgressSet } from "@/lib/progression/level-check";
import { todayIso } from "@/lib/dates";

/**
 * POST /api/progression/level-up — ответ на предложение уровня (GIMN-028).
 *
 * Уровень меняется только отсюда и только вверх: согласие человека —
 * обязательное условие, а понижение остаётся ручным, в настройках.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, levelUpAnswerSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const { data: profile } = await supabase
    .from("user_profiles_general")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) return fail("Анкета не заполнена", 404);

  // Отказ: ничего не меняем. Отметка о показе уже стоит — вопрос вернётся
  // не раньше чем через неделю, и то если условия всё ещё выполняются.
  if (!parsed.data.accept) return ok({ level: profile.difficulty, changed: false });

  const next = nextLevel(profile.difficulty);
  if (!next) return fail("Уровень уже максимальный", 400);

  // Условия перепроверяем на сервере: до этой строки согласие — это всего
  // лишь POST, который можно отправить и без всякой модалки.
  const { data: sets } = await supabase
    .from("workout_sets")
    .select("date, exercise_id, reps, weight_kg")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1000);

  const check = evaluateLevelUp(profile.difficulty, levelMetrics((sets ?? []) as ProgressSet[], todayIso()));
  if (!check.eligible) return fail(`Пока рано: ${check.reason.toLowerCase()}`, 400);

  const { error } = await supabase
    .from("user_profiles_general")
    .update({ difficulty: next })
    .eq("user_id", user.id);

  if (error) {
    console.error("level up failed:", error.message);
    return fail("Не удалось сменить уровень", 500);
  }

  return ok({ level: next, changed: true });
}
