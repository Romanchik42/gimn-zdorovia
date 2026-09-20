import { z } from "zod";

import { MODES } from "@/lib/modes";

/** Одна схема на клиент и сервер (SPEC 3.8): переключение режима занятий. */
export const switchModeSchema = z.object({
  mode: z.enum(MODES),
});

export type SwitchModeInput = z.infer<typeof switchModeSchema>;
