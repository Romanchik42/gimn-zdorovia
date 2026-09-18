import { fail, ok, parseBody } from "@/lib/api";
import { customBuildSchema } from "@/lib/schemas/workout";
import { createClient } from "@/lib/supabase/server";
import { buildCustomWorkout } from "@/lib/workout-engine/custom-builder";
import { loadTrainingContext } from "@/lib/workout-engine/user-context";
import type { ExerciseRow } from "@/lib/supabase/types";

/**
 * POST /api/workout/custom (SPEC 3.1).
 * Только собирает черновик — в БД ничего не пишет. Запись появляется,
 * когда пользователь жмёт «Начать сейчас» или «Сохранить как шаблон».
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, customBuildSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const ctx = await loadTrainingContext(supabase, user.id);

  // Берём весь справочник: фильтр по режиму делает сборщик, а дыхание и
  // растяжку при нехватке он добирает из соседнего режима.
  const { data: pool, error } = await supabase.from("exercises").select("*").order("slug");

  if (error) return fail("Не удалось загрузить упражнения", 500);

  const built = buildCustomWorkout({
    pool: (pool ?? []) as ExerciseRow[],
    mode: ctx.mode,
    focus: parsed.data.focus,
    durationMin: parsed.data.duration_min,
    intensity: parsed.data.intensity,
    difficulty: ctx.difficulty,
    userContraindications: ctx.contraindications,
  });

  if (built.exercises.length === 0) {
    return fail("Под эти параметры не нашлось упражнений. Попробуйте другой фокус.", 404);
  }

  return ok({
    exercises: built.exercises,
    total_duration_min: built.totalDurationMin,
  });
}
