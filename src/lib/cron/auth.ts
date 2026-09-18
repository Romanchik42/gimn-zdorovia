import "server-only";

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";

/**
 * Проверка `Authorization: Bearer ${CRON_SECRET}` (SPEC 5.8).
 * Возвращает готовый ответ-отказ или null, если запрос от нашего планировщика.
 */
export function rejectUnlessCron(request: Request): NextResponse | null {
  let secret: string | undefined;
  try {
    secret = serverEnv().CRON_SECRET;
  } catch {
    secret = undefined;
  }

  // Без секрета эндпоинт закрыт полностью — открытый крон рассылал бы спам по запросу любого.
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const header = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return null;
}
