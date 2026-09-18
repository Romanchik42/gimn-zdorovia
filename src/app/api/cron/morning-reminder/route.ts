import { NextResponse } from "next/server";

import { rejectUnlessCron } from "@/lib/cron/auth";
import { SchemaMissingError } from "@/lib/cron/errors";
import { runReminders } from "@/lib/cron/reminders";

/**
 * Утренние напоминания — cron-job.org, каждые 15 минут (SPEC 5.10).
 * Принимаем и POST, и GET: у cron-job.org метод по умолчанию GET.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const denied = rejectUnlessCron(request);
  if (denied) return denied;

  try {
    const result = await runReminders("morning");
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof SchemaMissingError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 503 });
    }
    console.error("cron morning-reminder failed:", e);
    return NextResponse.json({ ok: false, error: "reminder run failed" }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
