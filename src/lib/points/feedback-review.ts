import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { POINTS_RULES, awardPoints } from "@/lib/points/service";
import { FEEDBACK_TYPE_LABELS } from "@/lib/schemas/feedback";
import type { FeedbackStatusValue, FeedbackType } from "@/lib/supabase/types";

/**
 * Разбор отзывов админом (GIMN-030).
 *
 * Статус и баллы у отзыва были в базе с 0020, но проставить их можно было
 * только руками в SQL-редакторе. На практике это значило «никогда»: за
 * тестовый период не начислено ни одного балла за баг, хотя баги
 * присылали. Теперь есть кнопка.
 *
 * Начисление идёт через awardPoints со ссылкой на сам отзыв
 * (reference_type = "feedback"), и уникальный индекс uniq_points_ref
 * делает повтор безопасным: дважды нажатая кнопка не удваивает баллы.
 */

export const REVIEW_ACTIONS = ["confirm_bug", "accept_idea", "good_idea", "reject"] as const;
export type ReviewAction = (typeof REVIEW_ACTIONS)[number];

type ActionSpec = {
  label: string;
  emoji: string;
  status: FeedbackStatusValue;
  points: number;
  /** Что увидит человек в строке «За что» своего уведомления. */
  reason: (type: FeedbackType) => string;
};

/**
 * «Хорошая идея» ставит статус confirmed, а не in_plan: идея зачтена и
 * оплачена, но в план не взята. Развести их в статусах было бы точнее,
 * однако новое значение потребовало бы миграции ради оттенка, который
 * виден и так — по числу начисленных баллов.
 */
export const ACTIONS: Record<ReviewAction, ActionSpec> = {
  confirm_bug: {
    label: "Подтвердить баг",
    emoji: "✅",
    status: "confirmed",
    points: POINTS_RULES.BUG_CONFIRMED,
    reason: () => "подтверждённый баг",
  },
  accept_idea: {
    label: "Идея в план",
    emoji: "💡",
    status: "in_plan",
    points: POINTS_RULES.IDEA_ACCEPTED,
    reason: () => "идея принята в план",
  },
  good_idea: {
    label: "Хорошая идея",
    emoji: "👍",
    status: "confirmed",
    points: POINTS_RULES.IDEA_GOOD,
    reason: () => "хорошая идея",
  },
  reject: {
    label: "Отклонить",
    emoji: "❌",
    status: "rejected",
    points: 0,
    reason: (type) => FEEDBACK_TYPE_LABELS[type].toLowerCase(),
  },
};

export type ReviewItem = {
  id: string;
  type: FeedbackType;
  text: string;
  status: FeedbackStatusValue;
  pointsAwarded: number;
  createdAt: string;
  authorName: string;
  authorUsername: string | null;
};

/** Сколько слов отзыва попадёт в уведомление: длинный текст в нём не нужен. */
const REASON_LIMIT = 60;

function shorten(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= REASON_LIMIT ? flat : `${flat.slice(0, REASON_LIMIT - 1)}…`;
}

/**
 * Все отзывы, свежие сверху. Автора добираем отдельным запросом: связи
 * между feedback и users для PostgREST не объявлено, а заводить её ради
 * одной админской страницы — лишний повод трогать схему.
 */
export async function listFeedback(): Promise<ReviewItem[]> {
  const admin = createAdminClient();

  const { data: rows } = await admin
    .from("feedback")
    .select("id, user_id, type, text, status, points_awarded, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (!rows?.length) return [];

  const { data: authors } = await admin
    .from("users")
    .select("id, name, telegram_username")
    .in("id", [...new Set(rows.map((r) => r.user_id))]);

  const byId = new Map((authors ?? []).map((a) => [a.id, a]));

  return rows.map((row) => {
    const author = byId.get(row.user_id);
    return {
      id: row.id,
      type: row.type as FeedbackType,
      text: row.text,
      status: row.status as FeedbackStatusValue,
      pointsAwarded: row.points_awarded ?? 0,
      createdAt: row.created_at,
      authorName: author?.name ?? "Пользователь",
      authorUsername: author?.telegram_username ?? null,
    };
  });
}

export type ReviewResult =
  | { ok: true; status: FeedbackStatusValue; points: number; alreadyAwarded: boolean }
  | { ok: false; error: string };

/**
 * Решение по отзыву: статус плюс баллы автору.
 *
 * Порядок — сначала баллы, потом статус. Начисление идемпотентно и
 * переживёт повтор; статус, проставленный раньше, при упавшем начислении
 * пометил бы отзыв разобранным, и вернуться к нему стало бы не по чему:
 * в списке «Новые» его больше нет.
 */
export async function reviewFeedback(id: string, action: ReviewAction): Promise<ReviewResult> {
  const spec = ACTIONS[action];
  if (!spec) return { ok: false, error: "Неизвестное действие" };

  const admin = createAdminClient();

  const { data: item } = await admin
    .from("feedback")
    .select("id, user_id, type, text, points_awarded")
    .eq("id", id)
    .maybeSingle();

  if (!item) return { ok: false, error: "Отзыв не найден" };

  let alreadyAwarded = false;

  if (spec.points > 0) {
    const reason = `${spec.reason(item.type as FeedbackType)} «${shorten(item.text)}»`;
    const award = await awardPoints(item.user_id, spec.points, reason, "feedback", item.id);
    if (!award.ok) return { ok: false, error: award.error ?? "Не удалось начислить баллы" };
    alreadyAwarded = award.alreadyAwarded === true;
  }

  // points_awarded не прибавляем, а ставим: повторное решение по тому же
  // отзыву баллов не даёт, и сумма должна остаться прежней.
  const points = alreadyAwarded ? (item.points_awarded ?? 0) : spec.points;

  const { error } = await admin
    .from("feedback")
    .update({ status: spec.status, points_awarded: points })
    .eq("id", id);

  if (error) {
    console.error("feedback review update failed:", error.message);
    return { ok: false, error: "Баллы начислены, но статус не сохранился" };
  }

  return { ok: true, status: spec.status, points, alreadyAwarded };
}
