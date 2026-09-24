import "server-only";

import { integrationsEnv } from "@/lib/env";

/**
 * Отправка кода в SMS (GIMN-029).
 *
 * Провайдер — SMS.ru: у него один ключ вместо логина с паролем, а значит
 * одна переменная окружения и одна строка в инструкции для Романа.
 *
 * Пока ключа нет, канал просто выключен. Не заглушка, которая делает вид,
 * что отправила, и не ошибка 500 — человек видит «SMS-вход пока не
 * подключён» и идёт в Telegram. Хуже неработающей кнопки только кнопка,
 * которая молча съедает номер телефона.
 *
 * Ключ не попадает ни в ответ, ни в лог: в диагностике остаётся только код
 * ошибки провайдера.
 */

const ENDPOINT = "https://sms.ru/sms/send";

export function isSmsConfigured(): boolean {
  return Boolean(integrationsEnv().SMS_PROVIDER_KEY);
}

export function smsText(code: string): string {
  return `${code} — код для входа в Гимн.здоровья. Никому его не сообщайте.`;
}

export type SendResult = { ok: true } | { ok: false; error: string };

type SmsRuResponse = {
  status?: string;
  status_code?: number;
  status_text?: string;
  sms?: Record<string, { status?: string; status_code?: number; status_text?: string }>;
};

export async function sendSmsCode(phone: string, code: string): Promise<SendResult> {
  const { SMS_PROVIDER_KEY, SMS_SENDER } = integrationsEnv();
  if (!SMS_PROVIDER_KEY) return { ok: false, error: "SMS-вход пока не подключён" };

  const params = new URLSearchParams({
    api_id: SMS_PROVIDER_KEY,
    to: phone.replace(/^\+/, ""),
    msg: smsText(code),
    json: "1",
  });
  if (SMS_SENDER) params.set("from", SMS_SENDER);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as SmsRuResponse | null;

    if (json?.status === "OK") {
      const per = json.sms?.[phone.replace(/^\+/, "")];
      if (!per || per.status === "OK") return { ok: true };
      console.error("sms send rejected:", per.status_code, per.status_text);
      return { ok: false, error: "Не удалось отправить SMS на этот номер" };
    }

    // В лог — только код и текст ошибки провайдера. Ключа здесь нет.
    console.error("sms send failed:", json?.status_code, json?.status_text);
    return { ok: false, error: "Не удалось отправить SMS. Попробуйте позже." };
  } catch (e) {
    console.error("sms send error:", e instanceof Error ? e.message : String(e));
    return { ok: false, error: "Не удалось отправить SMS. Попробуйте позже." };
  }
}
