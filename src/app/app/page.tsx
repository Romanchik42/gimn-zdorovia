import { redirect } from "next/navigation";

import { TodayCard } from "@/components/app/today-card";
import { MyWorkouts, type TemplateSummary } from "@/components/app/my-workouts";
import { ShareButton } from "@/components/share/share-button";
import { AppTour } from "@/components/tour/app-tour";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { dayName, focusLabel, resolveSequenceSlug } from "@/lib/workout-engine/weekly-cycle";
import { addDays, dayOfWeek, todayIso } from "@/lib/dates";
import type { Mode, SequenceItem } from "@/lib/supabase/types";
import { cn } from "cn";

export const metadata = { title: "Сегодня — Гимн.здоровья" };

/** Полоска регулярности за последние 7 дней. */
async function loadStreak(userId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const todayStr = todayIso();
  const sinceStr = addDays(todayStr, -6);

  const { data } = await supabase
    .from("user_workouts")
    .select("scheduled_date, status")
    .eq("user_id", userId)
    .gte("scheduled_date", sinceStr);

  const doneDates = new Set(
    (data ?? []).filter((w) => w.status === "completed").map((w) => w.scheduled_date),
  );

  const days: { label: string; done: boolean; isToday: boolean }[] = [];

  for (let i = 6; i >= 0; i--) {
    const key = addDays(todayStr, -i);
    days.push({
      label: dayName(dayOfWeek(key)),
      done: doneDates.has(key),
      isToday: key === todayStr,
    });
  }

  return days;
}

export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const todayStr = todayIso();
  const dow = dayOfWeek(todayStr);

  const [
    { data: profile },
    { data: planDay },
    { data: openWorkout },
    streak,
    { data: templates },
  ] = await Promise.all([
    supabase
      .from("users")
      .select("name, mode, referral_code, tour_completed")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("user_week_plan")
      .select("focus, duration_min, is_rest_day")
      .eq("user_id", user.id)
      .eq("day_of_week", dow)
      .maybeSingle(),
    supabase
      .from("user_workouts")
      .select("id")
      .eq("user_id", user.id)
      .eq("scheduled_date", todayStr)
      .eq("source", "plan")
      .in("status", ["planned", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadStreak(user.id, supabase),
    supabase
      .from("user_custom_workouts")
      .select("id, name, duration_min, exercises_order")
      .eq("user_id", user.id)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Профиля нет — пользователь не прошёл онбординг.
  if (!profile) redirect("/onboarding/welcome");

  const preview = await loadPreview(
    supabase,
    profile.mode,
    dow,
    resolveSequenceSlug(profile.mode, planDay?.focus, planDay?.is_rest_day ?? false),
  );

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Здравствуйте{profile.name ? `, ${profile.name}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">{dayName(dow, true)}</p>
          </div>
          <ShareButton referralCode={profile.referral_code} appUrl={publicEnv.appUrl} />
        </header>

        <AppTour autoStart={!profile.tour_completed} />

        <TodayCard
          focusLabel={focusLabel(planDay?.focus ?? "full_body")}
          durationMin={planDay?.duration_min ?? 30}
          isRestDay={planDay?.is_rest_day ?? false}
          existingWorkoutId={openWorkout?.id ?? null}
          preview={preview}
        />

        <MyWorkouts templates={(templates ?? []) as TemplateSummary[]} />

        <section data-tour="streak" className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Регулярность за неделю</h2>
          <ul className="flex gap-1.5">
            {streak.map((d, i) => (
              <li key={i} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={cn(
                    "h-2 w-full rounded-full",
                    d.done ? "bg-primary" : "bg-muted",
                    d.isToday && !d.done && "ring-1 ring-primary/40",
                  )}
                />
                <span className="text-[11px] text-muted-foreground">{d.label}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

/** Короткий состав дня — без записи в БД, только для показа. */
async function loadPreview(
  supabase: Awaited<ReturnType<typeof createClient>>,
  mode: Mode,
  dayOfWeek: number,
  planSlug: string | null,
) {
  // Та же логика выбора шаблона, что в /api/workout/generate.
  const query = supabase.from("workout_sequences").select("exercises_order").eq("mode", mode);
  const { data: sequence } = await (planSlug
    ? query.eq("slug", planSlug)
    : query.eq("day_of_week", dayOfWeek)
  )
    .limit(1)
    .maybeSingle();

  const items = ((sequence?.exercises_order ?? []) as SequenceItem[])
    .slice()
    .sort((a, b) => a.order - b.order);

  if (items.length === 0) return [];

  const { data: exercises } = await supabase
    .from("exercises")
    .select("slug, name")
    .in(
      "slug",
      items.map((i) => i.slug),
    );

  const names = new Map((exercises ?? []).map((e) => [e.slug, e.name]));

  return items.map((item) => ({
    name: names.get(item.slug) ?? item.slug,
    meta: item.duration_sec
      ? `${item.duration_sec} сек`
      : item.repetitions
        ? `${item.repetitions} раз`
        : "",
  }));
}
