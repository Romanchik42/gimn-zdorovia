"use client";

import { useEffect } from "react";

import { useTheme } from "@/components/layout/theme-provider";
import { isTheme, type Theme } from "@/lib/themes";

/** Утро и день — Sage, вечер — Terracotta (US-10). Границы по местному времени устройства. */
export function themeForHour(hour: number): Theme {
  return hour >= 6 && hour < 18 ? "sage" : "terracotta";
}

const RECHECK_MS = 10 * 60 * 1000;

/**
 * Синхронизирует тему с профилем: выбор, сделанный на телефоне, приезжает
 * на компьютер (US-10). При включённой авто-смене тема следует за часами.
 */
export function ThemeSync({ dbTheme, autoTheme }: { dbTheme: string | null; autoTheme: boolean }) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (autoTheme) {
      const apply = () => {
        const wanted = themeForHour(new Date().getHours());
        if (wanted !== document.documentElement.dataset.theme) setTheme(wanted);
      };
      apply();
      const id = window.setInterval(apply, RECHECK_MS);
      return () => window.clearInterval(id);
    }

    if (isTheme(dbTheme) && dbTheme !== theme) setTheme(dbTheme);
    // theme намеренно не в зависимостях: синхронизируем только при изменении профиля,
    // иначе локальный выбор тут же откатывался бы к значению из БД.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbTheme, autoTheme, setTheme]);

  return null;
}
