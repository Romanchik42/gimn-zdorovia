import { z } from "zod";

/** Ручной замер прогресса (US-09). Любое поле можно пропустить, но не все сразу. */
export const measurementSchema = z
  .object({
    weight_kg: z.number().min(30, "Вес от 30 кг").max(300, "Вес до 300 кг").nullable().optional(),
    shober_test_cm: z.number().min(0).max(30, "До 30 см").nullable().optional(),
    stiffness_level: z.number().int().min(1).max(10).nullable().optional(),
  })
  .refine(
    (v) => v.weight_kg != null || v.shober_test_cm != null || v.stiffness_level != null,
    "Заполните хотя бы одно поле",
  );

export type MeasurementInput = z.infer<typeof measurementSchema>;
