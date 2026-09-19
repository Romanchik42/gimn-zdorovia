import { notFound, redirect } from "next/navigation";

import { WorkoutRunner } from "@/components/workout/workout-runner";
import { createClient } from "@/lib/supabase/server";
import { SYMPTOM_LABELS } from "@/lib/schemas/workout-feedback";
import { resolveWorkoutLength } from "@/lib/workout-engine/length";
import type { ExerciseSnapshot, FeedbackStatus, Symptom } from "@/lib/supabase/types";

export const metadata = { title: "Тренировка — Гимн.здоровья" };

/** «Поднялось давление» → «поднялось давление»: фраза встаёт в середину предложения. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export default async function WorkoutPage({ params }: PageProps<"/app/workout/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: workout } = await supabase
    .from("user_workouts")
    .select("id, exercises_snapshot, status, source")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workout) notFound();

  const exercises = (workout.exercises_snapshot ?? []) as ExerciseSnapshot[];
  const exerciseIds = exercises.map((e) => e.exercise_id);

  const [{ data: feedback }, { data: profile }, { data: diagnostics }, { data: pastEvents }] = await Promise.all([
    // Уже поставленные отметки — чтобы продолжить с места, где остановились.
    supabase.from("workout_feedback").select("exercise_id, status").eq("user_workout_id", id),
    supabase.from("users").select("workout_tour_completed, workout_length, mode").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_diagnostics")
      .select("calculated_intensity")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Симптомы на этих упражнениях в прошлых занятиях, о которых ещё не напоминали.
    exerciseIds.length
      ? supabase
          .from("side_effect_events")
          .select("id, exercise_id, symptom, description, created_at")
          .eq("user_id", user.id)
          .in("exercise_id", exerciseIds)
          .neq("user_workout_id", id)
          .is("reminded_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; exercise_id: string | null; symptom: string; description: string | null }[] }),
  ]);

  const initialMarks: Record<string, FeedbackStatus> = {};
  for (const row of feedback ?? []) {
    if (row.exercise_id) initialMarks[row.exercise_id] = row.status as FeedbackStatus;
  }

  // Одно напоминание на упражнение — по последнему случаю. Текст — тот, что
  // выбрал сам человек; для «Другое» — его собственное описание. Отметку
  // «показано» ставит клиент, когда карточка реально на экране: иначе
  // напоминание о пятом упражнении сгорело бы, если человек ушёл на втором.
  const reminders: Record<string, { text: string; eventIds: string[] }> = {};
  for (const event of pastEvents ?? []) {
    if (!event.exercise_id) continue;
    const existing = reminders[event.exercise_id];
    if (existing) {
      existing.eventIds.push(event.id);
      continue;
    }
    const symptom = event.symptom as Symptom;
    reminders[event.exercise_id] = {
      text: symptom === "other" && event.description ? event.description : lowerFirst(SYMPTOM_LABELS[symptom] ?? ""),
      eventIds: [event.id],
    };
  }

  const length =
    workout.source === "plan" && profile
      ? resolveWorkoutLength(profile.workout_length, profile.mode, diagnostics?.calculated_intensity)
      : null;

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <WorkoutRunner
          workoutId={workout.id}
          exercises={exercises}
          initialMarks={initialMarks}
          showTour={profile ? !profile.workout_tour_completed : false}
          length={length}
          reminders={reminders}
        />
      </div>
    </main>
  );
}
