/**
 * Единый источник правды по темам оформления.
 * Цвета живут в globals.css; здесь — только идентификаторы и подписи,
 * чтобы нигде в компонентах не появлялось хардкода строк 'sage' | ...
 */

/** Три исходные темы (SPEC 4.2) + четыре палитры конструктора (GIMN-011). */
export const THEMES = ["sage", "terracotta", "ocean", "lavender", "sand", "mint", "graphite"] as const;

export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "sage";

export const THEME_LABELS: Record<Theme, string> = {
  sage: "Шалфей",
  terracotta: "Терракота",
  ocean: "Океан",
  lavender: "Лаванда",
  sand: "Песок",
  mint: "Мята",
  graphite: "Графит",
};

export const THEME_DESCRIPTIONS: Record<Theme, string> = {
  sage: "Спокойный зелёный — мягко для глаз",
  terracotta: "Тёплый терракотовый — бодрит",
  ocean: "Прохладный синий — медицинский",
  lavender: "Мягкий сиреневый — спокойный",
  sand: "Тёплый бежевый — уютный",
  mint: "Свежий зелёно-бирюзовый",
  graphite: "Тёмная — бережёт глаза вечером",
};

/** Превью-цвета для кружков выбора темы (совпадают с --primary/--accent). */
export const THEME_SWATCHES: Record<Theme, { primary: string; accent: string; background: string }> = {
  sage: { primary: "#7C9885", accent: "#C89858", background: "#FAFAF7" },
  terracotta: { primary: "#C97B5C", accent: "#7C9885", background: "#FDF9F5" },
  ocean: { primary: "#4A8E9E", accent: "#D9974A", background: "#F7FAFB" },
  lavender: { primary: "#6E5A9E", accent: "#9A6128", background: "#F8F6FB" },
  sand: { primary: "#8C6239", accent: "#3F7A66", background: "#FBF7F0" },
  mint: { primary: "#2F7D69", accent: "#9C6A2A", background: "#F3FAF7" },
  graphite: { primary: "#8CC4A6", accent: "#E0B070", background: "#1C1F23" },
};

/** Ключ в localStorage — тема применяется до гидрации, чтобы не было мигания. */
export const THEME_STORAGE_KEY = "gz-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}
