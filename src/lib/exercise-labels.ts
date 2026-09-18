import type { ExerciseType, TargetJoint } from "@/lib/supabase/types";

/** Подписи справочника упражнений — единый источник для карточки, каталога и конструктора. */

export const EXERCISE_TYPES: ExerciseType[] = ["breathing", "warmup", "massage", "main", "stretch"];

export const TYPE_LABELS: Record<ExerciseType, string> = {
  breathing: "Дыхание",
  warmup: "Разминка",
  main: "Основное",
  stretch: "Растяжка",
  massage: "Самомассаж",
};

export const TARGET_JOINTS: TargetJoint[] = [
  "spine",
  "neck",
  "shoulder",
  "core",
  "hips",
  "legs",
  "full_body",
];

export const JOINT_LABELS: Record<TargetJoint, string> = {
  spine: "Позвоночник",
  neck: "Шея",
  shoulder: "Плечи",
  core: "Кор",
  hips: "Таз",
  legs: "Ноги",
  full_body: "Всё тело",
};

export function formatSeconds(sec: number): string {
  if (sec < 60) return `${sec} сек`;
  const min = Math.floor(sec / 60);
  const rest = sec % 60;
  return rest ? `${min} мин ${rest} сек` : `${min} мин`;
}

/** «Основное · 30 сек» / «Разминка · 12 повторов». */
export function exerciseMeta(e: {
  type: ExerciseType;
  duration_sec: number | null;
  repetitions: number | null;
  rest_sec?: number | null;
}): string {
  const parts = [TYPE_LABELS[e.type] ?? e.type];
  if (e.duration_sec) parts.push(formatSeconds(e.duration_sec));
  else if (e.repetitions) parts.push(`${e.repetitions} повторов`);
  // Стандартную короткую паузу не показываем — это шум.
  if (e.rest_sec && e.rest_sec > 15) parts.push(`отдых ${formatSeconds(e.rest_sec)}`);
  return parts.join(" · ");
}
