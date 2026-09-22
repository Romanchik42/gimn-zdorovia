"use client";

import { useEffect } from "react";

import { useTheme } from "@/components/layout/theme-provider";
import { isTheme, type Theme } from "@/lib/themes";
import { applyCustomTheme, applyInfoTint, customThemeSchema, rememberAppearance } from "@/lib/appearance";
import type { CustomTheme, InfoCardTint } from "@/lib/supabase/types";

/** Утро и день — Sage, вечер — Terracotta (US-10). Границы по местному времени устройства. */
export function themeForHour(hour: number): Theme {
  return hour >= 6 && hour < 18 ? "sage" : "terracotta";
}

const RECHECK_MS = 10 * 60 * 1000;

/**
 * Синхронизирует тему с профилем: выбор, сделанный на телефоне, приезжает
 * на компьютер (US-10). При включённой авто-смене тема следует за часами.
 */
export function ThemeSync({
  dbTheme,
  autoTheme,
  customTheme = null,
  infoTint = "neutral",
}: {
  dbTheme: string | null;
  autoTheme: boolean;
  customTheme?: CustomTheme | null;
  infoTint?: InfoCardTint;
}) {
  const { theme, setTheme } = useTheme();

  // Своя палитра и тон табличек — из профиля (GIMN-011); запоминаем на
  // устройстве, чтобы в следующий раз они встали до первой отрисовки.
  const customKey = JSON.stringify(customTheme);
  useEffect(() => {
    const parsed = customThemeSchema.safeParse(customTheme);
    const custom = parsed.success ? parsed.data : null;
    applyCustomTheme(custom);
    applyInfoTint(infoTint);
    rememberAppearance(custom, infoTint);
    // Палитра могла сменить светлое оформление на тёмное — тем, кто следит
    // за темой (всплывающие сообщения), нужно об этом узнать.
    window.dispatchEvent(new Event("gz:theme-change"));
    // customTheme сравниваем по содержимому, а не по ссылке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customKey, infoTint]);

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
