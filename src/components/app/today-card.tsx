"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, Loader2Icon, PlayIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "cn";

type PreviewItem = { name: string; meta: string };

/**
 * Карточка «Сегодня». Тренировка генерируется по нажатию, а не при заходе
 * на экран: иначе каждый визит на главную плодил бы записи в user_workouts.
 */
export function TodayCard({
  focusLabel,
  durationMin,
  isRestDay,
  existingWorkoutId,
  preview,
}: {
  focusLabel: string;
  durationMin: number;
  isRestDay: boolean;
  existingWorkoutId: string | null;
  preview: PreviewItem[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);

  async function start() {
    if (existingWorkoutId) {
      router.push(`/app/workout/${existingWorkoutId}`);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/workout/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось собрать тренировку");
        return;
      }

      router.push(`/app/workout/${json.data.workout_id}`);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      data-tour="today-card"
      className="space-y-4 rounded-xl bg-card p-5 ring-1 ring-foreground/10"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Сегодня</p>
        <h2 className="text-lg font-semibold">
          {focusLabel}
          {isRestDay ? " · день отдыха" : ""}
        </h2>
        <p className="text-sm text-muted-foreground">Примерно {durationMin} минут</p>
      </div>

      <Button
        size="lg"
        className="h-14 w-full text-base"
        onClick={start}
        disabled={pending}
        data-tour="start-button"
      >
        {pending ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : (
          <PlayIcon className="size-5" aria-hidden />
        )}
        {existingWorkoutId ? "Продолжить" : "Начать"}
      </Button>

      {preview.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Что будем делать
            <ChevronDownIcon
              className={cn("size-4 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>

          {open ? (
            <ol className="mt-2 space-y-1.5">
              {preview.map((item, i) => (
                <li key={`${item.name}-${i}`} className="flex justify-between gap-3 text-sm">
                  <span>{item.name}</span>
                  <span className="shrink-0 text-muted-foreground">{item.meta}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
