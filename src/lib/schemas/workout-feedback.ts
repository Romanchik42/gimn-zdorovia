import { z } from "zod";

/** Отметки по упражнениям и побочки (SPEC 3.4, US-03, US-04). */

export const FEEDBACK_STATUSES = ["done", "difficult", "skipped"] as const;

export const SYMPTOMS = [
  "pressure_up",
  "headache",
  "cramp",
  "joint_pain",
  "nausea",
  "dizziness",
  "just_hard",
  "other",
] as const;

export const SYMPTOM_LABELS: Record<(typeof SYMPTOMS)[number], string> = {
  pressure_up: "Поднялось давление",
  headache: "Заболела голова",
  cramp: "Свело мышцу",
  joint_pain: "Боль в суставе",
  nausea: "Тошнота",
  dizziness: "Головокружение",
  just_hard: "Просто тяжело",
  other: "Другое",
};

export const workoutFeedbackSchema = z.object({
  user_workout_id: z.uuid(),
  exercise_id: z.uuid(),
  status: z.enum(FEEDBACK_STATUSES),
  notes: z.string().trim().max(500).optional(),
});

export type WorkoutFeedbackInput = z.infer<typeof workoutFeedbackSchema>;

export const sideEffectSchema = z.object({
  user_workout_id: z.uuid(),
  exercise_id: z.uuid().optional(),
  symptom: z.enum(SYMPTOMS),
  description: z.string().trim().max(500).optional(),
  action_taken: z.enum(["continued", "paused", "stopped"]).default("paused"),
});

export type SideEffectInput = z.infer<typeof sideEffectSchema>;

export const generateWorkoutSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
    .optional(),
  custom_workout_id: z.uuid().optional(),
});

export type GenerateWorkoutInput = z.infer<typeof generateWorkoutSchema>;
