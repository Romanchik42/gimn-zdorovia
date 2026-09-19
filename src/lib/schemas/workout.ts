import { z } from "zod";

/** Конструктор тренировки и недельный план (SPEC 3.1-3.3, US-05, US-06). */

export const INTENSITIES = ["low", "medium", "high"] as const;

export const INTENSITY_LABELS: Record<(typeof INTENSITIES)[number], string> = {
  low: "Лёгкая",
  medium: "Средняя",
  high: "Высокая",
};

/** Фокусы, доступные в конструкторе и редакторе плана. Подписи — в weekly-cycle. */
export const FOCUSES = [
  "spine",
  "spine_thoracic",
  "spine_lumbar",
  "neck",
  "shoulder",
  "chest",
  "arms",
  "back",
  "hips",
  "legs",
  "core",
  "full_body",
] as const;

export const DURATIONS = [15, 30, 45, 60] as const;

/** Подписи чипсов конструктора (SPEC 4.4) — короче, чем названия дней плана. */
export const BUILDER_FOCUS_LABELS: Record<(typeof FOCUSES)[number], string> = {
  legs: "Ноги",
  back: "Спина",
  chest: "Грудь",
  shoulder: "Плечи",
  arms: "Руки",
  core: "Пресс",
  full_body: "Всё тело",
  spine: "Позвоночник",
  spine_thoracic: "Грудной отдел",
  spine_lumbar: "Поясница",
  neck: "Шея",
  hips: "Таз",
};

/** Лимит сохранённых шаблонов на пользователя (SPEC 3.2). */
export const MAX_CUSTOM_TEMPLATES = 20;

export const customBuildSchema = z.object({
  focus: z.enum(FOCUSES),
  duration_min: z.number().int().min(10).max(120),
  intensity: z.enum(INTENSITIES),
});

export type CustomBuildInput = z.infer<typeof customBuildSchema>;

export const customExerciseItemSchema = z.object({
  exercise_id: z.uuid(),
  order: z.number().int().min(1),
  duration_sec: z.number().int().min(5).max(1800).nullable().optional(),
  repetitions: z.number().int().min(1).max(200).nullable().optional(),
  rest_sec: z.number().int().min(0).max(300).nullable().optional(),
});

export const customSaveSchema = z.object({
  name: z.string().trim().min(1, "Назовите шаблон").max(100),
  focus: z.enum(FOCUSES),
  duration_min: z.number().int().min(10).max(120),
  intensity: z.enum(INTENSITIES),
  exercises_order: z.array(customExerciseItemSchema).min(1, "Добавьте хотя бы одно упражнение").max(40),
});

export type CustomSaveInput = z.infer<typeof customSaveSchema>;

/** Запуск своей тренировки прямо сейчас — без сохранения шаблона. */
export const customStartSchema = z.object({
  exercises_order: z.array(customExerciseItemSchema).min(1).max(40),
  custom_workout_id: z.uuid().optional(),
});

export type CustomStartInput = z.infer<typeof customStartSchema>;

export const planDaySchema = z.object({
  day_of_week: z.number().int().min(1).max(7),
  focus: z.string().nullable(),
  duration_min: z.number().int().min(10).max(120).optional(),
  intensity: z.enum(INTENSITIES).optional(),
  is_rest_day: z.boolean(),
});

export const planUpdateSchema = z.object({
  days: z
    .array(planDaySchema)
    .length(7, "Нужны все 7 дней недели")
    .refine(
      (days) => new Set(days.map((d) => d.day_of_week)).size === 7,
      "Каждый день недели должен встречаться ровно один раз",
    ),
});

export type PlanUpdateInput = z.infer<typeof planUpdateSchema>;

/* -------------------------------------------------------------------------- */

/**
 * Длина занятия (GIMN-010): человек выбирает, сколько сегодня потянет.
 * Структура (дыхание → разминка → основное → растяжка) есть в любой длине.
 */
export const WORKOUT_LENGTHS = ["short", "medium", "full"] as const;
export const workoutLengthSchema = z.enum(WORKOUT_LENGTHS);

export const WORKOUT_LENGTH_LABELS: Record<(typeof WORKOUT_LENGTHS)[number], string> = {
  short: "Короткое",
  medium: "Среднее",
  full: "Полное",
};

export const WORKOUT_LENGTH_HINTS: Record<(typeof WORKOUT_LENGTHS)[number], string> = {
  short: "4-5 упражнений",
  medium: "7-8 упражнений",
  full: "весь план дня",
};

/** Смена длины уже собранной тренировки — пока в ней нет ни одной отметки. */
export const changeWorkoutLengthSchema = z.object({
  workout_id: z.uuid(),
  length: workoutLengthSchema,
});
