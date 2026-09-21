"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon, PlusIcon, SearchIcon, TriangleAlertIcon } from "lucide-react";

import Image from "next/image";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  EXERCISE_TYPES,
  JOINT_LABELS,
  TARGET_JOINTS,
  TYPE_LABELS,
  exerciseMeta,
} from "@/lib/exercise-labels";
import { ExerciseScheme, hasScheme } from "@/components/exercise/exercise-scheme";
import type { ExerciseType, TargetJoint } from "@/lib/supabase/types";
import { cn } from "cn";

export type CatalogExercise = {
  id: string;
  slug: string;
  name: string;
  type: ExerciseType;
  target_joint: TargetJoint;
  duration_sec: number | null;
  repetitions: number | null;
  description: string;
  technique: string;
  gif_url: string | null;
  image_url: string | null;
  image_credit: string | null;
  /** Текст предупреждения, если упражнение противопоказано этому пользователю. */
  warning: string | null;
};

/**
 * Значок движения в строке каталога (GIMN-013): та же картинка или схема,
 * что и в тренировке, только маленькая — чтобы упражнение узнавалось
 * до раскрытия. Схема рисуется кодом, поэтому 60 значков ничего не грузят.
 */
function CatalogThumb({ exercise }: { exercise: CatalogExercise }) {
  const src = exercise.gif_url ?? exercise.image_url ?? null;

  if (src) {
    // Превью вместо оригинала: анимация дыхания весит 417 КБ, а значку
    // хватает полутора. Полная картинка открывается в самой тренировке.
    // Файлы делает scripts/build-exercise-thumbs.mjs.
    const thumb = src.replace(/\.(gif|webp|png|jpg)$/i, "-thumb.webp");
    return (
      <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-primary/8">
        <Image src={thumb} alt="" fill unoptimized loading="lazy" sizes="48px" className="object-contain p-0.5" />
      </span>
    );
  }
  if (hasScheme(exercise.slug)) {
    return (
      <span className="size-12 shrink-0 rounded-lg bg-primary/8">
        <ExerciseScheme slug={exercise.slug} className="size-full" compact />
      </span>
    );
  }
  return null;
}

const DURATION_FILTERS = [
  { id: "all", label: "Любые" },
  { id: "short", label: "До 1 мин" },
  { id: "long", label: "Дольше 1 мин" },
] as const;

type DurationFilter = (typeof DURATION_FILTERS)[number]["id"];

/** Оценка длительности упражнения в секундах (повтор ≈ 4 секунды). */
function approxSeconds(e: CatalogExercise): number {
  return e.duration_sec ?? (e.repetitions ?? 0) * 4;
}

/**
 * Каталог упражнений с фильтрами (US-05).
 * Если передан onPick — работает в режиме выбора для конструктора:
 * противопоказанные показаны серым с ⚠️ и добавляются только после
 * подтверждения. Не блокируем — предупреждаем.
 */
export function ExerciseBrowser({
  exercises,
  onPick,
  pickedIds,
}: {
  exercises: CatalogExercise[];
  onPick?: (exercise: CatalogExercise) => void;
  pickedIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const [joint, setJoint] = useState<TargetJoint | "all">("all");
  const [type, setType] = useState<ExerciseType | "all">("all");
  const [duration, setDuration] = useState<DurationFilter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const picked = useMemo(() => new Set(pickedIds ?? []), [pickedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (joint !== "all" && e.target_joint !== joint) return false;
      if (type !== "all" && e.type !== type) return false;
      if (duration === "short" && approxSeconds(e) > 60) return false;
      if (duration === "long" && approxSeconds(e) <= 60) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, joint, type, duration, query]);

  function pick(e: CatalogExercise) {
    if (!onPick) return;
    if (e.warning && confirming !== e.id) {
      setConfirming(e.id);
      return;
    }
    setConfirming(null);
    onPick(e);
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию"
          className="h-11 pl-9"
          aria-label="Поиск упражнения"
        />
      </div>

      <ChipRow
        label="Зона"
        options={[
          { id: "all", label: "Все" },
          ...TARGET_JOINTS.map((j) => ({ id: j, label: JOINT_LABELS[j] })),
        ]}
        value={joint}
        onChange={(v) => setJoint(v as TargetJoint | "all")}
      />
      <ChipRow
        label="Тип"
        options={[
          { id: "all", label: "Все" },
          ...EXERCISE_TYPES.map((t) => ({ id: t, label: TYPE_LABELS[t] })),
        ]}
        value={type}
        onChange={(v) => setType(v as ExerciseType | "all")}
      />
      <ChipRow
        label="Длительность"
        options={DURATION_FILTERS.map((d) => ({ id: d.id, label: d.label }))}
        value={duration}
        onChange={(v) => setDuration(v as DurationFilter)}
      />

      <p className="text-xs text-muted-foreground">Найдено: {filtered.length}</p>

      <ul className="space-y-2">
        {filtered.map((e) => {
          const isOpen = expanded === e.id;
          const isPicked = picked.has(e.id);
          const isConfirming = confirming === e.id;

          return (
            <li
              key={e.id}
              className={cn(
                "rounded-xl bg-card ring-1 ring-foreground/10",
                e.warning && "opacity-70",
              )}
            >
              <div className="flex items-center gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : e.id)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 flex-1 items-center gap-2.5 text-left"
                >
                  <CatalogThumb exercise={e} />
                  <span className="flex-1">
                    <span className="flex items-center gap-1.5 font-medium">
                      {e.warning ? (
                        <TriangleAlertIcon className="size-4 shrink-0 text-accent" aria-label="Есть противопоказание" />
                      ) : null}
                      {e.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {exerciseMeta(e)} · {JOINT_LABELS[e.target_joint]}
                    </span>
                  </span>
                  <ChevronDownIcon
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>

                {onPick ? (
                  <Button
                    size="icon"
                    variant={isPicked ? "secondary" : "outline"}
                    className="size-11 shrink-0"
                    onClick={() => pick(e)}
                    // Дважды одно упражнение нельзя: отметки хранятся по паре
                    // «тренировка + упражнение», и вторая затёрла бы первую.
                    disabled={isPicked}
                    aria-label={isPicked ? "Уже в тренировке" : "Добавить в тренировку"}
                  >
                    {isPicked ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
                  </Button>
                ) : null}
              </div>

              {isConfirming ? (
                <div className="space-y-2 border-t border-border p-3">
                  <p className="text-sm">
                    Вы добавляете упражнение, которое может усилить боль. Делайте осторожно,
                    при боли — сразу остановитесь.
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-10 flex-1" onClick={() => pick(e)}>
                      Понимаю, добавить
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-10 flex-1"
                      onClick={() => setConfirming(null)}
                    >
                      Отмена
                    </Button>
                  </div>
                </div>
              ) : null}

              {isOpen ? (
                <div className="space-y-2 border-t border-border p-3 text-sm">
                  {!e.gif_url && !e.image_url && hasScheme(e.slug) ? (
                    <ExerciseScheme slug={e.slug} className="mx-auto aspect-[4/3] w-full max-w-56" />
                  ) : null}
                  {e.image_credit && !e.gif_url ? (
                    <p className="text-right text-[11px] text-muted-foreground">
                      изображение: {e.image_credit}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground">{e.description}</p>
                  <p className="leading-relaxed whitespace-pre-line">{e.technique}</p>
                  {e.warning && !isConfirming ? (
                    <p className="flex items-start gap-2 rounded-lg bg-accent/12 p-2">
                      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                      {e.warning}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Под эти фильтры упражнений нет.
        </p>
      ) : null}
    </div>
  );
}

function ChipRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "min-h-9 shrink-0 rounded-full border px-3 text-sm whitespace-nowrap transition-colors",
              value === o.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:bg-muted",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
