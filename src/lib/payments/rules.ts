/**
 * Правила оплаты подписки: цены, сумма к оплате, продление срока.
 *
 * Без "server-only" и без обращений к базе: карточка тарифа считает сумму
 * в браузере, сервер пересчитывает ту же сумму перед созданием платежа, и
 * второй копии этих правил быть не должно. Чистые функции держит под
 * проверкой scripts/check-payments.mts — живой магазин для неё не нужен.
 */

import { applyPoints } from "@/lib/points/pricing";
import type { PaymentPeriod, PaymentTariff } from "./provider";

export type TariffPrice = { title: string; monthRub: number; yearRub: number };

/** Цены тарифов. Витрина в настройках берёт цифры отсюда же. */
export const TARIFF_PRICES: Record<PaymentTariff, TariffPrice> = {
  basic: { title: "Базовый", monthRub: 399, yearRub: 3990 },
  plus: { title: "Плюс", monthRub: 799, yearRub: 7990 },
  family: { title: "Семейный", monthRub: 1490, yearRub: 14900 },
};

/** Сколько дней даёт оплаченный период. */
export const PERIOD_DAYS: Record<PaymentPeriod, number> = { month: 30, year: 365 };

export const PERIOD_LABELS: Record<PaymentPeriod, string> = { month: "1 месяц", year: "1 год" };

/** Меньше рубля ЮKassa платёж не принимает. */
export const MIN_PAYMENT_RUB = 1;

export function isTariff(value: unknown): value is PaymentTariff {
  return typeof value === "string" && value in TARIFF_PRICES;
}

export function isPeriod(value: unknown): value is PaymentPeriod {
  return value === "month" || value === "year";
}

export function tariffPriceRub(tariff: PaymentTariff, period: PaymentPeriod): number {
  const price = TARIFF_PRICES[tariff];
  return period === "year" ? price.yearRub : price.monthRub;
}

export type CheckoutAmount = {
  priceRub: number;
  /** Сколько баллов реально пойдёт в оплату — уже прижато к пределу. */
  points: number;
  discountRub: number;
  payRub: number;
};

/**
 * Сумма к оплате с учётом баллов. Запрошенные баллы прижимаются к пределу
 * так же, как в слайдере: запрос мог прийти из старой вкладки.
 */
export function checkoutAmount(
  tariff: PaymentTariff,
  period: PaymentPeriod,
  balance: number,
  requestedPoints: number,
): CheckoutAmount {
  const priceRub = tariffPriceRub(tariff, period);
  const plan = applyPoints(priceRub, balance, requestedPoints);
  return { priceRub, points: plan.points, discountRub: plan.discountRub, payRub: plan.payRub };
}

/**
 * До какой даты будет оплачено после нового платежа.
 *
 * Срок прибавляется к ещё не истёкшей подписке, а не к сегодняшнему дню:
 * человек, продливший заранее, не должен терять оставшиеся дни.
 */
export function nextSubscriptionUntil(currentUntil: string | null, period: PaymentPeriod, now: Date): Date {
  const current = currentUntil ? new Date(currentUntil) : null;
  const start = current && current.getTime() > now.getTime() ? current : now;
  return new Date(start.getTime() + PERIOD_DAYS[period] * 86_400_000);
}

/** Уведомление ЮKassa в том виде, в каком оно нам нужно. */
export type PaymentNotification = { event: string; paymentId: string; app: string | null };

/**
 * Разбор тела вебхука. Сумме и статусу из тела не верим — их сервис
 * перепроверяет запросом в ЮKassa; здесь только id платежа и источник.
 */
export function parseNotification(body: unknown): PaymentNotification | null {
  if (!body || typeof body !== "object") return null;
  const { event, object } = body as { event?: unknown; object?: unknown };
  if (typeof event !== "string" || !object || typeof object !== "object") return null;

  const { id, metadata } = object as { id?: unknown; metadata?: unknown };
  if (typeof id !== "string" || !id) return null;

  const app =
    metadata && typeof metadata === "object" && typeof (metadata as { app?: unknown }).app === "string"
      ? (metadata as { app: string }).app
      : null;

  return { event, paymentId: id, app };
}

/**
 * Наш ли это платёж. Магазин ЮKassa общий с Кузней, и уведомления о её
 * платежах приходят сюда же — их пропускаем молча, ответив 200, чтобы
 * ЮKassa не повторяла их бесконечно.
 */
export function isOwnNotification(notification: PaymentNotification): boolean {
  return notification.app === "gimn";
}
