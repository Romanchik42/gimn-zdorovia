import type { Intensity, Mode } from "@/lib/supabase/types";

/**
 * Рекомендуемые недельные циклы (SPEC 5.4).
 * Это ТОЛЬКО стартовая раскладка: при онбординге она копируется
 * в user_week_plan, дальше пользователь правит её на /app/plan (US-06).
 */

export type WeekPlanDay = {
  day_of_week: number;
  focus: string;
  duration_min: number;
  intensity: Intensity;
  is_rest_day: boolean;
};

/** Человекочитаемые названия фокусов — единый источник для всего UI. */
export const FOCUS_LABELS: Record<string, string> = {
  spine: "Позвоночник (общий)",
  spine_thoracic: "Позвоночник (грудной отдел)",
  spine_lumbar: "Позвоночник (поясница)",
  shoulder: "Плечи и руки",
  neck: "Шея",
  hips: "Ноги и таз",
  legs: "Ноги",
  core: "Кардио и пресс",
  full_body: "Всё тело",
  chest: "Грудь и трицепс",
  arms: "Руки",
  back: "Спина",
  breathing: "Отдых и дыхание",
  stretch: "Отдых и растяжка",
};

export function focusLabel(focus: string): string {
  return FOCUS_LABELS[focus] ?? focus;
}

export const DAY_NAMES = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const DAY_NAMES_FULL = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
] as const;

export function dayName(dayOfWeek: number, full = false): string {
  const idx = Math.min(Math.max(dayOfWeek, 1), 7) - 1;
  return full ? DAY_NAMES_FULL[idx] : DAY_NAMES[idx];
}

/** Понедельник = 1 … воскресенье = 7 (в JS getDay() воскресенье = 0). */
export function isoDayOfWeek(date: Date): number {
  const js = date.getDay();
  return js === 0 ? 7 : js;
}

const BEHTEREVA: WeekPlanDay[] = [
  { day_of_week: 1, focus: "spine", duration_min: 45, intensity: "medium", is_rest_day: false },
  { day_of_week: 2, focus: "shoulder", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 3, focus: "spine_thoracic", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 4, focus: "hips", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 5, focus: "spine_lumbar", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 6, focus: "full_body", duration_min: 35, intensity: "low", is_rest_day: false },
  { day_of_week: 7, focus: "breathing", duration_min: 12, intensity: "low", is_rest_day: true },
];

const GENERAL: WeekPlanDay[] = [
  { day_of_week: 1, focus: "legs", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 2, focus: "back", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 3, focus: "chest", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 4, focus: "core", duration_min: 35, intensity: "medium", is_rest_day: false },
  { day_of_week: 5, focus: "shoulder", duration_min: 40, intensity: "medium", is_rest_day: false },
  { day_of_week: 6, focus: "full_body", duration_min: 45, intensity: "medium", is_rest_day: false },
  { day_of_week: 7, focus: "stretch", duration_min: 20, intensity: "low", is_rest_day: true },
];

export const DEFAULT_WEEK_PLAN: Record<Mode, WeekPlanDay[]> = {
  behtereva: BEHTEREVA,
  general: GENERAL,
};

/**
 * Предупреждения при ручном редактировании плана (US-06).
 * Мы ПРЕДУПРЕЖДАЕМ, но не блокируем — это план пользователя, не наш.
 */
export function validateWeekPlan(days: WeekPlanDay[]): string[] {
  const warnings: string[] = [];
  const sorted = [...days].sort((a, b) => a.day_of_week - b.day_of_week);

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (!prev.is_rest_day && !cur.is_rest_day && prev.focus === cur.focus) {
      warnings.push(
        `${dayName(prev.day_of_week)} и ${dayName(cur.day_of_week)} — одна и та же группа подряд (${focusLabel(cur.focus)}). Мышцам нужно время на восстановление.`,
      );
    }
  }

  if (!sorted.some((d) => d.is_rest_day)) {
    warnings.push("В плане нет ни одного дня отдыха. Хотя бы один день в неделю стоит оставить на восстановление.");
  }

  return warnings;
}

/** Фокусы, из которых можно собрать план в каждом режиме (US-06). */
export const PLAN_FOCUSES: Record<Mode, string[]> = {
  behtereva: ["spine", "spine_thoracic", "spine_lumbar", "shoulder", "neck", "hips", "full_body", "breathing"],
  general: ["legs", "back", "chest", "core", "shoulder", "arms", "full_body", "stretch"],
};

/**
 * Какой шаблон последовательности (workout_sequences.slug) отвечает фокусу дня.
 * Шаблон выбирается по фокусу из плана пользователя, а не по дню недели:
 * иначе правка плана («в понедельник — ноги») ничего бы не меняла в тренировке.
 */
const FOCUS_TO_SEQUENCE: Record<Mode, Record<string, string>> = {
  behtereva: {
    spine: "beh-mon-spine",
    shoulder: "beh-tue-shoulders",
    neck: "beh-tue-shoulders",
    spine_thoracic: "beh-wed-thoracic",
    hips: "beh-thu-legs-hips",
    legs: "beh-thu-legs-hips",
    spine_lumbar: "beh-fri-lumbar",
    full_body: "beh-sat-combined",
    breathing: "beh-sun-rest",
    stretch: "beh-sun-rest",
  },
  general: {
    legs: "gen-mon-legs",
    hips: "gen-mon-legs",
    back: "gen-tue-back",
    spine: "gen-tue-back",
    chest: "gen-wed-chest",
    core: "gen-thu-cardio-core",
    shoulder: "gen-fri-shoulders",
    arms: "gen-fri-shoulders",
    full_body: "gen-sat-full",
    stretch: "gen-sun-rest",
    breathing: "gen-sun-rest",
  },
};

const REST_SEQUENCE: Record<Mode, string> = {
  behtereva: "beh-sun-rest",
  general: "gen-sun-rest",
};

/** slug шаблона под день плана или null — тогда берём шаблон по дню недели. */
export function resolveSequenceSlug(
  mode: Mode,
  focus: string | null | undefined,
  isRestDay: boolean,
): string | null {
  if (isRestDay) return REST_SEQUENCE[mode];
  if (!focus) return null;
  return FOCUS_TO_SEQUENCE[mode][focus] ?? null;
}
