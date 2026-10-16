/**
 * Проверка правил оплаты подписки (ЮKassa).
 *
 * Здесь всё, что решает, сколько денег спишут и сколько дней человек получит:
 * цены, сумма с баллами, продление срока и разбор уведомления. Живой магазин
 * для этого не нужен — правила чистые, а проверка, которой нужен живой
 * магазин, не запускается никогда.
 *
 * Запуск: node --import ./scripts/lib/ts-resolve-hook.mjs scripts/check-payments.mts
 */
import { MAX_POINTS_PERCENT } from "@/lib/points/pricing";
import {
  PERIOD_DAYS,
  TARIFF_PRICES,
  checkoutAmount,
  isOwnNotification,
  isPeriod,
  isTariff,
  nextSubscriptionUntil,
  parseNotification,
  tariffPriceRub,
} from "@/lib/payments/rules";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const DAY = 86_400_000;

console.log("Цены:");
check("Базовый месяц 399", tariffPriceRub("basic", "month") === 399);
check("Плюс месяц 799", tariffPriceRub("plus", "month") === 799);
check("Семейный год 14900", tariffPriceRub("family", "year") === 14900);
for (const [key, price] of Object.entries(TARIFF_PRICES)) {
  // Витрина обещает «экономию 17%» — год не дороже 10 месяцев.
  check(`год «${price.title}» не дороже 10 месяцев`, price.yearRub <= price.monthRub * 10, key);
}
check("неизвестный тариф не проходит", !isTariff("gold") && !isTariff(undefined));
check("неизвестный период не проходит", !isPeriod("week") && isPeriod("year"));

console.log("\nСумма с баллами:");
{
  const none = checkoutAmount("plus", "month", 0, 500);
  check("без баллов — полная цена", none.payRub === 799 && none.points === 0, JSON.stringify(none));

  const some = checkoutAmount("plus", "month", 350, 350);
  check("350 баллов = 140 ₽ скидки", some.discountRub === 140 && some.payRub === 659, JSON.stringify(some));

  const many = checkoutAmount("plus", "month", 100_000, 100_000);
  const limit = Math.floor((799 * MAX_POINTS_PERCENT) / 100);
  check(`скидка не больше ${MAX_POINTS_PERCENT}% цены`, many.discountRub <= limit, String(many.discountRub));
  check("остаток картой не меньше рубля", many.payRub >= 1, String(many.payRub));

  const stale = checkoutAmount("basic", "month", 100, 5000);
  check("запрос больше остатка прижимается к остатку", stale.points === 100, String(stale.points));

  const negative = checkoutAmount("basic", "month", 100, -50);
  check("отрицательный запрос — ноль баллов", negative.points === 0 && negative.payRub === 399);

  const yearly = checkoutAmount("family", "year", 0, 0);
  check("год считается от годовой цены", yearly.priceRub === 14900 && yearly.payRub === 14900);
}

console.log("\nПродление подписки:");
{
  const now = new Date("2026-10-16T12:00:00Z");

  const fresh = nextSubscriptionUntil(null, "month", now);
  check("новая подписка — 30 дней от сегодня", fresh.getTime() === now.getTime() + 30 * DAY);

  const active = new Date(now.getTime() + 10 * DAY).toISOString();
  const extended = nextSubscriptionUntil(active, "month", now);
  check(
    "продление прибавляется к оставшимся дням",
    extended.getTime() === now.getTime() + 40 * DAY,
    extended.toISOString(),
  );

  const expired = new Date(now.getTime() - 5 * DAY).toISOString();
  const renewed = nextSubscriptionUntil(expired, "year", now);
  check("истёкшая — считается от сегодня", renewed.getTime() === now.getTime() + PERIOD_DAYS.year * DAY);
}

console.log("\nУведомления ЮKassa:");
{
  const own = parseNotification({
    type: "notification",
    event: "payment.succeeded",
    object: { id: "2a1b-ours", status: "succeeded", metadata: { app: "gimn", userId: "u1" } },
  });
  check("наше уведомление разбирается", own?.paymentId === "2a1b-ours" && own.event === "payment.succeeded");
  check("и признаётся нашим", own !== null && isOwnNotification(own));

  const foreign = parseNotification({ event: "payment.succeeded", object: { id: "kuznya-1", metadata: {} } });
  check("платёж Кузни разбирается, но не наш", foreign !== null && !isOwnNotification(foreign));

  const noMeta = parseNotification({ event: "payment.succeeded", object: { id: "x" } });
  check("без metadata — не наш", noMeta !== null && !isOwnNotification(noMeta));

  check("мусор не разбирается", parseNotification("hello") === null && parseNotification(null) === null);
  check("без id не разбирается", parseNotification({ event: "payment.succeeded", object: {} }) === null);
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
