import { z } from "zod";

import { THEMES, THEME_STORAGE_KEY } from "@/lib/themes";
import type { CustomTheme, InfoCardTint } from "@/lib/supabase/types";

/**
 * Конструктор оформления (GIMN-011): своя палитра поверх темы и тон
 * инфо-табличек. Единый источник для схемы, API и UI; цвета тем — в globals.css.
 */

/* ------------------------------ тон табличек ------------------------------ */

export const INFO_TINTS = ["neutral", "blue", "sage", "coral", "sand", "lavender"] as const satisfies readonly InfoCardTint[];

export const INFO_TINT_LABELS: Record<InfoCardTint, string> = {
  neutral: "Нейтральный",
  blue: "Голубой",
  sage: "Зеленовато-серый",
  coral: "Красновато-оранжевый",
  sand: "Песочный",
  lavender: "Лавандовый",
};

/** Образец для кнопки выбора — совпадает с --info-tint в globals.css. */
export const INFO_TINT_SWATCHES: Record<InfoCardTint, string> = {
  neutral: "#9aa3a0",
  blue: "#3f7fb8",
  sage: "#6f8a78",
  coral: "#d0704f",
  sand: "#b8904f",
  lavender: "#8570b8",
};

export const infoTintSchema = z.enum(INFO_TINTS);

/* ------------------------------ своя палитра ------------------------------ */

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Цвет в формате #RRGGBB");

export const customThemeSchema = z.object({
  bg: hexColor,
  text: hexColor,
  card: hexColor,
  glow: z.boolean(),
  glow_strength: z.number().int().min(0).max(100),
});

export const CUSTOM_THEME_STORAGE_KEY = "gz-custom-theme";
export const INFO_TINT_STORAGE_KEY = "gz-info-tint";

/** Относительная яркость по WCAG 2.1. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Контраст двух цветов, 1..21. Для обычного текста нужно не меньше 4.5. */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

export const MIN_TEXT_CONTRAST = 4.5;

/** Ставит/снимает свою палитру на <html>: переменные поверх темы. */
export function applyCustomTheme(theme: CustomTheme | null): void {
  const root = document.documentElement;
  const vars = ["--background", "--foreground", "--card", "--card-foreground", "--popover", "--popover-foreground"];
  if (!theme) {
    for (const v of vars) root.style.removeProperty(v);
    root.style.removeProperty("--card-glow-strength");
    delete root.dataset.cardGlow;
    return;
  }
  root.style.setProperty("--background", theme.bg);
  root.style.setProperty("--foreground", theme.text);
  root.style.setProperty("--card", theme.card);
  root.style.setProperty("--card-foreground", theme.text);
  root.style.setProperty("--popover", theme.card);
  root.style.setProperty("--popover-foreground", theme.text);
  root.style.setProperty("--card-glow-strength", String(theme.glow_strength));
  if (theme.glow) root.dataset.cardGlow = "on";
  else delete root.dataset.cardGlow;
}

export function applyInfoTint(tint: InfoCardTint): void {
  document.documentElement.dataset.infoTint = tint;
}

/** Запоминаем на устройстве — применяется до первой отрисовки, без мигания. */
export function rememberAppearance(custom: CustomTheme | null, tint?: InfoCardTint): void {
  try {
    if (custom) localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(custom));
    else localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
    if (tint) localStorage.setItem(INFO_TINT_STORAGE_KEY, tint);
  } catch {
    // приватный режим — оформление просто приедет с сервера после загрузки
  }
}

/**
 * Инлайн-скрипт в <head>: тема, своя палитра и тон табличек до первой
 * отрисовки. Всё из localStorage проверяется по белым спискам и формату —
 * в стили не попадёт ничего, кроме #RRGGBB и числа.
 */
export const appearanceBootstrapScript = `
(function(){try{var d=document.documentElement,s=localStorage;
var t=s.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(THEMES)}.indexOf(t)>=0){d.dataset.theme=t;}
var n=s.getItem(${JSON.stringify(INFO_TINT_STORAGE_KEY)});if(${JSON.stringify(INFO_TINTS)}.indexOf(n)>=0){d.dataset.infoTint=n;}
var c=JSON.parse(s.getItem(${JSON.stringify(CUSTOM_THEME_STORAGE_KEY)})||"null"),h=/^#[0-9a-fA-F]{6}$/;
if(c&&h.test(c.bg)&&h.test(c.text)&&h.test(c.card)){var st=d.style;
st.setProperty("--background",c.bg);st.setProperty("--foreground",c.text);st.setProperty("--card",c.card);
st.setProperty("--card-foreground",c.text);st.setProperty("--popover",c.card);st.setProperty("--popover-foreground",c.text);
var g=Number(c.glow_strength);if(g>=0&&g<=100){st.setProperty("--card-glow-strength",String(g));}if(c.glow===true){d.dataset.cardGlow="on";}}
}catch(e){}})();
`;
