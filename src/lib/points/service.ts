import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Баллы за вклад в тестовый период (GIMN-027).
 *
 * Пока приложение бесплатно, вклад тестеров копится баллами: подтверждённый
 * баг, принятая идея, приглашённый друг. К запуску платного тарифа баллы
 * превращаются в дни подписки.
 *
 * Начисление идёт только с сервера служебным ключом: у таблиц есть политика
 * на чтение своих строк и нет политики на запись — иначе баллы можно было бы
 * выписать себе из браузера.
 */

export const POINTS_RULES = {
  BUG_CONFIRMED: 50,
  IDEA_ACCEPTED: 100,
  IDEA_GOOD: 20,
  FEEDBACK_JUST: 5,
  REFERRAL_REGISTERED: 30,
  REFERRAL_PAID: 200,
  STREAK_30_DAYS: 100,
  WORKOUTS_100: 500,
  TESTER_BONUS: 1000,
} as const;

/** Сколько баллов стоит день, неделя, месяц и год подписки. */
export const EXCHANGE_RATES = {
  DAY_PLUS: 100,
  WEEK_PLUS: 500,
  MONTH_PLUS: 2000,
  YEAR_PLUS: 20000,
} as const;

export type ExchangeTarget = keyof typeof EXCHANGE_RATES;

/** Сколько дней даёт каждый вариант обмена — нужно для годового потолка. */
export const EXCHANGE_DAYS: Record<ExchangeTarget, number> = {
  DAY_PLUS: 1,
  WEEK_PLUS: 7,
  MONTH_PLUS: 30,
  YEAR_PLUS: 365,
};

/** Потолок бесплатных дней в год: баллы продлевают подписку, но не заменяют её. */
export const MAX_FREE_DAYS_PER_YEAR = 30;

export type PointHistoryRow = {
  id: string;
  amount: number;
  reason: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: string;
};

type AwardResult = { ok: boolean; alreadyAwarded?: boolean; error?: string };

/**
 * Клиент базы. Обычно служебный, но его можно подставить — на этом держится
 * проверка scripts/check-points.mts: защита от двойного начисления должна
 * проверяться без живой базы, иначе её никто не будет запускать.
 */
type PointsClient = ReturnType<typeof createAdminClient>;

/** Нарушение уникального индекса uniq_points_ref — значит, уже начисляли. */
const UNIQUE_VIOLATION = "23505";

/**
 * Начислить баллы. Пара (reference_type, reference_id) делает начисление
 * идемпотентным: за один и тот же отзыв или одного и того же приглашённого
 * баллы дают один раз, сколько бы раз ни позвали.
 *
 * Порядок важен: сначала запись в историю. Если она не прошла из-за дубля,
 * остаток не трогаем — иначе повторный вызов раздувал бы баланс, не оставляя
 * следа в истории.
 */
export async function awardPoints(
  userId: string,
  amount: number,
  reason: string,
  refType?: string,
  refId?: string,
  client?: PointsClient,
): Promise<AwardResult> {
  if (!Number.isInteger(amount) || amount === 0) {
    return { ok: false, error: "Сумма баллов должна быть целой и не нулевой" };
  }

  const admin = client ?? createAdminClient();

  const { error: historyError } = await admin.from("points_history").insert({
    user_id: userId,
    amount,
    reason,
    reference_type: refType ?? null,
    reference_id: refId ?? null,
  });

  if (historyError) {
    if (historyError.code === UNIQUE_VIOLATION) return { ok: true, alreadyAwarded: true };
    console.error("points history insert failed:", historyError.message);
    return { ok: false, error: "Не удалось записать начисление" };
  }

  const current = await getUserPoints(userId, admin);
  const next = Math.max(0, current + amount);

  const { error: balanceError } = await admin
    .from("user_points")
    .upsert({ user_id: userId, points: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (balanceError) {
    console.error("points balance upsert failed:", balanceError.message);
    return { ok: false, error: "Не удалось обновить баланс" };
  }

  return { ok: true };
}

/** Остаток баллов. Строки может не быть — это ноль, а не ошибка. */
export async function getUserPoints(userId: string, client?: PointsClient): Promise<number> {
  const admin = client ?? createAdminClient();
  const { data } = await admin.from("user_points").select("points").eq("user_id", userId).maybeSingle();
  return data?.points ?? 0;
}

export async function getPointsHistory(userId: string, limit = 50): Promise<PointHistoryRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("points_history")
    .select("id, amount, reason, reference_type, reference_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as PointHistoryRow[];
}

/** Сколько бесплатных дней человек уже выбрал за последний год. */
export async function freeDaysUsedThisYear(userId: string): Promise<number> {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString();
  const { data } = await admin
    .from("points_history")
    .select("reference_type")
    .eq("user_id", userId)
    .lt("amount", 0)
    .gte("created_at", since);

  return (data ?? []).reduce((total, row) => {
    const target = row.reference_type as ExchangeTarget | null;
    return total + (target && target in EXCHANGE_DAYS ? EXCHANGE_DAYS[target] : 0);
  }, 0);
}

/**
 * Обменять баллы на дни подписки. Проверяем и остаток, и годовой потолок:
 * баллы — благодарность за помощь, а не способ никогда не платить.
 */
export async function exchangePoints(
  userId: string,
  target: ExchangeTarget,
): Promise<{ ok: boolean; error?: string }> {
  const cost = EXCHANGE_RATES[target];
  if (!cost) return { ok: false, error: "Неизвестный вариант обмена" };

  const balance = await getUserPoints(userId);
  if (balance < cost) {
    return { ok: false, error: `Не хватает баллов: нужно ${cost}, у вас ${balance}` };
  }

  const days = EXCHANGE_DAYS[target];
  const used = await freeDaysUsedThisYear(userId);
  if (used + days > MAX_FREE_DAYS_PER_YEAR) {
    return {
      ok: false,
      error: `За год баллами можно получить не больше ${MAX_FREE_DAYS_PER_YEAR} дней. Уже использовано: ${used}.`,
    };
  }

  // reference_id здесь не ставим: обмен можно повторять, его не нужно
  // защищать от дублей — за него отвечает проверка остатка.
  const result = await awardPoints(userId, -cost, `Обмен на ${days} дн. подписки`, target);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
