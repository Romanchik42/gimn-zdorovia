"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BUILDER_FOCUS_LABELS,
  DURATIONS,
  INTENSITIES,
  INTENSITY_LABELS,
  type CustomBuildInput,
} from "@/lib/schemas/workout";
import { cn } from "cn";

/** Порядок чипсов — как в макете SPEC 4.4. */
const FOCUS_ORDER: CustomBuildInput["focus"][] = [
  "legs",
  "back",
  "chest",
  "shoulder",
  "arms",
  "core",
  "full_body",
  "spine",
  "neck",
];

/** Три шага конструктора: фокус → длительность → интенсивность (SPEC 4.4). */
export function BuilderForm({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: CustomBuildInput;
  onChange: (next: CustomBuildInput) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="space-y-6">
      <Step number={1} title="Что тренируем?">
        <div className="flex flex-wrap gap-2">
          {FOCUS_ORDER.map((focus) => (
            <Chip
              key={focus}
              active={value.focus === focus}
              onClick={() => onChange({ ...value, focus })}
            >
              {BUILDER_FOCUS_LABELS[focus]}
            </Chip>
          ))}
        </div>
      </Step>

      <Step number={2} title="Сколько времени?">
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((min) => (
            <Chip
              key={min}
              active={value.duration_min === min}
              onClick={() => onChange({ ...value, duration_min: min })}
            >
              {min} мин
            </Chip>
          ))}
        </div>
      </Step>

      <Step number={3} title="Насколько тяжело?">
        <div className="grid grid-cols-3 gap-2">
          {INTENSITIES.map((intensity) => (
            <Chip
              key={intensity}
              active={value.intensity === intensity}
              onClick={() => onChange({ ...value, intensity })}
            >
              {INTENSITY_LABELS[intensity]}
            </Chip>
          ))}
        </div>
      </Step>

      <Button size="lg" className="h-14 w-full text-base" onClick={onSubmit} disabled={pending}>
        {pending ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : (
          <SparklesIcon className="size-5" aria-hidden />
        )}
        Собрать тренировку
      </Button>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-medium">
        <span className="mr-1.5 font-mono text-muted-foreground">{number}.</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}
