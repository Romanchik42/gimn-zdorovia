"use client";

import Image from "next/image";
import { useState } from "react";
import { CheckIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { ExercisePlaceholder } from "@/components/exercise/exercise-placeholder";
import { ExerciseSchemeCard, hasScheme } from "@/components/exercise/exercise-scheme";
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
      <ExerciseMedia exercise={exercise} />

      <header className="space-y-1">
        <h2 className="text-[22px] leading-tight font-semibold tracking-tight">{exercise.name}</h2>
        <p className="text-sm text-muted-foreground">{exerciseMeta(exercise)}</p>
      </header>

      <p className="text-base leading-relaxed whitespace-pre-line text-foreground">
        {exercise.technique}
      </p>

      {exercise.warning ? (
        <p className="flex items-start gap-2 rounded-lg bg-accent/12 p-3 text-sm text-foreground">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>{exercise.warning}</span>
        </p>
      ) : null}

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

/**
 * Визуал упражнения (GIMN-013). Порядок: живая гифка → картинка → схема
 * движения со стрелками → знак типа. Последний остался аварийным запасом:
 * у всех упражнений справочника есть либо картинка, либо схема.
 * Картинки грузятся лениво и до загрузки показывают Skeleton (SPEC 4.3).
 */
function ExerciseMedia({ exercise }: { exercise: ExerciseSnapshot }) {
  const [loaded, setLoaded] = useState(false);
  const src = exercise.gif_url ?? exercise.image_url ?? null;

  if (!src) {
    return hasScheme(exercise.slug) ? (
      <ExerciseSchemeCard slug={exercise.slug} />
    ) : (
      <ExercisePlaceholder type={exercise.type} />
    );
  }

  return (
    <figure className="space-y-1">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
        {!loaded ? <Skeleton className="absolute inset-0 size-full" /> : null}
        <Image
          src={src}
          alt={exercise.name}
          fill
          unoptimized
          loading="lazy"
          sizes="(max-width: 640px) 100vw, 480px"
          className={cn("object-contain p-2 transition-opacity", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
        />
      </div>
      {/* Атрибуция источника — требование лицензии картинки. */}
      {exercise.image_credit && !exercise.gif_url ? (
        <figcaption className="text-right text-[11px] text-muted-foreground">
          изображение: {exercise.image_credit}
        </figcaption>
      ) : null}
    </figure>
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
