import "server-only";

import type { createClient } from "@/lib/supabase/server";
import type { ExerciseDosageRow, ExerciseSnapshot, Level, Mode } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Дозировка упражнений (GIMN-028).
 *
 * Справочник exercises говорит, что делать вообще; exercise_dosage — сколько
 * именно, для этого уровня и режима. Разделено потому, что одно и то же
 * приседание новичку назначается 3×8, а продвинутому 5×5: это не разные
 * упражнения, а разная дозировка одного.
 *
 * Строки может не быть — у гимнастических упражнений её и нет. Тогда
 * остаётся дозировка из самого справочника: время или повторы.
 */

export type DosageMap = Map<string, ExerciseDosageRow>;

/**
 * Дозировки для набора упражнений под уровень и режим.
 *
 * Таблица появляется миграцией 0023, а деплой кода и миграция не атомарны —
 * до её применения запрос вернёт ошибку. Это не повод ронять тренировку:
 * без дозировки занятие просто соберётся по-старому, временем и повторами.
 */
export async function loadDosage(
  supabase: ServerClient,
  exerciseIds: string[],
  level: Level,
  mode: Mode,
): Promise<DosageMap> {
  if (exerciseIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("exercise_dosage")
    .select("*")
    .in("exercise_id", exerciseIds)
    .eq("level", level)
    .eq("mode", mode);

  if (error) {
    console.error("dosage load failed:", error.message);
    return new Map();
  }

  return new Map((data ?? []).map((row) => [row.exercise_id, row as ExerciseDosageRow]));
}

/**
 * Накладывает дозировку на упражнение занятия.
 *
 * Силовая дозировка вытесняет гимнастическую: если заданы подходы, поля
 * duration_sec и repetitions в карточке перестают что-то значить, и
 * оставлять их — значит показать человеку два разных назначения сразу.
 */
export function applyDosage(snapshot: ExerciseSnapshot, dosage: ExerciseDosageRow | undefined): ExerciseSnapshot {
  if (!dosage) return snapshot;

  if (dosage.sets && dosage.sets > 0) {
    return {
      ...snapshot,
      duration_sec: null,
      repetitions: dosage.reps_per_set ?? dosage.repetitions,
      sets: dosage.sets,
      reps_per_set: dosage.reps_per_set,
      rest_between_sets_sec: dosage.rest_between_sets_sec,
      weight_kg: dosage.weight_kg_default,
      rest_sec: dosage.rest_sec ?? snapshot.rest_sec,
    };
  }

  return {
    ...snapshot,
    duration_sec: dosage.duration_sec ?? snapshot.duration_sec,
    repetitions: dosage.repetitions ?? snapshot.repetitions,
    rest_sec: dosage.rest_sec ?? snapshot.rest_sec,
  };
}

/** Накладывает дозировки на всё занятие разом. */
export function applyDosageAll(exercises: ExerciseSnapshot[], dosage: DosageMap): ExerciseSnapshot[] {
  if (dosage.size === 0) return exercises;
  return exercises.map((e) => applyDosage(e, dosage.get(e.exercise_id)));
}
