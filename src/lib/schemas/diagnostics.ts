import { z } from "zod";

import { EQUIPMENT_VALUES, HAS_TURNIK_VALUES } from "@/lib/workout-engine/equipment";

/**
 * Диагностика Бехтерева и анкета общего режима (SPEC 3.2, US-01, US-02).
 * Все поля диагностики опциональны: пользователь мог не знать своих
 * измерений и нажать «не знаю» — это штатный сценарий, не ошибка.
 */

export const PAIN_AREAS = [
  "neck",
  "shoulder",
  "spine_thoracic",
  "spine_lumbar",
  "hips",
  "legs",
] as const;

export const PAIN_AREA_LABELS: Record<(typeof PAIN_AREAS)[number], string> = {
  neck: "Шея",
  shoulder: "Плечи",
  spine_thoracic: "Грудной отдел",
  spine_lumbar: "Поясница",
  hips: "Таз и бёдра",
  legs: "Ноги",
};

export const diagnosticsSchema = z.object({
  shober_test_cm: z.number().min(0).max(30).nullable().optional(),
  side_bend_left_cm: z.number().min(0).max(80).nullable().optional(),
  side_bend_right_cm: z.number().min(0).max(80).nullable().optional(),
  rotation_degrees: z.number().int().min(0).max(120).nullable().optional(),
  pain_areas: z.array(z.enum(PAIN_AREAS)).default([]),
  stiffness_level: z.enum(["low", "medium", "high"]).nullable().optional(),
  blood_pressure_ok: z.boolean().nullable().optional(),
});

export type DiagnosticsInput = z.infer<typeof diagnosticsSchema>;

/* -------------------------------------------------------------------------- */

export const GOALS = ["lose", "gain", "maintain"] as const;
export const ACTIVITY_LEVELS = ["sedentary", "light", "medium", "high", "very_high"] as const;
export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export const GOAL_LABELS: Record<(typeof GOALS)[number], string> = {
  lose: "Снизить вес",
  gain: "Набрать массу",
  maintain: "Поддерживать форму",
};

export const ACTIVITY_LABELS: Record<(typeof ACTIVITY_LEVELS)[number], string> = {
  sedentary: "Сидячий образ жизни",
  light: "Лёгкая активность, 1-2 раза в неделю",
  medium: "Средняя, 3-4 раза в неделю",
  high: "Высокая, 5-6 раз в неделю",
  very_high: "Очень высокая, каждый день",
};

export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  beginner: "Начальный",
  intermediate: "Средний",
  advanced: "Продвинутый",
};

/** Вопрос про турник (GIMN-014). Значения и подписи — в workout-engine/equipment. */
export const hasTurnikSchema = z.enum(HAS_TURNIK_VALUES);

/** Где занимается (GIMN-028). */
export const TRAINING_LOCATIONS = ["home", "home_bar", "gym", "home_and_gym"] as const;

export const generalProfileSchema = z.object({
  gender: z.enum(["male", "female"]),
  age_years: z.number().int().min(14, "Возраст от 14").max(100, "Возраст до 100"),
  weight_kg: z.number().min(30, "Вес от 30 кг").max(300, "Вес до 300 кг"),
  height_cm: z.number().min(100, "Рост от 100 см").max(250, "Рост до 250 см"),
  goal: z.enum(GOALS),
  activity_level: z.enum(ACTIVITY_LEVELS),
  difficulty: z.enum(DIFFICULTIES),
  training_days: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Выберите хотя бы один день")
    .max(7),
  /**
   * Есть ли турник. Поле обязательное, а не с умолчанием: с умолчанием
   * zod делает вход и выход схемы разными типами, и форма на ней уже
   * не типизируется. Экран анкеты всегда шлёт значение, стартовое — «нет».
   */
  has_turnik: hasTurnikSchema,
  /**
   * Где человек занимается (GIMN-028). От ответа зависит, какой инвентарь
   * предлагаем отметить: штангу и тренажёры — только тем, кто ходит в зал.
   */
  training_location: z.enum(TRAINING_LOCATIONS),
  /**
   * Отмеченный инвентарь. Турника и брусьев здесь нет — про них спрашивает
   * has_turnik, у которого три ответа вместо галочки.
   */
  gym_equipment: z.array(z.enum(EQUIPMENT_VALUES)),
  /**
   * true — анкету заполняют ради меню, режим и план не трогаем.
   * Иначе пользователь Бехтерева, открыв анкету из «Питания», незаметно
   * переключился бы в общий режим и потерял свой недельный план.
   */
  keep_mode: z.boolean().optional(),
});

export type GeneralProfileInput = z.infer<typeof generalProfileSchema>;
