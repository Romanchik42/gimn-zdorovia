import "server-only";

import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { createAdminClient } from "@/lib/supabase/admin";
import { SchemaMissingError, isSchemaMissing } from "@/lib/cron/errors";
import { trySend } from "@/lib/telegram/bot";
import { openAppButton, webAppUrl } from "@/lib/telegram/messages";
import { addDays, todayIso } from "@/lib/dates";
import { decide, type Adjustment, type PeriodStats } from "@/lib/workout-engine/adaptation";
import { PLAN_FOCUSES, focusLabel } from "@/lib/workout-engine/weekly-cycle";
import type { Intensity, Mode } from "@/lib/supabase/types";
import { MODE_LABELS } from "@/lib/modes";

/**
 * Персональный отчёт каждые 30 дней от регистрации (SPEC 3.6, 5.5).
 * Крон ходит ежедневно, но берёт только тех, у кого «день икс» сегодня
 * (или был пропущен — тогда догоняем, чтобы отчёт не потерялся).
 */

const PERIOD_DAYS = 30;
const BATCH_LIMIT = 200;

type Admin = ReturnType<typeof createAdminClient>;

export type ReportRun = { due: number; created: number; sent: number; skipped: number; failed: number };

export async function runPersonalReports(now: Date = new Date()): Promise<ReportRun> {
  const admin = createAdminClient();
  const today = todayIso(now);

  const { data: users, error } = await admin
    .from("users")
    .select("id, mode, telegram_id, next_report_date")
    .lte("next_report_date", today)
    .order("next_report_date")
    .limit(BATCH_LIMIT);

  if (isSchemaMissing(error)) throw new SchemaMissingError();
  if (error) throw new Error(`users query failed: ${error.message}`);

  const run: ReportRun = { due: users?.length ?? 0, created: 0, sent: 0, skipped: 0, failed: 0 };

  for (const u of users ?? []) {
    // Отчёт — на каждый активный режим отдельно (GIMN-012): у режимов разные
    // тренировки и разный план, смешивать их в один вывод бессмысленно.
    const { data: modeRows } = await admin
      .from("user_modes")
      .select("mode")
      .eq("user_id", u.id)
      .eq("is_active", true);

    const modes = [...new Set([...(modeRows ?? []).map((r) => r.mode as Mode), u.mode])];
    let advanced = true;

    for (const mode of modes) {
      try {
        const outcome = await reportFor(admin, u, mode, today, modes.length > 1);
        if (outcome === "created") run.created++;
        else run.skipped++;
      } catch (e) {
        run.failed++;
        advanced = false;
        console.error(`personal report failed for ${u.id} (${mode}):`, e);
      }
    }

    // Дату двигаем один раз на пользователя и только если ни один режим не упал:
    // иначе отчёт по упавшему режиму потерялся бы на целый месяц.
    if (advanced) {
      let next = u.next_report_date;
      while (next <= today) next = addDays(next, PERIOD_DAYS);
      await admin.from("users").update({ next_report_date: next }).eq("id", u.id);
    }
  }

  // Считаем фактически отправленные — по флагу, а не по попыткам.
  const { count } = await admin
    .from("personal_reports")
    .select("id", { count: "exact", head: true })
    .eq("sent_to_telegram", true)
    .gte("created_at", new Date(`${today}T00:00:00+03:00`).toISOString());
  run.sent = count ?? 0;

  return run;
}

function firstLast(values: (number | null | undefined)[]): [number | null, number | null] {
  const nums = values.filter((v): v is number => typeof v === "number");
  return nums.length >= 2 ? [nums[0], nums[nums.length - 1]] : [null, null];
}

async function reportFor(
  admin: Admin,
  u: { id: string; mode: Mode; telegram_id: number | null; next_report_date: string },
  mode: Mode,
  today: string,
  labelMode: boolean,
): Promise<"created" | "skipped"> {
  const periodEnd = addDays(u.next_report_date, -1);
  const periodStart = addDays(u.next_report_date, -PERIOD_DAYS);
  const sinceTs = new Date(`${periodStart}T00:00:00+03:00`).toISOString();
  const untilTs = new Date(`${u.next_report_date}T00:00:00+03:00`).toISOString();

  const [
    { count: reportsSoFar },
    { data: workouts },
    { count: sideEffects },
    { data: progress },
    { data: diagnostics },
    { data: general },
    { data: plan },
  ] = await Promise.all([
    admin
      .from("personal_reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id)
      .eq("mode", mode),
    admin
      .from("user_workouts")
      .select("source")
      .eq("user_id", u.id)
      .eq("mode", mode)
      .eq("status", "completed")
      .gte("scheduled_date", periodStart)
      .lte("scheduled_date", periodEnd),
    admin
      .from("side_effect_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", u.id)
      .neq("symptom", "just_hard")
      .gte("created_at", sinceTs)
      .lt("created_at", untilTs),
    admin
      .from("user_progress")
      .select("date, weight_kg, shober_test_cm, stiffness_level")
      .eq("user_id", u.id)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .order("date"),
    admin
      .from("user_diagnostics")
      .select("calculated_focus")
      .eq("user_id", u.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("user_profiles_general").select("goal").eq("user_id", u.id).maybeSingle(),
    admin
      .from("user_week_plan")
      .select("day_of_week, focus, duration_min, intensity, is_rest_day, is_custom")
      .eq("user_id", u.id)
      .eq("mode", mode),
  ]);

  const [shoberFirst, shoberLast] = firstLast((progress ?? []).map((p) => p.shober_test_cm));
  const [stiffnessFirst, stiffnessLast] = firstLast((progress ?? []).map((p) => p.stiffness_level));
  const [weightFirst, weightLast] = firstLast((progress ?? []).map((p) => p.weight_kg));

  // Новая зона для смены акцента: из диагностики, а если её нет — из фокусов режима.
  const inPlan = new Set((plan ?? []).map((d) => d.focus));
  const candidates = [
    ...((diagnostics?.calculated_focus as string[] | undefined) ?? []),
    ...PLAN_FOCUSES[mode],
  ].filter((f) => !inPlan.has(f) && f !== "breathing" && f !== "stretch");
  const newFocus = candidates[0] ?? null;

  const stats: PeriodStats = {
    mode,
    goal: general?.goal ?? null,
    workouts: workouts?.length ?? 0,
    periodDays: PERIOD_DAYS,
    sideEffects: sideEffects ?? 0,
    shoberFirst,
    shoberLast,
    stiffnessFirst,
    stiffnessLast,
    weightFirst,
    weightLast,
    newFocusLabel: newFocus ? focusLabel(newFocus) : null,
  };

  const verdict = decide(stats);
  const periodNumber = (reportsSoFar ?? 0) + 1;

  const { error: insertError } = await admin.from("personal_reports").insert({
    user_id: u.id,
    mode,
    period_number: periodNumber,
    period_start: periodStart,
    period_end: periodEnd,
    flexibility_change_percent:
      shoberFirst && shoberLast ? Math.round(((shoberLast - shoberFirst) / shoberFirst) * 10000) / 100 : null,
    weight_change_kg: weightFirst !== null && weightLast !== null ? Math.round((weightLast - weightFirst) * 100) / 100 : null,
    stiffness_change: stiffnessFirst !== null && stiffnessLast !== null ? stiffnessLast - stiffnessFirst : null,
    total_workouts: stats.workouts,
    custom_workouts: (workouts ?? []).filter((w) => w.source !== "plan").length,
    side_effects_count: stats.sideEffects,
    recommendation: verdict.recommendation,
    adjustment_applied: verdict.adjustment,
  });

  // Сбой записи — дату НЕ сдвигаем: завтрашний запуск попробует снова,
  // а не пропустит отчёт на целый месяц.
  const duplicate = insertError?.code === "23505";
  if (insertError && !duplicate) throw new Error(insertError.message);

  if (duplicate) return "skipped";

  // Дату следующего отчёта двигает вызывающий цикл — она общая на пользователя.
  let next = u.next_report_date;
  while (next <= today) next = addDays(next, PERIOD_DAYS);

  await applyAdjustment(admin, u.id, mode, verdict.adjustment, newFocus, plan ?? []);

  if (u.telegram_id) {
    const text = reportText(periodNumber, stats, verdict.recommendation, next, labelMode);
    const result = await trySend(u.telegram_id, text, openAppButton("Открыть прогресс", webAppUrl("/app/progress")));

    await admin.from("notifications_log").insert({
      user_id: u.id,
      type: "personal_report",
      channel: "telegram",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
    });

    if (result.ok) {
      await admin
        .from("personal_reports")
        .update({ sent_to_telegram: true })
        .eq("user_id", u.id)
        .eq("mode", mode)
        .eq("period_number", periodNumber);
    }
  }

  return "created";
}

const HARDER: Record<Intensity, Intensity> = { low: "medium", medium: "high", high: "high" };

/**
 * Применяет решение к недельному плану. Дни, которые пользователь правил
 * сам (is_custom), не трогаем: его решение важнее автоматики.
 */
async function applyAdjustment(
  admin: Admin,
  userId: string,
  mode: Mode,
  adjustment: Adjustment,
  newFocus: string | null,
  plan: { day_of_week: number; focus: string; duration_min: number; intensity: Intensity; is_rest_day: boolean; is_custom: boolean }[],
): Promise<void> {
  const editable = plan.filter((d) => !d.is_custom && !d.is_rest_day);
  if (editable.length === 0 || adjustment === "keep") return;

  type PlanPatch = { intensity?: Intensity; duration_min?: number; focus?: string };
  const updates = editable.flatMap((d): { day: number; patch: PlanPatch }[] => {
    switch (adjustment) {
      case "harder":
        return [{ day: d.day_of_week, patch: { intensity: HARDER[d.intensity] } }];
      case "reduce_and_doctor":
        return [{ day: d.day_of_week, patch: { intensity: "low" } }];
      case "simplify":
        return [{ day: d.day_of_week, patch: { duration_min: Math.min(d.duration_min, 20) } }];
      default:
        return [];
    }
  });

  // Смена акцента: последний редактируемый день недели получает новую зону.
  if (adjustment === "change_focus" && newFocus) {
    const last = editable[editable.length - 1];
    updates.push({ day: last.day_of_week, patch: { focus: newFocus } });
  }

  for (const { day, patch } of updates) {
    await admin
      .from("user_week_plan")
      .update(patch)
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("day_of_week", day);
  }
}

function reportText(
  period: number,
  s: PeriodStats,
  recommendation: string,
  nextDate: string,
  labelMode: boolean,
): string {
  // Режим в заголовке — только когда режимов два: иначе это лишний шум.
  const head = labelMode
    ? `Персональный отчёт №${period} за 30 дней — ${MODE_LABELS[s.mode]}`
    : `Персональный отчёт №${period} за 30 дней`;
  const lines = [head, "", `Тренировок: ${s.workouts}`];

  if (s.shoberFirst !== null && s.shoberLast !== null) {
    lines.push(`Тест Шобера: ${fmt(s.shoberFirst)} → ${fmt(s.shoberLast)} см`);
  }
  if (s.weightFirst !== null && s.weightLast !== null) {
    lines.push(`Вес: ${fmt(s.weightFirst)} → ${fmt(s.weightLast)} кг`);
  }
  if (s.stiffnessFirst !== null && s.stiffnessLast !== null) {
    lines.push(`Скованность: ${s.stiffnessFirst} → ${s.stiffnessLast} из 10`);
  }
  if (s.sideEffects > 0) lines.push(`Отметок о плохом самочувствии: ${s.sideEffects}`);

  lines.push(
    "",
    recommendation,
    "",
    `Следующий отчёт: ${format(new Date(`${nextDate}T12:00:00Z`), "d MMMM", { locale: ru })}`,
  );
  return lines.join("\n");
}

function fmt(n: number): string {
  return String(Math.round(n * 10) / 10).replace(".", ",");
}
