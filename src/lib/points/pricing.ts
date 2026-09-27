/**
 * Сколько стоит балл (GIMN-030).
 *
 * Цена сверена с таблицей обмена, но не равна ей в точности: месяц «Плюс»
 * стоит 799 ₽ или 2000 баллов, то есть 39.95 копейки за балл. В цене
 * округлено до 40 — ровное число, которое человек может посчитать в
 * голове: сто баллов — сорок рублей. Разница в пять сотых копейки на
 * месячной подписке даёт рубль в нашу пользу, и это предел допустимого
 * расхождения: check:points следит, чтобы оно не разъехалось сильнее.
 *
 * Вся арифметика — в целых копейках. На дробных рублях 799 × 0.3 / 0.4
 * даёт 599.2500000000001, и потолок «30% от суммы» то проходит, то нет
 * от версии движка. Деньгам такая арифметика не годится.
 *
 * Модуль без "server-only": слайдер считает то же самое в браузере, и
 * второй копии этих правил быть не должно.
 */

/** Сколько копеек стоит один балл. */
export const POINT_KOPECKS = 40;

/**
 * Какую долю суммы можно закрыть баллами, в процентах.
 *
 * Не 100: баллы — благодарность за помощь, а не способ никогда не
 * платить. При полном покрытии тестер получал бы подписку бесплатно
 * навсегда, и экономика приложения не сходилась бы.
 */
export const MAX_POINTS_PERCENT = 30;

export type PointsPayment = {
  /** Сколько баллов применено. */
  points: number;
  /** Скидка в рублях — всегда целое число. */
  discountRub: number;
  /** Сколько платить картой. */
  payRub: number;
  /** Предел для слайдера при этом балансе и этой цене. */
  maxPoints: number;
};

/** Скидка от баллов, округлённая вниз до рубля. */
export function pointsDiscountRub(points: number): number {
  if (!Number.isFinite(points) || points <= 0) return 0;
  return Math.floor((Math.floor(points) * POINT_KOPECKS) / 100);
}

/**
 * Максимум баллов к этой цене: столько, чтобы скидка не перешла долю от
 * суммы и не оказалась больше остатка.
 */
export function maxPointsToApply(priceRub: number, balance: number): number {
  if (!Number.isFinite(priceRub) || priceRub <= 0) return 0;
  const limitKopecks = Math.floor((priceRub * 100 * MAX_POINTS_PERCENT) / 100);
  const byPrice = Math.floor(limitKopecks / POINT_KOPECKS);
  return Math.max(0, Math.min(Math.floor(balance), byPrice));
}

/**
 * Что получится, если подвинуть слайдер на `requested` баллов.
 *
 * Запрошенное всегда прижимается к пределу, а не отвергается: слайдер
 * может прийти с любым числом — из старой вкладки, из подставленного
 * запроса, — и падать на этом незачем.
 */
export function applyPoints(priceRub: number, balance: number, requested: number): PointsPayment {
  const maxPoints = maxPointsToApply(priceRub, balance);
  const points = Math.max(0, Math.min(Math.floor(requested) || 0, maxPoints));
  const discountRub = pointsDiscountRub(points);
  return { points, discountRub, payRub: Math.max(0, priceRub - discountRub), maxPoints };
}

/** «350 баллов = 140 ₽» — подпись под балансом. */
export function pointsWorthRub(balance: number): number {
  return pointsDiscountRub(balance);
}
