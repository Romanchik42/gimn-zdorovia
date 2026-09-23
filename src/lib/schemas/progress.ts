import { z } from "zod";

/** Необязательный обхват в сантиметрах. Границы — те же, что в ограничении 0024. */
const girth = (label: string, min: number, max: number) =>
  z.number().min(min, `${label}: от ${min} см`).max(max, `${label}: до ${max} см`).nullable().optional();

/**
 * Ручной замер прогресса (US-09, расширен в GIMN-028).
 * Любое поле можно пропустить, но не все сразу.
 */
export const measurementSchema = z
  .object({
    weight_kg: z.number().min(30, "Вес от 30 кг").max(300, "Вес до 300 кг").nullable().optional(),
    shober_test_cm: z.number().min(0).max(30, "До 30 см").nullable().optional(),
    stiffness_level: z.number().int().min(1).max(10).nullable().optional(),

    chest_cm: girth("Грудь", 40, 200),
    waist_cm: girth("Талия", 40, 200),
    hips_cm: girth("Бёдра", 40, 200),
    bicep_cm: girth("Бицепс", 15, 80),
    thigh_cm: girth("Бедро", 25, 120),
    body_fat_pct: z
      .number()
      .min(3, "Процент жира: от 3%")
      .max(60, "Процент жира: до 60%")
      .nullable()
      .optional(),
    resting_hr: z
      .number()
      .int()
      .min(30, "Пульс покоя: от 30")
      .max(140, "Пульс покоя: до 140")
      .nullable()
      .optional(),
    notes: z.string().trim().max(500, "До 500 символов").nullable().optional(),
  })
  .refine(
    (v) => MEASUREMENT_FIELDS.some((f) => v[f] != null),
    "Заполните хотя бы одно поле",
  );

/** Поля, любое из которых делает замер осмысленным. Заметка сама по себе — нет. */
export const MEASUREMENT_FIELDS = [
  "weight_kg",
  "shober_test_cm",
  "stiffness_level",
  "chest_cm",
  "waist_cm",
  "hips_cm",
  "bicep_cm",
  "thigh_cm",
  "body_fat_pct",
  "resting_hr",
] as const;

export type MeasurementInput = z.infer<typeof measurementSchema>;

/** Насколько вес должен отличаться от прошлого замера, чтобы насторожить. */
export const WEIGHT_JUMP_KG = 5;

/**
 * Подозрительный скачок веса. Не ошибка: человек мог долго не взвешиваться
 * или действительно похудеть. Но чаще это опечатка — 87 вместо 78, — а
 * замеры идут в графики и в прогрессию, поэтому о скачке мы говорим.
 */
export function weightJumpWarning(previous: number | null | undefined, current: number | null | undefined): string | null {
  if (previous == null || current == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < WEIGHT_JUMP_KG) return null;
  const direction = diff > 0 ? "больше" : "меньше";
  return `Вес на ${Math.abs(diff).toFixed(1)} кг ${direction}, чем в прошлый раз. Если это опечатка — исправьте замер.`;
}
