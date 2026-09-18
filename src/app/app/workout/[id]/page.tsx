import { notFound, redirect } from "next/navigation";

import { WorkoutRunner } from "@/components/workout/workout-runner";
import { createClient } from "@/lib/supabase/server";
import type { ExerciseSnapshot, FeedbackStatus } from "@/lib/supabase/types";

export const metadata = { title: "Тренировка — Гимн.здоровья" };

export default async function WorkoutPage({ params }: PageProps<"/app/workout/[id]">) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: workout } = await supabase
    .from("user_workouts")
    .select("id, exercises_snapshot, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!workout) notFound();

  // Уже поставленные отметки — чтобы продолжить с места, где остановились.
  const { data: feedback } = await supabase
    .from("workout_feedback")
    .select("exercise_id, status")
    .eq("user_workout_id", id);

  const initialMarks: Record<string, FeedbackStatus> = {};
  for (const row of feedback ?? []) {
    if (row.exercise_id) initialMarks[row.exercise_id] = row.status as FeedbackStatus;
  }

  const exercises = (workout.exercises_snapshot ?? []) as ExerciseSnapshot[];

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md">
        <WorkoutRunner workoutId={workout.id} exercises={exercises} initialMarks={initialMarks} />
      </div>
    </main>
  );
}
