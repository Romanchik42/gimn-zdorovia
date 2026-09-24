"use client";

import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FEEDBACK_TYPE_LABELS } from "@/lib/schemas/feedback";
import type { ReviewAction, ReviewItem } from "@/lib/points/feedback-review";
import type { FeedbackStatusValue } from "@/lib/supabase/types";
import { cn } from "cn";

/**
 * Разбор отзывов (GIMN-030). Кнопка вместо SQL-редактора.
 *
 * Список приходит с сервера один раз, дальше карточка живёт своим
 * состоянием: после решения она сереет на месте, а не уезжает из списка.
 * Уехавшую невозможно перечитать — а посмотреть, что именно подтвердил,
 * хочется сразу же.
 */

const TYPE_EMOJI = { bug: "🐛", idea: "💡", review: "📝" } as const;

const STATUS_LABELS: Record<Exclude<FeedbackStatusValue, "new">, string> = {
  confirmed: "Подтверждено",
  in_plan: "В плане",
  rejected: "Отклонено",
};

const BUTTONS: { action: ReviewAction; label: string; points: number }[] = [
  { action: "confirm_bug", label: "✅ Подтвердить баг", points: 50 },
  { action: "accept_idea", label: "💡 Идея в план", points: 100 },
  { action: "good_idea", label: "👍 Хорошая идея", points: 20 },
  { action: "reject", label: "❌ Отклонить", points: 0 },
];

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "new", label: "Новые" },
  { id: "confirmed", label: "Подтверждено" },
  { id: "rejected", label: "Отклонено" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

/** «Подтверждено» показывает и принятые в план: обе — зачтённые. */
function matches(item: ReviewItem, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "confirmed") return item.status === "confirmed" || item.status === "in_plan";
  return item.status === filter;
}

export function FeedbackReview({ initial }: { initial: ReviewItem[] }) {
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<FilterId>("new");
  const [pending, setPending] = useState<string | null>(null);

  async function decide(item: ReviewItem, action: ReviewAction) {
    setPending(item.id);
    try {
      const res = await fetch(`/api/admin/feedback/${item.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить решение");
        return;
      }

      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, status: json.data.status, pointsAwarded: json.data.points }
            : row,
        ),
      );

      // Повтор отдельным текстом: молчаливое «готово» на второе нажатие
      // выглядит как второе начисление, которого не было.
      toast.success(
        json.data.alreadyAwarded
          ? "Решение сохранено. Баллы за этот отзыв уже начисляли раньше."
          : json.data.points > 0
            ? `Начислено +${json.data.points}. Автору ушло сообщение.`
            : "Отзыв отклонён.",
      );
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(null);
    }
  }

  const shown = items.filter((item) => matches(item, filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Фильтр отзывов">
        {FILTERS.map((f) => {
          const count = items.filter((item) => matches(item, f.id)).length;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={cn(
                "min-h-11 rounded-lg px-3 text-sm font-medium transition-colors",
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label} <span className="font-mono text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {filter === "new" ? "Новых отзывов нет — всё разобрано." : "В этом фильтре пусто."}
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((item) => (
            <li
              key={item.id}
              className={cn(
                "space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
                item.status !== "new" && "opacity-60",
              )}
            >
              <header className="space-y-1">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    <span aria-hidden>{TYPE_EMOJI[item.type]}</span>{" "}
                    {FEEDBACK_TYPE_LABELS[item.type].toUpperCase()}
                  </span>
                  <span>{format(new Date(item.createdAt), "d MMMM yyyy, HH:mm", { locale: ru })}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  От: {item.authorName}
                  {item.authorUsername ? ` (@${item.authorUsername})` : ""}
                </p>
              </header>

              <p className="text-sm whitespace-pre-line">{item.text}</p>

              {item.status === "new" ? (
                <div className="flex flex-wrap gap-1.5">
                  {BUTTONS.map((b) => (
                    <Button
                      key={b.action}
                      variant={b.action === "reject" ? "ghost" : "outline"}
                      className="h-11"
                      disabled={pending !== null}
                      onClick={() => void decide(item, b.action)}
                    >
                      {pending === item.id ? (
                        <Loader2Icon className="size-4 animate-spin" aria-hidden />
                      ) : null}
                      {b.label}
                      {b.points > 0 ? ` +${b.points}` : ""}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium">
                  {STATUS_LABELS[item.status]}
                  {item.pointsAwarded > 0 ? ` · начислено +${item.pointsAwarded}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
