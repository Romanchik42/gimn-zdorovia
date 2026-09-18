"use client";

import { useState } from "react";
import { Loader2Icon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SYMPTOMS, SYMPTOM_LABELS } from "@/lib/schemas/workout-feedback";
import { cn } from "cn";

type Advice = { order: number; text: string };

/**
 * Модалка «Что случилось?» (US-04).
 * Советы приходят с сервера из side_effect_rules — здесь их не сочиняем.
 */
export function SideEffectDialog({
  open,
  onOpenChange,
  workoutId,
  exerciseId,
  onContinue,
  onStop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workoutId: string;
  exerciseId: string;
  onContinue: () => void;
  onStop: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [advice, setAdvice] = useState<Advice[] | null>(null);
  const [doctorMessage, setDoctorMessage] = useState<string | null>(null);

  async function report(symptom: string) {
    setPending(true);
    try {
      const res = await fetch("/api/workout/side-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_workout_id: workoutId,
          exercise_id: exerciseId,
          symptom,
          action_taken: "paused",
        }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось отправить");
        return;
      }

      setAdvice(json.data.advice ?? []);
      setDoctorMessage(json.data.doctor_message ?? null);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  function reset() {
    setAdvice(null);
    setDoctorMessage(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-sm">
        {advice === null ? (
          <>
            <DialogHeader>
              <DialogTitle>Что случилось?</DialogTitle>
              <DialogDescription>
                Подскажем, что сделать, и учтём это в следующей тренировке.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              {SYMPTOMS.filter((s) => s !== "other").map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  disabled={pending}
                  onClick={() => report(symptom)}
                  className={cn(
                    "min-h-12 w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-sm font-medium",
                    "transition-colors hover:bg-muted disabled:opacity-50",
                  )}
                >
                  {SYMPTOM_LABELS[symptom]}
                </button>
              ))}
              {pending ? (
                <p className="flex items-center justify-center gap-2 pt-1 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" /> Сохраняем…
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Что сделать сейчас</DialogTitle>
            </DialogHeader>

            <ol className="space-y-2">
              {advice.map((a) => (
                <li key={a.order} className="flex gap-3 text-sm leading-relaxed">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 font-mono text-xs text-primary">
                    {a.order}
                  </span>
                  <span>{a.text}</span>
                </li>
              ))}
            </ol>

            {doctorMessage ? (
              <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <span>{doctorMessage}</span>
              </p>
            ) : null}

            <div className="space-y-2 pt-1">
              <Button
                className="h-12 w-full"
                onClick={() => {
                  reset();
                  onContinue();
                }}
              >
                Продолжить осторожно
              </Button>
              <Button
                variant="outline"
                className="h-12 w-full"
                onClick={() => {
                  reset();
                  onStop();
                }}
              >
                Завершить тренировку
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
