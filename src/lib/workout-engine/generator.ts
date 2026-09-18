import "server-only";

import type {
  ExerciseRow,
  ExerciseSnapshot,
  SequenceIntensity,
  SequenceItem,
} from "@/lib/supabase/types";

/**
 * Сборка тренировки из шаблона последовательности (SPEC 3.3).
 * Порядок в шаблоне не пересортировываем: дыхание → разминка и массаж →
 * основное → растяжка задан заранее и является частью методики (SPEC 5.4).
 */

/**
 * Соответствие «зона боли → метка противопоказания».
 * Упражнение отфильтровывается, если у пользователя болит зона,
 * для которой у упражнения проставлено противопоказание.
 */
const PAIN_TO_CONTRAINDICATION: Record<string, string[]> = {
  neck: ["acute_neck_pain"],
  shoulder: ["shoulder_pain"],
  spine_thoracic: ["acute_back_pain"],
  spine_lumbar: ["acute_back_pain"],
  hips: ["knee_pain"],
  legs: ["knee_pain"],
};

/** Противопоказания, не зависящие от зон боли. */
export function healthContraindications(bloodPressureOk: boolean | null | undefined): string[] {
  return bloodPressureOk === false ? ["high_blood_pressure"] : [];
}

export function contraindicationsFor(
  painAreas: string[],
  bloodPressureOk: boolean | null | undefined,
): string[] {
  const set = new Set<string>(healthContraindications(bloodPressureOk));
  for (const area of painAreas) {
    for (const tag of PAIN_TO_CONTRAINDICATION[area] ?? []) set.add(tag);
  }
  return [...set];
}

export function isContraindicated(exercise: ExerciseRow, blocked: string[]): boolean {
  if (blocked.length === 0) return false;
  return (exercise.contraindications ?? []).some((c) => blocked.includes(c));
}

/** Коэффициент объёма нагрузки по интенсивности. */
const INTENSITY_FACTOR: Record<SequenceIntensity, number> = {
  low: 0.7,
  medium: 0.85,
  normal: 1,
};

function scale(value: number | null | undefined, factor: number, min: number): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(min, Math.round(value * factor));
}

export type BuildArgs = {
  items: SequenceItem[];
  exercisesBySlug: Map<string, ExerciseRow>;
  intensity: SequenceIntensity;
  painAreas?: string[];
  bloodPressureOk?: boolean | null;
  /** Упражнения, исключённые Decision Tree после побочек. */
  excludeExerciseIds?: string[];
};

export type BuildResult = {
  exercises: ExerciseSnapshot[];
  skipped: { slug: string; reason: string }[];
  totalDurationMin: number;
};

export function buildWorkout(args: BuildArgs): BuildResult {
  const blocked = contraindicationsFor(args.painAreas ?? [], args.bloodPressureOk);
  const factor = INTENSITY_FACTOR[args.intensity];
  const exclude = new Set(args.excludeExerciseIds ?? []);

  const exercises: ExerciseSnapshot[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  const ordered = [...args.items].sort((a, b) => a.order - b.order);

  for (const item of ordered) {
    const exercise = args.exercisesBySlug.get(item.slug);

    if (!exercise) {
      skipped.push({ slug: item.slug, reason: "упражнения нет в справочнике" });
      continue;
    }

    if (exclude.has(exercise.id)) {
      skipped.push({ slug: item.slug, reason: "исключено после побочного эффекта" });
      continue;
    }

    if (isContraindicated(exercise, blocked)) {
      skipped.push({ slug: item.slug, reason: "противопоказано по диагностике" });
      continue;
    }

    // Значения из шаблона приоритетнее справочника: шаблон задаёт дозировку дня.
    const durationSec = item.duration_sec ?? exercise.duration_sec;
    const repetitions = item.repetitions ?? exercise.repetitions;

    exercises.push({
      exercise_id: exercise.id,
      slug: exercise.slug,
      name: exercise.name,
      type: exercise.type,
      target_joint: exercise.target_joint,
      description: exercise.description,
      technique: exercise.technique,
      gif_url: exercise.gif_url,
      duration_sec: scale(durationSec, factor, 15),
      repetitions: scale(repetitions, factor, 4),
      order: exercises.length + 1,
      warning: warningFor(exercise, blocked),
    });
  }

  return { exercises, skipped, totalDurationMin: estimateMinutes(exercises) };
}

/**
 * Предупреждение показывается, когда упражнение не заблокировано,
 * но у пользователя есть повод к нему присмотреться.
 */
function warningFor(exercise: ExerciseRow, blocked: string[]): string | null {
  const risky = (exercise.contraindications ?? []).filter((c) => !blocked.includes(c));
  if (risky.length === 0) return null;

  const labels: Record<string, string> = {
    high_blood_pressure: "повышенном давлении",
    shoulder_pain: "боли в плече",
    knee_pain: "боли в колене",
    acute_back_pain: "острой боли в спине",
    acute_neck_pain: "острой боли в шее",
  };

  const names = risky.map((c) => labels[c] ?? c);
  return `Осторожно при ${names.join(", ")}`;
}

/** Оценка длительности: время + ~4 секунды на повтор + пауза между упражнениями. */
export function estimateMinutes(exercises: ExerciseSnapshot[]): number {
  const seconds = exercises.reduce((total, e) => {
    const own = e.duration_sec ?? (e.repetitions ?? 0) * 4;
    return total + own + 15;
  }, 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Сдвиг интенсивности после побочек (SPEC 5.2). */
export function applyAdjustment(
  base: SequenceIntensity,
  adjustment: string | null | undefined,
): SequenceIntensity {
  const order: SequenceIntensity[] = ["low", "medium", "normal"];
  const index = order.indexOf(base);

  switch (adjustment) {
    case "lighter_only":
      return "low";
    case "reduce_intensity_20":
      return order[Math.max(0, index - 1)];
    case "reduce_intensity_10":
      return base === "normal" ? "medium" : base;
    default:
      return base;
  }
}
