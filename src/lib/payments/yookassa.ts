import "server-only";
import { randomUUID } from "node:crypto";

import type {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  PaymentStatus,
} from "./provider";

/**
 * Провайдер ЮKassa (API v3) — портирован из Кузни, без её http-хелпера, на
 * обычном fetch. Создание платежа с Idempotence-Key и перепроверка статуса.
 *
 * Ключи берём из окружения напрямую (не через zod-env), чтобы приложение
 * стартовало и без них: провайдер падает только когда его реально создают.
 * Добавить в Vercel: YOOKASSA_SHOP_ID, YOOKASSA_SECRET_KEY (значения — как у
 * Кузни; магазин общий, платежи различаются по metadata.app).
 */

const YOOKASSA_BASE = "https://api.yookassa.ru/v3";

type YkPayment = {
  id: string;
  status: PaymentStatus;
  confirmation?: { confirmation_url?: string };
};

export class YookassaProvider implements PaymentProvider {
  private readonly base: string;
  private readonly authHeader: string;

  constructor(shopId: string, secretKey: string, baseUrl?: string) {
    if (!shopId || !secretKey) {
      throw new Error("YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY не заданы — оплата недоступна");
    }
    this.base = baseUrl ?? process.env.YOOKASSA_BASE ?? YOOKASSA_BASE;
    this.authHeader = "Basic " + Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const res = await fetch(`${this.base}/payments`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Idempotence-Key": randomUUID(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: { value: input.amountRubles.toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: input.returnUrl },
        description: input.description,
        metadata: input.metadata,
      }),
    });
    if (!res.ok) throw new Error(`ЮKassa: создание платежа не удалось (${res.status})`);

    const payment = (await res.json()) as YkPayment;
    const confirmationUrl = payment.confirmation?.confirmation_url;
    if (!confirmationUrl) throw new Error("ЮKassa: нет confirmation_url в ответе");
    return { paymentId: payment.id, confirmationUrl };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const res = await fetch(`${this.base}/payments/${paymentId}`, {
      headers: { Authorization: this.authHeader },
    });
    if (!res.ok) throw new Error(`ЮKassa: статус платежа не получить (${res.status})`);

    const payment = (await res.json()) as YkPayment;
    return payment.status;
  }
}
