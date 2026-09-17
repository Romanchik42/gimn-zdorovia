import { z } from "zod";

/** Меню и список покупок (SPEC 3.5, 5.3). */

export const MEAL_TYPES = ["breakfast", "lunch", "snack", "dinner"] as const;

export const MEAL_TYPE_LABELS: Record<(typeof MEAL_TYPES)[number], string> = {
  breakfast: "Завтрак",
  lunch: "Обед",
  snack: "Полдник",
  dinner: "Ужин",
};

/** Доля дневной нормы на приём пищи (SPEC 5.3). */
export const MEAL_CALORIE_SHARE: Record<(typeof MEAL_TYPES)[number], number> = {
  breakfast: 0.275,
  lunch: 0.375,
  snack: 0.125,
  dinner: 0.225,
};

export const MEAL_TIME_HINTS: Record<(typeof MEAL_TYPES)[number], string> = {
  breakfast: "07:00-09:00",
  lunch: "13:00-15:00",
  snack: "16:00-17:00",
  dinner: "18:30-20:00",
};

export const generateNutritionSchema = z.object({
  week_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional(),
  days: z.number().int().min(1).max(7).default(7),
});

export type GenerateNutritionInput = z.infer<typeof generateNutritionSchema>;

export const toggleMealSchema = z.object({
  user_meal_id: z.uuid(),
  consumed: z.boolean(),
});

export const toggleShoppingItemSchema = z.object({
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  product: z.string().min(1),
  purchased: z.boolean(),
});
