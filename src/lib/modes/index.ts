/**
 * Режимы занятий — единый источник (GIMN-012).
 *
 * До этого тикета режим был один на пользователя и строки 'behtereva'/'general'
 * писались по месту. Теперь режимов может быть два сразу, поэтому названия,
 * описания и адреса анкет живут здесь, а не расходятся по страницам.
 *
 * Словарь: «текущий режим» (users.mode) — тот, что показывается сейчас;
 * «активный» (user_modes.is_active) — тот, которым человек реально занимается.
 */

export const MODES = ["behtereva", "general"] as const;
export type Mode = (typeof MODES)[number];

export const MODE_LABELS: Record<Mode, string> = {
  behtereva: "Реабилитация Бехтерева",
  general: "Общая форма",
};

/** Короткое имя — для переключалки на главном, где места мало. */
export const MODE_SHORT_LABELS: Record<Mode, string> = {
  behtereva: "Бехтерева",
  general: "Форма",
};

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  behtereva: "Программа на подвижность позвоночника и суставов. Начнём с короткой диагностики.",
  general: "Тренировки и меню под вашу цель: снизить вес, набрать массу или держать форму.",
};

/** Куда вести, если человек решил заниматься этим режимом (анкета режима). */
export const MODE_ONBOARDING_PATH: Record<Mode, string> = {
  behtereva: "/onboarding/behtereva",
  general: "/onboarding/general",
};

export function isMode(value: unknown): value is Mode {
  return typeof value === "string" && (MODES as readonly string[]).includes(value);
}

/** Второй режим — их всего два, поэтому «другой» однозначен. */
export function otherMode(mode: Mode): Mode {
  return mode === "behtereva" ? "general" : "behtereva";
}
