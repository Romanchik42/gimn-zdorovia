import { z } from "zod";

/** Отзыв, сообщение об ошибке или идея (GIMN-011). Одна схема на клиент и сервер. */
export const FEEDBACK_TYPES = ["review", "bug", "idea"] as const;

export const FEEDBACK_TYPE_LABELS: Record<(typeof FEEDBACK_TYPES)[number], string> = {
  review: "Отзыв",
  bug: "Ошибка",
  idea: "Идея",
};

export const FEEDBACK_PLACEHOLDERS: Record<(typeof FEEDBACK_TYPES)[number], string> = {
  review: "Что понравилось, а что нет?",
  bug: "Что произошло и на каком экране?",
  idea: "Чего не хватает в приложении?",
};

export const feedbackSchema = z.object({
  type: z.enum(FEEDBACK_TYPES),
  text: z.string().trim().min(3, "Напишите хотя бы пару слов").max(2000, "До 2000 символов"),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
