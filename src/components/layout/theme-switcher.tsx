"use client";

import { CheckIcon } from "lucide-react";

import { useTheme } from "@/components/layout/theme-provider";
import { THEMES, THEME_LABELS, THEME_SWATCHES } from "@/lib/themes";
import { cn } from "cn";

/**
 * Переключатель трёх тем. Список и цвета берутся из @/lib/themes —
 * добавление темы не требует правок здесь.
 */
export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn("flex flex-wrap items-center justify-center gap-2", className)}
      role="radiogroup"
      aria-label="Оформление"
    >
      {THEMES.map((name) => {
        const active = theme === name;
        const swatch = THEME_SWATCHES[name];

        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(name)}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-full border border-black/10"
              style={{
                background: `linear-gradient(135deg, ${swatch.primary} 50%, ${swatch.accent} 50%)`,
              }}
            />
            {THEME_LABELS[name]}
            {active ? <CheckIcon className="size-3.5" aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
