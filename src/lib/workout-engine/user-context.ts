import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { contraindicationsFor } from "@/lib/workout-engine/generator";
import type { Level, Mode } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type TrainingContext = {
  mode: Mode;
  difficulty: Level | null;
  /** Метки противопоказаний по последней диагностике. */
  contraindications: string[];
};

/** Режим, уровень и противопоказания пользователя — одним запросом на источник. */
export async function loadTrainingContext(
  supabase: ServerClient,
  userId: string,
): Promise<TrainingContext> {
  const [{ data: profile }, { data: diagnostics }, { data: general }] = await Promise.all([
    supabase.from("users").select("mode").eq("id", userId).maybeSingle(),
    supabase
      .from("user_diagnostics")
      .select("pain_areas, blood_pressure_ok")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("user_profiles_general").select("difficulty").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    mode: profile?.mode ?? "general",
    difficulty: general?.difficulty ?? null,
    contraindications: contraindicationsFor(
      (diagnostics?.pain_areas as string[] | undefined) ?? [],
      diagnostics?.blood_pressure_ok ?? null,
    ),
  };
}
