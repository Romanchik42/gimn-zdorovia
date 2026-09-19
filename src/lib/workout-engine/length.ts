import type { ExerciseSnapshot, Mode, WorkoutLength } from "@/lib/supabase/types";

/**
 * Длина занятия (GIMN-010). Полное — весь план дня; короткое и среднее —
 * меньше упражнений, но структура остаётся: дыхание → разминка → основное →
 * растяжка есть всегда. Перегруз опаснее, чем недобор: при тяжёлой
 * диагностике начинаем с короткого.
 */

/** Сколько упражнений в каждой части. closing — финальное дыхание-заминка. */
const QUOTAS: Record<Exclude<WorkoutLength, "full">, Record<Part | "closing", number>> = {
  short: { breathing: 1, warmup: 1, main: 2, stretch: 1, closing: 0 },
  medium: { breathing: 1, warmup: 2, main: 3, stretch: 1, closing: 1 },
};

const TARGET: Record<Exclude<WorkoutLength, "full">, number> = { short: 5, medium: 8 };

type Part = "breathing" | "warmup" | "main" | "stretch";

function partOf(e: ExerciseSnapshot): Part {
  // Самомассаж по методике — часть разминки.
  return e.type === "massage" ? "warmup" : (e.type as Part);
}

/** Длина по умолчанию, пока человек не выбрал сам. */
export function defaultWorkoutLength(mode: Mode, calculatedIntensity: string | null | undefined): WorkoutLength {
  return mode === "behtereva" && calculatedIntensity === "low" ? "short" : "medium";
}

export function resolveWorkoutLength(
  chosen: WorkoutLength | null | undefined,
  mode: Mode,
  calculatedIntensity: string | null | undefined,
): WorkoutLength {
  return chosen ?? defaultWorkoutLength(mode, calculatedIntensity);
}

/**
 * Режет занятие под длину, не меняя порядок: из каждой части берём первые
 * упражнения (шаблонные идут раньше добранных — они ближе к методике).
 */
export function cutToLength(exercises: ExerciseSnapshot[], length: WorkoutLength): ExerciseSnapshot[] {
  if (length === "full") return exercises;

  const quota = { ...QUOTAS[length] };
  const target = TARGET[length];
  if (exercises.length <= target) return exercises;

  const last = exercises.length - 1;
  const closingIndex = last > 0 && exercises[last].type === "breathing" ? last : -1;
  // Заминки нет — её место отдаём основной части.
  if (closingIndex < 0 && quota.closing > 0) {
    quota.main += quota.closing;
    quota.closing = 0;
  }

  const chosen = new Set<number>();
  if (closingIndex >= 0 && quota.closing > 0) chosen.add(closingIndex);

  // Два прохода: сначала приоритетные (щадящие для ограниченных зон по
  // углублённой диагностике), потом остальные — порядок в занятии не меняется.
  const taken: Record<Part, number> = { breathing: 0, warmup: 0, main: 0, stretch: 0 };
  for (const wantPriority of [true, false]) {
    exercises.forEach((e, i) => {
      if (i === closingIndex || chosen.has(i) || Boolean(e.priority) !== wantPriority) return;
      const part = partOf(e);
      if (taken[part] < quota[part]) {
        taken[part]++;
        chosen.add(i);
      } else if (wantPriority && part !== "main" && taken.main < quota.main - 1) {
        // Щадящему для ограниченной зоны не хватило места в своей части —
        // отдаём ему место основной: для этой зоны оно и есть основная работа.
        taken.main++;
        chosen.add(i);
      }
    });
  }

  // В шаблоне дыхание бывает только заминкой в конце — тогда оно и есть
  // дыхательная часть: без него структура занятия неполная.
  if (taken.breathing === 0 && closingIndex >= 0) chosen.add(closingIndex);

  // Какой-то части не хватило (день отдыха, всё отфильтровано) — добираем
  // по порядку остальным, чтобы число упражнений было честным.
  for (let i = 0; i < exercises.length && chosen.size < target; i++) {
    if (i !== closingIndex) chosen.add(i);
  }

  return exercises.filter((_, i) => chosen.has(i)).map((e, i) => ({ ...e, order: i + 1 }));
}
