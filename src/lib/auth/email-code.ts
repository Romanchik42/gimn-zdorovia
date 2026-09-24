import "server-only";

import { integrationsEnv } from "@/lib/env";

/**
 * Отправка кода на почту (GIMN-029).
 *
 * Провайдер — Resend: ключ и адрес отправителя, больше ничего не нужно.
 * Нужны оба: ключ без подтверждённого адреса даёт отказ на каждой отправке,
 * поэтому канал считается подключённым только когда есть и то и другое —
 * иначе человек вводил бы почту и ждал письма, которого не будет.
 *
 * Файл называется email-code, а не email: рядом лежит provision.ts с
 * telegramEmail, и «email.ts» читалось бы как модуль про адреса вообще.
 */

const ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  const { EMAIL_PROVIDER_KEY, EMAIL_FROM } = integrationsEnv();
  return Boolean(EMAIL_PROVIDER_KEY && EMAIL_FROM);
}

export function emailSubject(code: string): string {
  return `${code} — код для входа в Гимн.здоровья`;
}

export function emailBody(code: string): string {
  return [
    `Ваш код для входа: ${code}`,
    "",
    "Код действует 5 минут. Никому его не сообщайте — он открывает доступ к вашим занятиям.",
    "",
    "Если вы не запрашивали вход, просто удалите это письмо: без кода войти нельзя.",
  ].join("\n");
}

export type SendResult = { ok: true } | { ok: false; error: string };

export async function sendEmailCode(to: string, code: string): Promise<SendResult> {
  const { EMAIL_PROVIDER_KEY, EMAIL_FROM } = integrationsEnv();
  if (!EMAIL_PROVIDER_KEY || !EMAIL_FROM) {
    return { ok: false, error: "Вход по почте пока не подключён" };
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${EMAIL_PROVIDER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject: emailSubject(code),
        text: emailBody(code),
      }),
      cache: "no-store",
    });

    if (res.ok) return { ok: true };

    // Тело ответа Resend содержит причину отказа, но не ключ — его мы
    // передаём заголовком и в лог не пишем.
    const reason = await res.text().catch(() => "");
    console.error("email send failed:", res.status, reason.slice(0, 200));
    return { ok: false, error: "Не удалось отправить письмо. Попробуйте позже." };
  } catch (e) {
    console.error("email send error:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Не удалось отправить письмо. Попробуйте позже." };
  }
}
