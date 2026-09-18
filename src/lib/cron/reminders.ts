import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SchemaMissingError, isSchemaMissing } from "@/lib/cron/errors";
import { trySend } from "@/lib/telegram/bot";
import { openAppButton, todayText } from "@/lib/telegram/messages";
import { nowMinutes, startOfTodayUtcIso, timeToMinutes, todayIso } from "@/lib/dates";

/**
 * Рассылка напоминаний (US-08, SPEC 5.10).
 *
 * cron-job.org дёргает эндпоинт каждые 15 минут. Пользователь попадает в
 * рассылку, если его время напоминания лежит в окне последних WINDOW минут.
 * Окно чуть шире шага крона — на случай запоздавшего запуска; дубль в тот
 * же день отсекается по notifications_log.
 */

const WINDOW_MIN = 20;

type Kind = "morning" | "evening";

export type ReminderRun = { candidates: number; sent: number; failed: number; skipped: number };

export async function runReminders(kind: Kind, now: Date = new Date()): Promise<ReminderRun> {
  const admin = createAdminClient();
  const minutes = nowMinutes(now);
  const column = kind === "morning" ? "morning_reminder_time" : "evening_reminder_time";
  const logType = kind === "morning" ? "morning_reminder" : "evening_reminder";

  const { data: users, error } = await admin
    .from("users")
    .select(`id, telegram_id, ${column}`)
    .eq("reminders_enabled", true)
    .not("telegram_id", "is", null);

  if (isSchemaMissing(error)) throw new SchemaMissingError();
  if (error) throw new Error(`users query failed: ${error.message}`);

  const due = (users ?? []).filter((u) => {
    const time = (u as unknown as Record<string, string>)[column];
    const diff = minutes - timeToMinutes(time);
    return diff >= 0 && diff < WINDOW_MIN;
  });

  const run: ReminderRun = { candidates: due.length, sent: 0, failed: 0, skipped: 0 };
  if (due.length === 0) return run;

  const ids = due.map((u) => u.id);
  const since = startOfTodayUtcIso(now);

  const { data: already } = await admin
    .from("notifications_log")
    .select("user_id")
    .in("user_id", ids)
    .eq("type", logType)
    .eq("status", "sent")
    .gte("sent_at", since);
  const sentToday = new Set((already ?? []).map((r) => r.user_id));

  // Вечером не дёргаем тех, кто уже позанимался.
  let completedToday = new Set<string>();
  if (kind === "evening") {
    const { data: done } = await admin
      .from("user_workouts")
      .select("user_id")
      .in("user_id", ids)
      .eq("scheduled_date", todayIso(now))
      .eq("status", "completed");
    completedToday = new Set((done ?? []).map((r) => r.user_id));
  }

  for (const u of due) {
    if (sentToday.has(u.id) || completedToday.has(u.id) || !u.telegram_id) {
      run.skipped++;
      continue;
    }

    const body = await todayText(admin, u.id);
    const text =
      kind === "morning"
        ? `Доброе утро! ${body}`
        : `Вечер — хорошее время для гимнастики. ${body}`;

    const result = await trySend(u.telegram_id, text, openAppButton("Начать тренировку"));

    await admin.from("notifications_log").insert({
      user_id: u.id,
      type: logType,
      channel: "telegram",
      status: result.ok ? "sent" : "failed",
      error: result.ok ? null : result.error,
    });

    if (result.ok) run.sent++;
    else run.failed++;
  }

  return run;
}
