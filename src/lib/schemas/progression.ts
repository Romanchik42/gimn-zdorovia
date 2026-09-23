import { z } from "zod";

/**
 * Ответ на предложение перейти на следующий уровень (GIMN-028).
 *
 * Отказ отправляется так же, как согласие: приложению нужно знать, что
 * человек увидел вопрос и ответил «нет», иначе оно спросит снова.
 */
export const levelUpAnswerSchema = z.object({
  accept: z.boolean(),
});

export type LevelUpAnswer = z.infer<typeof levelUpAnswerSchema>;
