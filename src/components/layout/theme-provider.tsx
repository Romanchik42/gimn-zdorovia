"use client";

import * as React from "react";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  isTheme,
  type Theme,
} from "@/lib/themes";

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

function writeTheme(next: Theme): void {
  document.documentElement.dataset.theme = next;
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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore(subscribe, readTheme, () => DEFAULT_THEME);

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
