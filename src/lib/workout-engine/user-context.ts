import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { contraindicationsFor } from "@/lib/workout-engine/generator";
import { accessFromProfile, type EquipmentAccess } from "@/lib/workout-engine/equipment";
import type { Level, Mode } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type TrainingContext = {
  mode: Mode;
  difficulty: Level | null;
  /** Метки противопоказаний по последней диагностике. */
  contraindications: string[];
  /** Снаряжение человека (GIMN-028). Вопрос только у общего режима. */
  access: EquipmentAccess;
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
    supabase
      .from("user_profiles_general")
      // "*" вместо перечисления колонок намеренно: деплой кода и применение
      // миграции 0021 не атомарны, а запрос с ещё не существующей колонкой
      // gym_equipment вернул бы ошибку целиком — вместе с difficulty и
      // has_turnik. Тогда у тех, кто уже занимается, снаряд и уровень
      // молча обнулились бы до применения миграции.
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  return {
    mode: profile?.mode ?? "general",
    difficulty: general?.difficulty ?? null,
    access: accessFromProfile(general ?? {}),
    contraindications: contraindicationsFor(
      (diagnostics?.pain_areas as string[] | undefined) ?? [],
      diagnostics?.blood_pressure_ok ?? null,
    ),
  };
}
