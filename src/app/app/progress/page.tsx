import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarClockIcon, HistoryIcon, LightbulbIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProgressChart, type ChartPoint } from "@/components/progress/progress-chart";
import { MeasurementForm } from "@/components/progress/measurement-form";
import { BodyMeasurements } from "@/components/progress/body-measurements";
import { createClient } from "@/lib/supabase/server";
import { currentMode } from "@/lib/modes/server";
import { addDays, datesFrom, todayIso, weekStartOf } from "@/lib/dates";

export const metadata = { title: "Прогресс — Гимн.здоровья" };

/** Период графиков (US-09: «за 3 месяца»). */
const RANGE_DAYS = 90;
const REGULARITY_WEEKS = 12;

/** «2026-09-17» → «17.09» — компактно для оси на 320px. */
function shortLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
}

/** Дату из YYYY-MM-DD берём в полдень UTC, чтобы пояс не сдвинул день. */
function longDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00Z`), "d MMMM", { locale: ru });
}

/** Несколько замеров за день схлопываем в последний. */
function series(rows: { date: string; value: number | null }[]): ChartPoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) if (r.value !== null && r.value !== undefined) byDate.set(r.date, Number(r.value));
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ label: shortLabel(date), value }));
}

export default async function ProgressPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const today = todayIso();
  const since = addDays(today, -RANGE_DAYS);
  const regularitySince = addDays(weekStartOf(today), -7 * (REGULARITY_WEEKS - 1));

  const mode = await currentMode(supabase, user.id);

  const [
    { data: profile },
    { data: progress },
    { data: diagnostics },
    { data: general },
    { data: workouts },
    { data: report },
  ] = await Promise.all([
    supabase.from("users").select("mode, next_report_date").eq("id", user.id).maybeSingle(),
    supabase
      .from("user_progress")
      // "*": обхваты появляются с миграцией 0024, а деплой и миграция не
      // атомарны — перечисление уронило бы весь запрос до её применения.
      .select("*")
      .eq("user_id", user.id)
      .gte("date", since)
      .order("date"),
    supabase
      .from("user_diagnostics")
      .select("created_at, shober_test_cm")
      .eq("user_id", user.id)
      .gte("created_at", since)
      .order("created_at"),
    supabase
      .from("user_profiles_general")
      .select("weight_kg, created_at")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("user_workouts")
      .select("scheduled_date")
      .eq("user_id", user.id)
      .eq("mode", mode)
      .eq("status", "completed")
      .gte("scheduled_date", regularitySince),
    supabase
      .from("personal_reports")
      .select("period_number, period_end, recommendation")
      .eq("user_id", user.id)
      .eq("mode", mode)
      .order("period_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isBehtereva = mode === "behtereva";

  // Гибкость: первичная диагностика + ручные замеры.
  const flexibility = series([
    ...(diagnostics ?? []).map((d) => ({
      date: d.created_at.slice(0, 10),
      value: d.shober_test_cm,
    })),
    ...(progress ?? []).map((p) => ({ date: p.date, value: p.shober_test_cm })),
  ]);

  // Вес: из анкеты (стартовая точка) + ручные замеры.
  const weight = series([
    ...(general && general.created_at.slice(0, 10) >= since
      ? [{ date: general.created_at.slice(0, 10), value: general.weight_kg }]
      : []),
    ...(progress ?? []).map((p) => ({ date: p.date, value: p.weight_kg })),
  ]);

  const stiffness = series((progress ?? []).map((p) => ({ date: p.date, value: p.stiffness_level })));

  // Регулярность: завершённые тренировки по неделям, включая пустые недели.
  const perWeek = new Map<string, number>();
  for (const w of workouts ?? []) {
    const wk = weekStartOf(w.scheduled_date);
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1);
  }
  const regularity: ChartPoint[] = datesFrom(regularitySince, REGULARITY_WEEKS * 7)
    .filter((_, i) => i % 7 === 0)
    .map((wk) => ({ label: shortLabel(wk), value: perWeek.get(wk) ?? 0 }));

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Прогресс</h1>
            <p className="text-sm text-muted-foreground">Последние 3 месяца</p>
          </div>
          <Button asChild variant="outline" className="h-11 shrink-0">
            <Link href="/app/history">
              <HistoryIcon className="size-4" aria-hidden />
              История
            </Link>
          </Button>
        </header>

        <section className="space-y-2 rounded-xl bg-primary/8 p-4">
          <h2 className="flex items-center gap-2 font-medium">
            <LightbulbIcon className="size-4 text-primary" aria-hidden />
            Рекомендация системы
          </h2>
          <p className="text-sm leading-relaxed">
            {report?.recommendation ??
              "Первый персональный отчёт придёт через 30 дней после регистрации. Пока просто занимайтесь — система соберёт данные."}
          </p>
          {profile?.next_report_date ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" aria-hidden />
              Следующий отчёт: {longDate(profile.next_report_date)}
            </p>
          ) : null}
        </section>

        <MeasurementForm showShober={isBehtereva} />

        <BodyMeasurements rows={progress ?? []} />

        <ProgressChart
          title="Регулярность"
          subtitle="Завершённых тренировок в неделю"
          data={regularity}
          unit="трен."
          kind="bar"
        />

        {isBehtereva ? (
          <ProgressChart
            title="Гибкость"
            subtitle="Тест Шобера, см — чем больше, тем лучше"
            data={flexibility}
            unit="см"
            domain={[0, "auto"]}
            emptyText="Добавьте замер теста Шобера, чтобы видеть динамику."
          />
        ) : null}

        <ProgressChart
          title="Вес"
          subtitle="кг"
          data={weight}
          unit="кг"
          emptyText="Добавьте замер веса, чтобы видеть динамику."
        />

        <ProgressChart
          title="Скованность"
          subtitle="По утрам, 1-10 — чем меньше, тем лучше"
          data={stiffness}
          unit=""
          domain={[1, 10]}
          emptyText="Отмечайте скованность в замерах."
        />
      </div>
    </main>
  );
}
