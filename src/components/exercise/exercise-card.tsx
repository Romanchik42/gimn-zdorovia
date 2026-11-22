"use client";

import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { ExerciseMedia } from "@/components/exercise/exercise-media";
import { ContraindicationNote } from "@/components/exercise/contraindication-note";
import { cn } from "cn";
import type { ExerciseSnapshot, FeedbackStatus } from "@/lib/supabase/types";
import { exerciseMeta } from "@/lib/exercise-labels";

/**
 * Универсальная карточка упражнения (SPEC 4.3).
 * Одна форма для ВСЕХ упражнений — это принцип, а не пожелание.
 * Порядок кнопок ✅ → ⚠️ → ❌ фиксирован, высота ≥ 56px,
 * цвета только из переменных темы.
 */

export function ExerciseCard({
  exercise,
  onFeedback,
  disabled,
}: {
  exercise: ExerciseSnapshot;
  onFeedback: (status: FeedbackStatus) => void;
  disabled?: boolean;
}) {
  return (
    <article className="space-y-5" data-tour="exercise-card">
      <ExerciseMedia key={exercise.slug} exercise={exercise} />

      <header className="space-y-1">
        <h2 className="text-[22px] leading-tight font-semibold tracking-tight">{exercise.name}</h2>
        <p className="text-sm text-muted-foreground">{exerciseMeta(exercise)}</p>
      </header>

      <p className="text-base leading-relaxed whitespace-pre-line text-foreground">
        {exercise.technique}
      </p>

      {exercise.warning ? <ContraindicationNote warning={exercise.warning} /> : null}

      <div className="space-y-2" data-tour="feedback-buttons">
        <FeedbackButton
          variant="done"
          icon={<CheckIcon className="size-5" aria-hidden />}
          label="Сделал"
          onClick={() => onFeedback("done")}
          disabled={disabled}
        />
        <FeedbackButton
          variant="difficult"
          icon={<TriangleAlertIcon className="size-5" aria-hidden />}
          label="Плохо"
          onClick={() => onFeedback("difficult")}
          disabled={disabled}
        />
        <FeedbackButton
          variant="skipped"
          icon={<XIcon className="size-5" aria-hidden />}
          label="Пропустить"
          onClick={() => onFeedback("skipped")}
          disabled={disabled}
        />
      </div>
    </article>
  );
}

function FeedbackButton({
  variant,
  icon,
  label,
  onClick,
  disabled,
}: {
  variant: FeedbackStatus;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={`feedback-${variant}`}
      className={cn(
        "flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl border text-base font-medium transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50",
        variant === "done" && "border-transparent bg-primary text-primary-foreground",
        variant === "difficult" && "border-transparent bg-accent text-accent-foreground",
        variant === "skipped" && "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {label}
    </button>
  );
}
