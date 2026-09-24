"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { ContextHint } from "@/components/tour/context-hint";
import { MODE_SHORT_LABELS, type Mode } from "@/lib/modes";
import { cn } from "cn";

/**
 * «Сегодня занимаюсь: [Бехтерева] [Форма]» (GIMN-012).
 *
 * Показывается только тем, у кого активны оба режима. Переключение меняет
 * текущий режим — данные второго режима остаются на месте, просто не видны.
 */
export function ModeSwitcher({ current, active }: { current: Mode; active: Mode[] }) {
  const router = useRouter();
  const [shown, setShown] = useState(current);
  const [pending, startTransition] = useTransition();
  // Подсказка про режимы (GIMN-029) — по первому переключению, а не при
  // открытии экрана: пока человек не переключился, объяснять нечего.
  const [switched, setSwitched] = useState(false);

  if (active.length < 2) return null;

  async function pick(mode: Mode) {
    if (mode === shown || pending) return;
    const prev = shown;
    setShown(mode); // отклик сразу, до ответа сервера

    const res = await fetch("/api/modes/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => null);

    if (!res?.ok) {
      setShown(prev);
      toast.error("Не удалось переключить режим");
      return;
    }
    setSwitched(true);
    startTransition(() => router.refresh());
  }

  return (
    <section className="space-y-2" data-tour="mode-switcher">
      <h2 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        Сегодня занимаюсь
        {pending ? <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> : null}
      </h2>
      <div
        className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
        role="radiogroup"
        aria-label="Режим занятий"
      >
        {active.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={shown === mode}
            onClick={() => void pick(mode)}
            className={cn(
              "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors",
              shown === mode
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {MODE_SHORT_LABELS[mode]}
          </button>
        ))}
      </div>

      <ContextHint id="modes" active={switched} />
    </section>
  );
}
