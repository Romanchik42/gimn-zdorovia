"use client";

import * as React from "react";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_SWATCHES,
  isTheme,
  type Theme,
} from "@/lib/themes";
import { refreshDarkFlag } from "@/lib/appearance";

/* ---------------------------------------------------------------------------
   Внешнее хранилище темы.
   Источник правды на клиенте — атрибут data-theme на <html>: его выставляет
   инлайн-скрипт до первой отрисовки, поэтому снимок всегда совпадает с тем,
   что уже нарисовано. Никакого setState внутри эффекта.
   --------------------------------------------------------------------------- */

const THEME_EVENT = "gz:theme-change";

function readTheme(): Theme {
  const current = document.documentElement.dataset.theme;
  return isTheme(current) ? current : DEFAULT_THEME;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange);
  // смена темы в соседней вкладке
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Цвет строки браузера и «шапки» установленного приложения — под тему. */
function writeThemeColor(theme: Theme): void {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_SWATCHES[theme].background);
}

function writeTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
  refreshDarkFlag();
  writeThemeColor(next);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // приватный режим / заблокированное хранилище — тема живёт до конца сессии
  }
  window.dispatchEvent(new Event(THEME_EVENT));
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

/** Тёмное ли оформление: тема «Графит» или своя палитра с тёмным фоном. */
function readDark(): boolean {
  return document.documentElement.dataset.dark === "on";
}

/**
 * Всплывающие сообщения и цвет строки браузера светлым/тёмным набором
 * переменными CSS не задаются — им нужен булев признак.
 */
export function useIsDark(): boolean {
  return React.useSyncExternalStore(subscribe, readDark, () => false);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

  // Строку браузера красим и при первой загрузке: тему мог поднять
  // инлайн-скрипт из localStorage, а meta приезжает из метаданных Next.
  React.useEffect(() => writeThemeColor(theme), [theme]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme: writeTheme }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme должен вызываться внутри <ThemeProvider>");
  return ctx;
}
