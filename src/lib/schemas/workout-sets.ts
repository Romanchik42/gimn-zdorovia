import { z } from "zod";

/**
 * Запись факта: один подход (GIMN-028).
 *
 * Вес необязателен: у подтягиваний и планки его нет, а RPE — насколько
 * тяжело по ощущению — есть всегда и для прогрессии нужнее.
 */
export const workoutSetSchema = z.object({
  user_workout_id: z.uuid().optional(),
  exercise_id: z.uuid(),
  set_number: z.number().int().min(1).max(20),
  reps: z.number().int().min(0).max(100),
  weight_kg: z.number().min(0).max(500).nullable().optional(),
  rpe: z.number().int().min(1).max(10).nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type WorkoutSetInput = z.infer<typeof workoutSetSchema>;
