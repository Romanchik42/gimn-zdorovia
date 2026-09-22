import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { CatalogExercise } from "@/components/exercise/exercise-browser";
import type { ExerciseRow } from "@/lib/supabase/types";
import { warningText } from "@/lib/workout-engine/custom-builder";
import { equipmentAvailable, equipmentHint } from "@/lib/workout-engine/equipment";
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

  // Упражнения со снарядом, которого у человека нет, в каталог не попадают
  // (GIMN-014): в отличие от противопоказания, это не «осторожно», а «нечем».
  const exercises = ((data ?? []) as ExerciseRow[])
    .filter((e) => equipmentAvailable(e.equipment, ctx.hasTurnik))
    .map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      type: e.type,
      target_joint: e.target_joint,
      duration_sec: e.duration_sec,
      repetitions: e.repetitions,
      description: e.description,
      technique: e.technique,
      gif_url: e.gif_url,
      image_url: e.image_url,
      image_credit: e.image_credit,
      equipment: e.equipment,
      equipment_hint: equipmentHint(e.equipment),
      warning: warningText(e, ctx.contraindications),
    }));

  return { exercises, ctx };
}
