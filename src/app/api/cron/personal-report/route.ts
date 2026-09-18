import { NextResponse } from "next/server";

import { rejectUnlessCron } from "@/lib/cron/auth";
import { runPersonalReports } from "@/lib/cron/personal-report";

/**
 * Персональные отчёты — cron-job.org, ежедневно в 09:00 (SPEC 3.6, 5.10).
 * Обрабатывает только тех, у кого сегодня (или раньше, если пропустили) «день икс».
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handler(request: Request) {
  const denied = rejectUnlessCron(request);
  if (denied) return denied;

  try {
    const result = await runPersonalReports();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("cron personal-report failed:", e);
    return NextResponse.json({ ok: false, error: "report run failed" }, { status: 500 });
  }
}

export { handler as GET, handler as POST };
