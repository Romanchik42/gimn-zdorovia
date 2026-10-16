/**
 * Абстракция платёжного провайдера (сейчас ЮKassa) — портирована из Кузни.
 * Типы без side-effects, поэтому без server-only: их можно импортировать и в
 * серверном, и в клиентском коде (сам провайдер — только на сервере).
 */

export type PaymentTariff = "basic" | "plus" | "family";
export type PaymentPeriod = "month" | "year";

/**
 * Метаданные платежа. `app` различает проекты в общем магазине ЮKassa —
 * чтобы было ясно, что платёж из Гимна и кто/за что заплатил (запрос Романа).
 */
export type PaymentMetadata = {
  app: "gimn";
  userId: string;
  tariff: PaymentTariff;
  period: PaymentPeriod;
};

export type CreatePaymentInput = {
  amountRubles: number;
  description: string;
  returnUrl: string;
  metadata: PaymentMetadata;
};

export type CreatePaymentResult = { paymentId: string; confirmationUrl: string };

/** Статусы платежа ЮKassa. */
export type PaymentStatus = "pending" | "waiting_for_capture" | "succeeded" | "canceled";

export interface PaymentProvider {
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}
