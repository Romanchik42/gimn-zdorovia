"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeftIcon, PartyPopperIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExerciseCard } from "@/components/exercise/exercise-card";
import { SideEffectDialog } from "@/components/exercise/side-effect-dialog";
import type { ExerciseSnapshot, FeedbackStatus } from "@/lib/supabase/types";
import { enqueue, flushQueue } from "@/lib/offline-queue";

/** Пауза перед автопереходом к следующему упражнению (SPEC US-03). */
const ADVANCE_DELAY_MS = 500;

export function WorkoutRunner({
  workoutId,
  exercises,
  initialMarks,
}: {
  workoutId: string;
  exercises: ExerciseSnapshot[];
  initialMarks: Record<string, FeedbackStatus>;
}) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<string, FeedbackStatus>>(initialMarks);
  const [index, setIndex] = useState(() => {
    const firstUnmarked = exercises.findIndex((e) => !initialMarks[e.exercise_id]);
    return firstUnmarked === -1 ? exercises.length : firstUnmarked;
  });
  const [busy, setBusy] = useState(false);
  const [symptomFor, setSymptomFor] = useState<string | null>(null);
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
        else void flushQueue();
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
    timer.current = setTimeout(() => setIndex((i) => i + 1), ADVANCE_DELAY_MS);
  }

  function handleFeedback(status: FeedbackStatus) {
    if (!current || busy) return;

    setBusy(true);
    setMarks((prev) => ({ ...prev, [current.exercise_id]: status }));
    void send(current.exercise_id, status).finally(() => setBusy(false));

    if (status === "difficult") {
      // Сначала выясняем симптом — автопереход подождёт (US-04).
      setSymptomFor(current.exercise_id);
      return;
    }

    advance();
  }

  function goBack() {
    if (timer.current) clearTimeout(timer.current);
    setIndex((i) => Math.max(0, i - 1));
  }

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

      <ExerciseCard exercise={current} onFeedback={handleFeedback} disabled={busy} />

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
