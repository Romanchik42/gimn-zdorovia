"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeftIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { PAIN_AREAS, PAIN_AREA_LABELS, type DiagnosticsInput } from "@/lib/schemas/diagnostics";
import { cn } from "cn";

type PainArea = (typeof PAIN_AREAS)[number];

type Answers = {
  shober_test_cm: string;
  side_bend_left_cm: string;
  side_bend_right_cm: string;
  rotation_degrees: string;
  pain_areas: PainArea[];
  no_pain: boolean;
  stiffness_level: "low" | "medium" | "high" | null;
  blood_pressure_ok: boolean | null;
};

const STEPS = 5;

const EMPTY: Answers = {
  shober_test_cm: "",
  side_bend_left_cm: "",
  side_bend_right_cm: "",
  rotation_degrees: "",
  pain_areas: [],
  no_pain: false,
  stiffness_level: null,
  blood_pressure_ok: null,
};

/** Пустая строка = «не знаю». Это штатный ответ, а не ошибка ввода (US-01). */
function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function BehterevaWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [pending, setPending] = useState(false);
  const [offer, setOffer] = useState(false);

  function patch(next: Partial<Answers>) {
    setAnswers((prev) => ({ ...prev, ...next }));
  }

  function back() {
    if (step === 0) router.push("/onboarding/mode");
    else setStep((s) => s - 1);
  }

  async function submit() {
    setPending(true);
    try {
      const payload: DiagnosticsInput = {
        shober_test_cm: toNumber(answers.shober_test_cm),
        side_bend_left_cm: toNumber(answers.side_bend_left_cm),
        side_bend_right_cm: toNumber(answers.side_bend_right_cm),
        rotation_degrees: toNumber(answers.rotation_degrees),
        pain_areas: answers.no_pain ? [] : answers.pain_areas,
        stiffness_level: answers.stiffness_level,
        blood_pressure_ok: answers.blood_pressure_ok,
      };

      const res = await fetch("/api/onboarding/diagnostics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить диагностику");
        return;
      }

      // Базовая диагностика сохранена — предлагаем уточнить подбор (GIMN-011).
      setOffer(true);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  function next() {
    if (step === STEPS - 1) void submit();
    else setStep((s) => s + 1);
  }

  function togglePain(area: PainArea) {
    setAnswers((prev) => ({
      ...prev,
      no_pain: false,
      pain_areas: prev.pain_areas.includes(area)
        ? prev.pain_areas.filter((a) => a !== area)
        : [...prev.pain_areas, area],
    }));
  }

  if (offer) {
    return (
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">Подобрать занятия точнее?</h1>
          <p className="text-muted-foreground">
            Ответьте ещё на несколько вопросов о положениях тела и подвижности — это 2-3 минуты.
            Мы уберём неудобные позы и дадим бережные упражнения туда, где движения даются трудно.
          </p>
        </header>
        <div className="space-y-2">
          <Button size="lg" className="h-12 w-full" onClick={() => router.push("/onboarding/extended?next=/onboarding/theme")}>
            Да, ответить
          </Button>
          <Button variant="outline" className="h-12 w-full" onClick={() => router.push("/onboarding/theme")}>
            Позже
          </Button>
          <p className="text-center text-xs text-muted-foreground">Пройти можно в любой момент в настройках.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={back} aria-label="Назад">
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Progress value={((step + 1) / STEPS) * 100} className="h-1.5 flex-1" />
          <span className="font-mono text-xs text-muted-foreground">
            {step + 1}/{STEPS}
          </span>
        </div>
      </div>

      {step === 0 ? (
        <Step
          title="Тест Шобера"
          hint="Отметьте точку на пояснице и точку на 10 см выше. Наклонитесь вперёд и измерьте, насколько разошлись отметки."
        >
          <NumberField
            id="shober"
            label="Прирост при наклоне, см"
            placeholder="например, 4.5"
            value={answers.shober_test_cm}
            onChange={(v) => patch({ shober_test_cm: v })}
          />
        </Step>
      ) : null}

      {step === 1 ? (
        <Step
          title="Боковой наклон"
          hint="Встаньте у стены и скользите ладонью вдоль бедра вниз. Измерьте, насколько опустились кончики пальцев."
        >
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              id="bend-left"
              label="Влево, см"
              placeholder="12"
              value={answers.side_bend_left_cm}
              onChange={(v) => patch({ side_bend_left_cm: v })}
            />
            <NumberField
              id="bend-right"
              label="Вправо, см"
              placeholder="14"
              value={answers.side_bend_right_cm}
              onChange={(v) => patch({ side_bend_right_cm: v })}
            />
          </div>
        </Step>
      ) : null}

      {step === 2 ? (
        <Step
          title="Ротация позвоночника"
          hint="Сядьте на стул, зафиксируйте таз и поверните корпус в сторону. Оцените поворот в градусах."
        >
          <NumberField
            id="rotation"
            label="Поворот, градусов"
            placeholder="например, 30"
            value={answers.rotation_degrees}
            onChange={(v) => patch({ rotation_degrees: v })}
          />
        </Step>
      ) : null}

      {step === 3 ? (
        <Step title="Где болит сейчас?" hint="Можно выбрать несколько зон.">
          <div className="grid grid-cols-2 gap-2">
            {PAIN_AREAS.map((area) => {
              const active = !answers.no_pain && answers.pain_areas.includes(area);
              return (
                <button
                  key={area}
                  type="button"
                  aria-pressed={active}
                  onClick={() => togglePain(area)}
                  className={cn(
                    "min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {PAIN_AREA_LABELS[area]}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-pressed={answers.no_pain}
            onClick={() => patch({ no_pain: !answers.no_pain, pain_areas: [] })}
            className={cn(
              "mt-2 min-h-12 w-full rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              answers.no_pain
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            Нигде не болит
          </button>
        </Step>
      ) : null}

      {step === 4 ? (
        <Step title="Утренняя скованность и давление" hint="Последний шаг.">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Скованность по утрам</legend>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  ["low", "Мало"],
                  ["medium", "Средне"],
                  ["high", "Много"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={answers.stiffness_level === value}
                  onClick={() => patch({ stiffness_level: value })}
                  className={cn(
                    "min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    answers.stiffness_level === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2 pt-4">
            <legend className="mb-2 text-sm font-medium">Давление в норме?</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [true, "Да"],
                  [false, "Нет"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={answers.blood_pressure_ok === value}
                  onClick={() => patch({ blood_pressure_ok: value })}
                  className={cn(
                    "min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    answers.blood_pressure_ok === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </Step>
      ) : null}

      <div className="space-y-2">
        <Button size="lg" className="h-12 w-full" onClick={next} disabled={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          {step === STEPS - 1 ? "Готово" : "Дальше"}
        </Button>
        <Button variant="ghost" className="h-11 w-full" onClick={next} disabled={pending}>
          Не знаю, пропустить
        </Button>
      </div>
    </div>
  );
}

function Step({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function NumberField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12"
      />
    </div>
  );
}
