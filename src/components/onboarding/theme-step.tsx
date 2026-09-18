"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/layout/theme-provider";
import { createClient } from "@/lib/supabase/client";
import {
  THEMES,
  THEME_DESCRIPTIONS,
  THEME_LABELS,
  THEME_SWATCHES,
} from "@/lib/themes";
import { cn } from "cn";

/**
 * Выбор темы с живым превью: нажатие сразу перекрашивает всё приложение,
 * потому что тема — это data-theme на <html>, а не локальный стейт.
 */
export function ThemeStep() {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function finish() {
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Тема уже применена локально; в БД она нужна для Telegram-бота и других устройств.
        const { error } = await supabase.from("users").update({ theme }).eq("id", user.id);
        if (error) console.error("theme save failed:", error.message);
      }

      router.push("/app");
      router.refresh();
    } catch {
      toast.error("Не удалось сохранить выбор, но тему мы запомнили на этом устройстве.");
      router.push("/app");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Выберите оформление</h1>
        <p className="text-sm text-muted-foreground">
          Нажмите — приложение перекрасится сразу. Потом можно сменить в настройках.
        </p>
      </header>

      <div className="space-y-3">
        {THEMES.map((name) => {
          const active = theme === name;
          const swatch = THEME_SWATCHES[name];

          return (
            <button
              key={name}
              type="button"
              aria-pressed={active}
              onClick={() => setTheme(name)}
              className={cn(
                "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors",
                active ? "border-primary bg-primary/8" : "border-border bg-card hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-black/10"
                style={{ background: swatch.background }}
              >
                <span
                  className="size-7 rounded-md"
                  style={{
                    background: `linear-gradient(135deg, ${swatch.primary} 50%, ${swatch.accent} 50%)`,
                  }}
                />
              </span>
              <span className="flex-1 space-y-0.5">
                <span className="block font-medium">{THEME_LABELS[name]}</span>
                <span className="block text-sm text-muted-foreground">
                  {THEME_DESCRIPTIONS[name]}
                </span>
              </span>
              {active ? <CheckIcon className="size-5 shrink-0 text-primary" aria-hidden /> : null}
            </button>
          );
        })}
      </div>

      <Button size="lg" className="h-12 w-full" onClick={finish} disabled={pending}>
        {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
        Начать заниматься
      </Button>
    </div>
  );
}
