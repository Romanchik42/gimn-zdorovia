import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { CatalogExercise } from "@/components/exercise/exercise-browser";
import type { ExerciseRow } from "@/lib/supabase/types";
import { warningText } from "@/lib/workout-engine/custom-builder";
import { loadTrainingContext, type TrainingContext } from "@/lib/workout-engine/user-context";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Каталог упражнений под режим пользователя, с персональными предупреждениями. */
export async function loadCatalog(
  supabase: ServerClient,
  userId: string,
): Promise<{ exercises: CatalogExercise[]; ctx: TrainingContext }> {
  const ctx = await loadTrainingContext(supabase, userId);

  const { data } = await supabase
    .from("exercises")
    .select("*")
    .in("mode", [ctx.mode, "both"])
    .order("name");

  const exercises = ((data ?? []) as ExerciseRow[]).map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    duration_sec: e.duration_sec,
    repetitions: e.repetitions,
    description: e.description,
    technique: e.technique,
    warning: warningText(e, ctx.contraindications),
  }));

  return { exercises, ctx };
}
