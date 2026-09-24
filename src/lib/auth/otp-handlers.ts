import "server-only";

import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { otpRequestSchema, otpVerifySchema } from "@/lib/schemas/auth-otp";
import { sendEmailCode, isEmailConfigured } from "@/lib/auth/email-code";
import { sendSmsCode, isSmsConfigured } from "@/lib/auth/sms";
import { openOtpSession } from "@/lib/auth/otp-session";
import {
  CODE_TTL_MIN,
  RESEND_COOLDOWN_SEC,
  checkCode,
  issueCode,
  maskIdentifier,
  normalizeIdentifier,
  revokeCode,
  type OtpChannel,
} from "@/lib/auth/otp";

/**
 * Общие обработчики входа по коду (GIMN-029).
 *
 * SMS и почта отличаются только способом доставки и словами в сообщениях
 * об ошибке. Всё остальное — приведение идентификатора, ограничения,
 * выдача кода, проверка, открытие сессии — одно и то же, и жить оно должно
 * в одном месте: расхождение в правилах между каналами означало бы дыру в
 * том из них, о котором забыли.
 */

const WORDS: Record<OtpChannel, { what: string; wrong: string; off: string }> = {
  sms: {
    what: "SMS",
    wrong: "Проверьте номер телефона",
    off: "SMS-вход пока не подключён. Войдите через Telegram.",
  },
  email: {
    what: "письмо",
    wrong: "Проверьте адрес почты",
    off: "Вход по почте пока не подключён. Войдите через Telegram.",
  },
};

function configured(channel: OtpChannel): boolean {
  return channel === "sms" ? isSmsConfigured() : isEmailConfigured();
}

/**
 * Ограничение по адресу запроса — вторая линия после ограничения по
 * номеру. Без него один человек мог бы слать коды на тысячу чужих номеров
 * по три штуки на каждый: для получателей это спам за наш счёт.
 */
const PER_IP_PER_HOUR = 10;

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0]?.trim() || "unknown";
}

export async function handleOtpRequest(request: Request, channel: OtpChannel) {
  const words = WORDS[channel];

  const parsed = await parseBody(request, otpRequestSchema);
  if (parsed.error) return parsed.error;

  const identifier = normalizeIdentifier(channel, parsed.data.identifier);
  if (!identifier) return fail(words.wrong, 400);

  // Проверяем до выдачи кода: иначе строка в таблице появилась бы, а
  // сообщение — нет, и человек ждал бы код, которого никто не отправлял.
  if (!configured(channel)) return fail(words.off, 503);

  if (!rateLimit(`otp-ip:${clientKey(request)}`, PER_IP_PER_HOUR, 3_600_000)) {
    return fail("Слишком много запросов. Попробуйте позже.", 429);
  }

  const issued = await issueCode(channel, identifier);
  if (!issued.ok) return fail(issued.error, issued.status);

  const sent =
    channel === "sms"
      ? await sendSmsCode(identifier, issued.code)
      : await sendEmailCode(identifier, issued.code);

  if (!sent.ok) {
    // Отправки не было — значит и попытки не было: код снимаем, чтобы он
    // не съел одну из трёх в час и не заставил ждать минуту зря.
    await revokeCode(issued.id);
    return fail(sent.error, 502);
  }

  return ok({
    sent_to: maskIdentifier(channel, identifier),
    channel,
    expires_in_min: CODE_TTL_MIN,
    resend_after_sec: RESEND_COOLDOWN_SEC,
  });
}

export async function handleOtpVerify(request: Request, channel: OtpChannel) {
  const words = WORDS[channel];

  const parsed = await parseBody(request, otpVerifySchema);
  if (parsed.error) return parsed.error;

  const identifier = normalizeIdentifier(channel, parsed.data.identifier);
  if (!identifier) return fail(words.wrong, 400);

  const checked = await checkCode(channel, identifier, parsed.data.code);
  if (!checked.ok) return fail(checked.error, checked.status);

  const session = await openOtpSession(channel, identifier, {
    code: parsed.data.referral_code ?? null,
    source: "link",
  });
  if (!session.ok) return fail(session.error, session.status);

  return ok({
    user_id: session.userId,
    is_new_user: session.isNewUser,
    next_step: session.isNewUser ? "onboarding_mode" : "app",
  });
}
