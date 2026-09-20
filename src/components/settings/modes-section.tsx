"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, Loader2Icon, LayersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Section } from "@/components/settings/settings-sections";
import {
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  MODE_ONBOARDING_PATH,
  otherMode,
  type Mode,
} from "@/lib/modes";
import { cn } from "cn";

/**
 * «Режимы занятий» в настройках (GIMN-012).
 *
 * Активные режимы — переключалка: что показывать сейчас. Неподключённый —
 * карточка с двумя путями: посмотреть (ничего не сохраняя) или заполнить
 * анкету и заниматься. Переключение и подключение не удаляют ничего.
 */
export function ModesSection({ current, active }: { current: Mode; active: Mode[] }) {
  const router = useRouter();
  const [shown, setShown] = useState(current);
  const [pending, setPending] = useState(false);

  const missing = active.length > 1 ? null : otherMode(active[0] ?? current);

  async function pick(mode: Mode) {
    if (mode === shown || pending) return;
    const prev = shown;
    setShown(mode);
    setPending(true);

    const res = await fetch("/api/modes/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).catch(() => null);

    if (!res?.ok) {
      setShown(prev);
      toast.error("Не удалось переключить режим");
    } else {
      toast.success(`Показываем: ${MODE_LABELS[mode]}`);
      router.refresh();
    }
    setPending(false);
  }

  return (
    <Section icon={<LayersIcon className="size-4 text-primary" aria-hidden />} title="Режимы занятий">
      {active.length > 1 ? (
        <>
          <p className="text-xs text-muted-foreground">
            Показываем данные выбранного режима. Второй режим никуда не девается — прогресс,
            история и меню в нём сохраняются.
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Текущий режим">
            {active.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={shown === mode}
                onClick={() => void pick(mode)}
                disabled={pending}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  shown === mode ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
                )}
              >
                <span className="flex-1">
                  <span className="block text-sm font-medium">{MODE_LABELS[mode]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {MODE_DESCRIPTIONS[mode]}
                  </span>
                </span>
                {shown === mode ? (
                  pending ? (
                    <Loader2Icon className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
                  ) : (
                    <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
                  )
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {missing ? (
        <div className="space-y-3 rounded-xl border border-border p-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{MODE_LABELS[missing]}</p>
            <p className="text-xs text-muted-foreground">{MODE_DESCRIPTIONS[missing]}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-11">
              <Link href={`/app/preview/${missing}`}>
                <EyeIcon className="size-4" aria-hidden />
                Посмотреть
              </Link>
            </Button>
            <Button asChild className="h-11">
              <Link href={`${MODE_ONBOARDING_PATH[missing]}?next=/app`}>Заниматься</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            «Посмотреть» ничего не сохраняет. «Заниматься» задаст вопросы этого режима — прежний
            режим останется нетронутым.
          </p>
        </div>
      ) : null}
    </Section>
  );
}
