import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CheckIcon, ChevronLeftIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { currentMode } from "@/lib/modes/server";
import { SYMPTOM_LABELS } from "@/lib/schemas/workout-feedback";
import type { ExerciseSnapshot, FeedbackStatus, Symptom, WorkoutStatus } from "@/lib/supabase/types";

export const metadata = { title: "История — Гимн.здоровья" };

const HISTORY_LIMIT = 60;

const STATUS_LABELS: Record<WorkoutStatus, string> = {
  planned: "Запланирована",
  in_progress: "Не закончена",
  completed: "Завершена",
  skipped: "Пропущена",
};

const SOURCE_LABELS: Record<string, string> = {
  plan: "По плану",
  custom: "Своя",
  template: "Шаблон",
};

const MARK_ICON: Record<FeedbackStatus, React.ReactNode> = {
  done: <CheckIcon className="size-3.5 text-success" aria-label="Сделано" />,
  difficult: <TriangleAlertIcon className="size-3.5 text-accent" aria-label="Тяжело" />,
  skipped: <XIcon className="size-3.5 text-muted-foreground" aria-label="Пропущено" />,
};

function longDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00Z`), "d MMMM, EEEEEE", { locale: ru });
}

/** История занятий и отметок (SPEC 0.4). */
export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const mode = await currentMode(supabase, user.id);

  const { data: workouts } = await supabase
    .from("user_workouts")
    .select("id, scheduled_date, status, source, exercises_snapshot")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("scheduled_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const ids = (workouts ?? []).map((w) => w.id);

  const [{ data: feedback }, { data: sideEffects }] = await Promise.all([
    ids.length
      ? supabase
          .from("workout_feedback")
          .select("user_workout_id, exercise_id, status")
          .in("user_workout_id", ids)
      : Promise.resolve({ data: [] as { user_workout_id: string; exercise_id: string | null; status: FeedbackStatus }[] }),
    ids.length
      ? supabase
          .from("side_effect_events")
          .select("user_workout_id, symptom")
          .in("user_workout_id", ids)
      : Promise.resolve({ data: [] as { user_workout_id: string | null; symptom: Symptom }[] }),
  ]);

  const marks = new Map<string, Map<string, FeedbackStatus>>();
  for (const f of feedback ?? []) {
    if (!f.exercise_id) continue;
    const m = marks.get(f.user_workout_id) ?? new Map<string, FeedbackStatus>();
    m.set(f.exercise_id, f.status as FeedbackStatus);
    marks.set(f.user_workout_id, m);
  }

  const symptoms = new Map<string, Symptom[]>();
  for (const s of sideEffects ?? []) {
    if (!s.user_workout_id) continue;
    symptoms.set(s.user_workout_id, [...(symptoms.get(s.user_workout_id) ?? []), s.symptom as Symptom]);
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Назад">
            <Link href="/app/progress">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">История занятий</h1>
        </header>

        {(workouts ?? []).length === 0 ? (
          <p className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
            Здесь появятся ваши тренировки и отметки.
          </p>
        ) : (
          <ul className="space-y-2">
            {(workouts ?? []).map((w) => {
              const snapshot = (w.exercises_snapshot ?? []) as ExerciseSnapshot[];
              const wMarks = marks.get(w.id) ?? new Map<string, FeedbackStatus>();
              const done = [...wMarks.values()].filter((s) => s === "done").length;
              const wSymptoms = symptoms.get(w.id) ?? [];

              return (
                <li key={w.id} className="rounded-xl bg-card ring-1 ring-foreground/10">
                  <details>
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 p-4">
                      <span className="space-y-0.5">
                        <span className="block font-medium first-letter:uppercase">
                          {longDate(w.scheduled_date)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {SOURCE_LABELS[w.source] ?? w.source} · сделано {done} из {snapshot.length}
                        </span>
                      </span>
                      <Badge variant={w.status === "completed" ? "default" : "secondary"}>
                        {STATUS_LABELS[w.status as WorkoutStatus] ?? w.status}
                      </Badge>
                    </summary>

                    <div className="space-y-3 border-t border-border p-4">
                      {wSymptoms.length > 0 ? (
                        <p className="flex items-start gap-2 rounded-lg bg-accent/12 p-2 text-xs">
                          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                          {wSymptoms.map((s) => SYMPTOM_LABELS[s] ?? s).join(", ")}
                        </p>
                      ) : null}
                      <ol className="space-y-1 text-sm">
                        {snapshot.map((e) => (
                          <li key={`${e.exercise_id}-${e.order}`} className="flex items-center gap-2">
                            <span className="flex size-4 shrink-0 items-center justify-center">
                              {MARK_ICON[wMarks.get(e.exercise_id) as FeedbackStatus] ?? (
                                <span className="size-1.5 rounded-full bg-border" aria-label="Без отметки" />
                              )}
                            </span>
                            <span className={wMarks.get(e.exercise_id) === "skipped" ? "text-muted-foreground" : undefined}>
                              {e.name}
                            </span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
