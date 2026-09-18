import { NextResponse } from "next/server";

import { rejectUnlessCron } from "@/lib/cron/auth";
import { runReminders } from "@/lib/cron/reminders";

/**
 * Вечерние напоминания — cron-job.org, каждые 15 минут (SPEC 5.10).
 * Принимаем и POST, и GET: у cron-job.org метод по умолчанию GET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const denied = rejectUnlessCron(request);
  if (denied) return denied;

  try {
    const result = await runReminders("evening");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron evening-reminder failed:", e);
    return NextResponse.json({ ok: false, error: "reminder run failed" }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
