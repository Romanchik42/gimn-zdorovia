import "server-only";

import { publicEnv } from "@/lib/env";
import { awardPoints, getUserPoints } from "@/lib/points/service";
import { createAdminClient } from "@/lib/supabase/admin";

import type { PaymentPeriod, PaymentProvider, PaymentTariff } from "./provider";
import {
  MIN_PAYMENT_RUB,
  PERIOD_LABELS,
  TARIFF_PRICES,
  checkoutAmount,
  isOwnNotification,
  nextSubscriptionUntil,
  type PaymentNotification,
} from "./rules";
import { YookassaProvider } from "./yookassa";

/**
 * Приём оплаты подписки (ЮKassa).
 *
 * Порядок: создаём строку платежа в базе → платёж в ЮKassa → человек платит
 * на её странице → ЮKassa шлёт уведомление → сверяем статус запросом к ней
 * же → продлеваем подписку и списываем баллы.
 *
 * Баллы списываются при успешной оплате, а не при создании платежа: человек
 * может закрыть страницу оплаты, и тогда баллы пропали бы за неоплаченное.
 */

/**
 * Ключи берём из окружения напрямую, без serverEnv: без них приложение
 * должно работать как раньше — с витриной вместо кнопки оплаты.
 */
export function isPaymentsEnabled(): boolean {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function createProvider(): PaymentProvider {
  return new YookassaProvider(process.env.YOOKASSA_SHOP_ID ?? "", process.env.YOOKASSA_SECRET_KEY ?? "");
}

type CheckoutInput = {
  userId: string;
  tariff: PaymentTariff;
  period: PaymentPeriod;
  points: number;
  email: string;
};

type CheckoutResult = { ok: true; confirmationUrl: string } | { ok: false; error: string; status: number };

export async function createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  if (!isPaymentsEnabled()) return { ok: false, error: "Приём платежей ещё не подключён", status: 503 };

  const admin = createAdminClient();
  const balance = input.points > 0 ? await getUserPoints(input.userId, admin) : 0;
  const amount = checkoutAmount(input.tariff, input.period, balance, input.points);

  if (amount.payRub < MIN_PAYMENT_RUB) {
    return { ok: false, error: "Сумма к оплате слишком мала", status: 422 };
  }

  const { data: payment, error: insertError } = await admin
    .from("payments")
    .insert({
      user_id: input.userId,
      tariff: input.tariff,
      period: input.period,
      amount_rub: amount.payRub,
      points_spent: amount.points,
      email: input.email,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    console.error("payment insert failed:", insertError?.message);
    return { ok: false, error: "Не удалось создать платёж", status: 500 };
  }

  try {
    const created = await createProvider().createPayment({
      amountRubles: amount.payRub,
      description: `Гимн здоровья — «${TARIFF_PRICES[input.tariff].title}», ${PERIOD_LABELS[input.period]}`,
      returnUrl: `${publicEnv.appUrl}/app/settings?payment=return`,
      metadata: { app: "gimn", userId: input.userId, tariff: input.tariff, period: input.period },
    });

    await admin.from("payments").update({ provider_payment_id: created.paymentId }).eq("id", payment.id);
    return { ok: true, confirmationUrl: created.confirmationUrl };
  } catch (e) {
    console.error("yookassa create failed:", e);
    await admin.from("payments").update({ status: "canceled" }).eq("id", payment.id);
    return { ok: false, error: "Платёжная система не ответила, попробуйте позже", status: 502 };
  }
}

/**
 * Уведомление ЮKassa.
 *
 * `retry: true` — ответить 500, чтобы ЮKassa повторила уведомление позже.
 * Чужие и уже обработанные платежи — `retry: false`: повторять их незачем.
 */
export async function handleNotification(
  notification: PaymentNotification,
): Promise<{ retry: boolean }> {
  if (!isOwnNotification(notification) || !isPaymentsEnabled()) return { retry: false };

  // Телу уведомления не верим: подделать его может кто угодно, кто знает
  // адрес вебхука. Статус спрашиваем у ЮKassa сами, нашими ключами.
  let status;
  try {
    status = await createProvider().getPaymentStatus(notification.paymentId);
  } catch (e) {
    console.error("yookassa status failed:", e);
    return { retry: true };
  }

  const admin = createAdminClient();

  if (status === "canceled") {
    await admin
      .from("payments")
      .update({ status: "canceled" })
      .eq("provider_payment_id", notification.paymentId)
      .eq("app", "gimn")
      .eq("status", "pending");
    return { retry: false };
  }

  if (status !== "succeeded") return { retry: false };

  // Забираем платёж в обработку одним условным UPDATE: повторное
  // уведомление о том же платеже уже не найдёт строку в статусе pending
  // и не продлит подписку второй раз.
  const { data: claimed } = await admin
    .from("payments")
    .update({ status: "succeeded", paid_at: new Date().toISOString() })
    .eq("provider_payment_id", notification.paymentId)
    .eq("app", "gimn")
    .eq("status", "pending")
    .select("id, user_id, tariff, period, points_spent")
    .maybeSingle();

  if (!claimed) return { retry: false };

  const activated = await activateSubscription(admin, claimed);
  if (!activated) {
    // Вернуть в pending, чтобы повтор уведомления довёл дело до конца.
    await admin.from("payments").update({ status: "pending", paid_at: null }).eq("id", claimed.id);
    return { retry: true };
  }

  return { retry: false };
}

type ClaimedPayment = {
  id: string;
  user_id: string;
  tariff: string;
  period: string;
  points_spent: number;
};

async function activateSubscription(
  admin: ReturnType<typeof createAdminClient>,
  payment: ClaimedPayment,
): Promise<boolean> {
  const period: PaymentPeriod = payment.period === "year" ? "year" : "month";

  const { data: user, error: readError } = await admin
    .from("users")
    .select("subscription_until")
    .eq("id", payment.user_id)
    .maybeSingle();
  if (readError) {
    console.error("subscription read failed:", readError.message);
    return false;
  }

  const until = nextSubscriptionUntil(user?.subscription_until ?? null, period, new Date());
  const { error: updateError } = await admin
    .from("users")
    .update({ subscription_tariff: payment.tariff, subscription_until: until.toISOString() })
    .eq("id", payment.user_id);
  if (updateError) {
    console.error("subscription update failed:", updateError.message);
    return false;
  }

  // Ссылка на платёж делает списание однократным: повтор уведомления
  // упрётся в уникальный индекс uniq_points_ref и баланс не тронет.
  if (payment.points_spent > 0) {
    const spent = await awardPoints(
      payment.user_id,
      -payment.points_spent,
      `Оплата подписки баллами: ${payment.points_spent}`,
      "PAYMENT",
      payment.id,
    );
    if (!spent.ok) console.error("points spend failed:", spent.error);
  }

  return true;
}
