import { NextResponse } from "next/server";

import { parseNotification } from "@/lib/payments/rules";
import { handleNotification } from "@/lib/payments/service";

/**
 * POST /api/payments/webhook — уведомления ЮKassa.
 *
 * Адрес указывается в личном кабинете ЮKassa (Интеграция → HTTP-уведомления),
 * события payment.succeeded и payment.canceled. Входа здесь нет и быть не
 * может: телу не верим, статус платежа сервис перепроверяет у ЮKassa.
 *
 * ЮKassa повторяет уведомление, пока не получит 200, поэтому 500 отдаём
 * только тогда, когда повтор действительно поможет.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const notification = parseNotification(body);
  if (!notification) return NextResponse.json({ ok: false }, { status: 400 });

  const { retry } = await handleNotification(notification);
  return NextResponse.json({ ok: !retry }, { status: retry ? 500 : 200 });
}
