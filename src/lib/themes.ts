/**
 * Единый источник правды по темам оформления.
 * Цвета живут в globals.css; здесь — только идентификаторы и подписи,
 * чтобы нигде в компонентах не появлялось хардкода строк 'sage' | ...
 */

export const THEMES = ["sage", "terracotta", "ocean"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "sage";

export const THEME_LABELS: Record<Theme, string> = {
  sage: "Шалфей",
  terracotta: "Терракота",
  ocean: "Океан",
};

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  sage: "Спокойный зелёный — мягко для глаз",
  terracotta: "Тёплый терракотовый — бодрит",
  ocean: "Прохладный синий — медицинский",
};

/** Превью-цвета для кружков выбора темы (совпадают с --primary/--accent). */
export const THEME_SWATCHES: Record<Theme, { primary: string; accent: string; background: string }> = {
  sage: { primary: "#7C9885", accent: "#C89858", background: "#FAFAF7" },
  terracotta: { primary: "#C97B5C", accent: "#7C9885", background: "#FDF9F5" },
  ocean: { primary: "#4A8E9E", accent: "#D9974A", background: "#F7FAFB" },
};

/** Ключ в localStorage — тема применяется до гидрации, чтобы не было мигания. */
export const THEME_STORAGE_KEY = "gz-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
