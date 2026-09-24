import { z } from "zod";

/**
 * Вход по одноразовому коду (GIMN-029).
 *
 * Телефон и почта проверяются на сервере ещё раз, уже приведёнными к
 * единому виду: здесь задача схемы — отсечь заведомый мусор до обращения
 * к провайдеру, чтобы не платить за отправку в никуда.
 */

export const REQUEST_ID_MAX = 320;

export const otpRequestSchema = z.object({
  /** Номер или адрес в том виде, как его набрал человек. */
  identifier: z.string().trim().min(3, "Слишком коротко").max(REQUEST_ID_MAX),
  referral_code: z.string().trim().max(32).optional(),
});

export const otpVerifySchema = z.object({
  identifier: z.string().trim().min(3).max(REQUEST_ID_MAX),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Код — шесть цифр"),
  referral_code: z.string().trim().max(32).optional(),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
