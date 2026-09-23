"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon, Loader2Icon, PartyPopperIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExerciseCard } from "@/components/exercise/exercise-card";
import { SideEffectDialog } from "@/components/exercise/side-effect-dialog";
import { LevelUpDialog } from "@/components/progression/level-up-dialog";
import type { ExerciseSnapshot, FeedbackStatus, WorkoutLength } from "@/lib/supabase/types";
import type { LevelUpOffer } from "@/lib/progression/offer";
import { WORKOUT_LENGTHS, WORKOUT_LENGTH_HINTS, WORKOUT_LENGTH_LABELS } from "@/lib/schemas/workout";
import { cn } from "cn";
import { enqueue, flushQueue } from "@/lib/offline-queue";
import { useSound } from "@/components/layout/sound-provider";
import { WorkoutTour } from "@/components/tour/workout-tour";
import type { SoundEvent } from "@/lib/sound/sound-packs";

const FEEDBACK_SOUND: Record<FeedbackStatus, SoundEvent> = {
  done: "done",
  difficult: "difficult",
  skipped: "skip",
};

/** Пауза перед автопереходом к следующему упражнению (SPEC US-03). */
const ADVANCE_DELAY_MS = 500;

export function WorkoutRunner({
  workoutId,
  exercises,
  initialMarks,
  showTour = false,
  length = null,
  reminders = {},
}: {
  workoutId: string;
  exercises: ExerciseSnapshot[];
  initialMarks: Record<string, FeedbackStatus>;
  /** Первая тренировка: показать короткий тур по кнопкам (US-11). */
  showTour?: boolean;
  /** Длина занятия по плану; null — своя тренировка, длину не меняем. */
  length?: WorkoutLength | null;
  /** exercise_id → «что было в прошлый раз»: предупреждение показывается один раз. */
  reminders?: Record<string, { text: string; eventIds: string[] }>;
}) {
  const router = useRouter();
  const sound = useSound();
  const [marks, setMarks] = useState<Record<string, FeedbackStatus>>(initialMarks);
  const [index, setIndex] = useState(() => {
    const firstUnmarked = exercises.findIndex((e) => !initialMarks[e.exercise_id]);
    return firstUnmarked === -1 ? exercises.length : firstUnmarked;
  });
  const [busy, setBusy] = useState(false);
  const [symptomFor, setSymptomFor] = useState<string | null>(null);
  const [changingTo, setChangingTo] = useState<WorkoutLength | null>(null);
  // Предложение уровня приходит ответом на последнюю отметку (GIMN-028).
  const [levelUp, setLevelUp] = useState<LevelUpOffer | null>(null);
  const remindedRef = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const total = exercises.length;
  const doneCount = Object.values(marks).filter((s) => s === "done").length;
  const markedCount = Object.keys(marks).length;
  const current = exercises[index];

  const send = useCallback(
    async (exerciseId: string, status: FeedbackStatus) => {
      const body = { user_workout_id: workoutId, exercise_id: exerciseId, status };
      try {
        const res = await fetch("/api/workout/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!json.success) toast.error(json.error ?? "Отметка не сохранилась");
        else {
          void flushQueue();
          if (json.data?.level_up) setLevelUp(json.data.level_up as LevelUpOffer);
        }
      } catch {
        // Нет сети: занятие не прерываем, отметку откладываем и дошлём позже.
        enqueue("/api/workout/feedback", body);
        toast.info("Нет сети — отметка сохранена и отправится, когда связь вернётся");
      }
    },
    [workoutId],
  );

  function advance() {
    if (timer.current) clearTimeout(timer.current);
    // Следующий индекс считаем здесь, а не в апдейтере setState: React может
    // вызвать апдейтер дважды, и звук прозвучал бы два раза.
    const next = index + 1;
    timer.current = setTimeout(() => {
      setIndex(next);
      // Финал — победный аккорд; обычный шаг — почти неслышный переход.
      sound.play(next >= total ? "complete" : "transition");
    }, ADVANCE_DELAY_MS);
  }

  function handleFeedback(status: FeedbackStatus) {
    if (!current || busy) return;

    setBusy(true);
    sound.play(FEEDBACK_SOUND[status]);
    setMarks((prev) => ({ ...prev, [current.exercise_id]: status }));
    void send(current.exercise_id, status).finally(() => setBusy(false));

    if (status === "difficult") {
      // Сначала выясняем симптом — автопереход подождёт (US-04).
      setSymptomFor(current.exercise_id);
      return;
    }

    advance();
  }

  async function changeLength(next: WorkoutLength) {
    if (next === length || changingTo) return;
    setChangingTo(next);
    try {
      const res = await fetch("/api/workout/length", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workout_id: workoutId, length: next }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось поменять длину");
        setChangingTo(null);
        return;
      }
      router.replace(`/app/workout/${json.data.workout_id}`);
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      setChangingTo(null);
    }
  }

  // Напоминание на экране — отмечаем показанным (один раз за занятие; сеть
  // упала — не страшно, покажется ещё раз в следующий раз).
  const reminder = current ? reminders[current.exercise_id] : undefined;
  useEffect(() => {
    if (!reminder || !current || remindedRef.current.has(current.exercise_id)) return;
    remindedRef.current.add(current.exercise_id);
    void fetch("/api/workout/reminded", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_ids: reminder.eventIds }),
    }).catch(() => {});
  }, [reminder, current]);

  function goBack() {
    if (timer.current) clearTimeout(timer.current);
    setIndex((i) => Math.max(0, i - 1));
  }

  // Ушли с экрана в те полсекунды, пока ждёт автопереход, — звук следующего
  // упражнения не должен догнать человека уже на другой странице.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Все упражнения отмечены — финальный экран.
  if (index >= total) {
    return (
      <div className="space-y-6 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <PartyPopperIcon className="size-8" aria-hidden />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Тренировка завершена</h1>
          <p className="text-muted-foreground">
            Сделано {doneCount} из {total}
          </p>
        </div>
        <Button asChild size="lg" className="h-12 w-full">
          <Link href="/app">На главный экран</Link>
        </Button>
        <LevelUpDialog offer={levelUp} onClose={() => setLevelUp(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={index === 0 ? () => router.push("/app") : goBack}
          aria-label="Назад"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Progress value={(markedCount / Math.max(total, 1)) * 100} className="h-1.5 flex-1" />
        <span className="font-mono text-xs text-muted-foreground">
          {index + 1}/{total}
        </span>
      </div>

      {/* Длину выбирают до первой отметки: потом занятие уже идёт. */}
      {length && markedCount === 0 && index === 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Сколько сегодня потянете?</p>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Длина занятия">
            {WORKOUT_LENGTHS.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === length}
                disabled={changingTo !== null}
                onClick={() => void changeLength(option)}
                className={cn(
                  "flex min-h-12 flex-col items-center justify-center rounded-xl border px-2 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                  option === length ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
                )}
              >
                <span className="flex items-center gap-1">
                  {changingTo === option ? <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> : null}
                  {WORKOUT_LENGTH_LABELS[option]}
                </span>
                <span className="text-[11px] font-normal text-muted-foreground">{WORKOUT_LENGTH_HINTS[option]}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {reminder ? (
        <p className="flex items-start gap-2 rounded-xl bg-accent/15 p-3 text-sm" role="note">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            В прошлый раз здесь было: {reminder.text}. Будьте осторожнее.
          </span>
        </p>
      ) : null}

      {current.replaced ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground" role="note">
          <RefreshCwIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {current.replaced_reason === "position"
            ? `Вместо «${current.replaced}» — в удобном для вас положении.`
            : current.replaced_reason === "gentle"
              ? `Щадящий вариант вместо «${current.replaced}» — мягко развиваем подвижность.`
              : `Полегче вместо «${current.replaced}» — на прошлой неделе оно давалось тяжело.`}
        </p>
      ) : null}

      <ExerciseCard exercise={current} onFeedback={handleFeedback} disabled={busy} />
      <WorkoutTour autoStart={showTour && index === 0} />

      <SideEffectDialog
        open={symptomFor !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSymptomFor(null);
            advance();
          }
        }}
        workoutId={workoutId}
        exerciseId={symptomFor ?? ""}
        onContinue={() => {
          setSymptomFor(null);
          advance();
        }}
        onStop={() => {
          setSymptomFor(null);
          router.push("/app");
        }}
      />
    </div>
  );
}
