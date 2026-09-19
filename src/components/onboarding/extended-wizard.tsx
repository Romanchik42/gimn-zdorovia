"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ChevronLeftIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EXTENDED_BLOCKS, type ExtendedAnswers, type ExtendedKey } from "@/lib/diagnostics/extended";
import { cn } from "cn";

/**
 * Углублённая диагностика (GIMN-011): 6 блоков вопросов, по экрану на блок.
 * Любой вопрос можно пропустить — пропуск просто не влияет на подбор.
 * Вопросы и варианты — из lib/diagnostics/extended.ts, здесь только показ.
 */
export function ExtendedWizard({ next, initial }: { next: string; initial: ExtendedAnswers | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<ExtendedAnswers>(initial ?? {});
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string[] | null>(null);

  const block = EXTENDED_BLOCKS[step];
  const last = step === EXTENDED_BLOCKS.length - 1;

  function pick(key: ExtendedKey, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));
  }

  async function submit() {
    setPending(true);
    try {
      const clean = Object.fromEntries(Object.entries(answers).filter(([, v]) => v !== undefined));
      const res = await fetch("/api/onboarding/diagnostics/extended", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: clean }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить ответы");
        return;
      }
      setResult(json.data.explanation as string[]);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
            <CheckIcon className="size-7" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Спасибо, подбор уточнён</h1>
        </div>
        <ul className="space-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10">
          {result.length ? (
            result.map((line) => (
              <li key={line} className="flex gap-2">
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                {line}
              </li>
            ))
          ) : (
            <li>Ограничений не нашлось — занятия остаются как есть.</li>
          )}
        </ul>
        <Button size="lg" className="h-12 w-full" onClick={() => router.push(next)}>
          Продолжить
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => (step === 0 ? router.push(next) : setStep((s) => s - 1))}
          aria-label="Назад"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Progress value={((step + 1) / EXTENDED_BLOCKS.length) * 100} className="h-1.5 flex-1" />
        <span className="font-mono text-xs text-muted-foreground">
          {step + 1}/{EXTENDED_BLOCKS.length}
        </span>
      </div>

      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{block.title}</h1>
        <p className="text-sm text-muted-foreground">{block.hint}</p>
      </header>

      <div className="space-y-5">
        {block.questions.map((q) => (
          <fieldset key={q.key} className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{q.text}</legend>
            <div className={cn("grid gap-2", q.options.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
              {q.options.map(([value, label]) => {
                const active = answers[q.key] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => pick(q.key, value)}
                    className={cn(
                      "min-h-12 rounded-lg border px-2 py-2 text-sm leading-tight font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-12 w-full"
          disabled={pending}
          onClick={() => (last ? void submit() : setStep((s) => s + 1))}
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
          {last ? "Готово" : "Дальше"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Не уверены — пропустите вопрос: он просто не повлияет на подбор.
        </p>
      </div>
    </div>
  );
}
