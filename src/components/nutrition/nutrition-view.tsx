"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ChevronDownIcon, ClockIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { mealIcon } from "@/lib/nutrition/meal-icons";
import { MEAL_TIME_HINTS, MEAL_TYPE_LABELS } from "@/lib/schemas/nutrition";
import { dayName } from "@/lib/workout-engine/weekly-cycle";
import { dayOfWeek } from "@/lib/dates";
import type { MealRow, MealType, ShoppingListItem } from "@/lib/supabase/types";
import { cn } from "cn";

export type NutritionEntry = {
  id: string;
  date: string;
  meal_type: MealType;
  portion: number;
  consumed: boolean;
  meal: MealRow;
};

function scaled(value: number, portion: number): number {
  return Math.round(value * portion);
}

function formatGrams(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(g % 1000 === 0 ? 0 : 1).replace(".", ",")} кг` : `${g} г`;
}

function portionLabel(portion: number): string | null {
  return Math.abs(portion - 1) < 0.01 ? null : `порция ×${portion.toFixed(2).replace(/0$/, "").replace(".", ",")}`;
}

const VIEWS = [
  ["today", "Сегодня"],
  ["shopping", "Покупки"],
  ["week", "Неделя"],
] as const;

type View = (typeof VIEWS)[number][0];

/** Меню: три кнопки «Сегодня» / «Покупки» / «Неделя» (US-07, раскладка GIMN-011). */
export function NutritionView({
  today,
  weekStart,
  targetKcal,
  isDefaultTarget,
  entries,
  shopping,
}: {
  today: string;
  weekStart: string;
  targetKcal: number;
  isDefaultTarget: boolean;
  entries: NutritionEntry[];
  shopping: ShoppingListItem[];
}) {
  const router = useRouter();
  const [consumed, setConsumed] = useState<Record<string, boolean>>(
    Object.fromEntries(entries.map((e) => [e.id, e.consumed])),
  );
  const [bought, setBought] = useState<Record<string, boolean>>(
    Object.fromEntries(shopping.map((i) => [i.product, i.purchased])),
  );
  const [view, setView] = useState<View>("today");
  const [regenerating, setRegenerating] = useState(false);

  const todays = entries.filter((e) => e.date === today);
  const todayKcal = todays.reduce((t, e) => t + e.meal.total_kcal * e.portion, 0);
  const days = [...new Set(entries.map((e) => e.date))];

  async function toggleMeal(id: string) {
    const next = !consumed[id];
    setConsumed((prev) => ({ ...prev, [id]: next }));
    try {
      const res = await fetch("/api/nutrition/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_meal_id: id, consumed: next }),
      });
      if (!(await res.json()).success) throw new Error();
    } catch {
      setConsumed((prev) => ({ ...prev, [id]: !next }));
      toast.error("Отметка не сохранилась");
    }
  }

  async function toggleProduct(product: string) {
    const next = !bought[product];
    setBought((prev) => ({ ...prev, [product]: next }));
    try {
      const res = await fetch("/api/nutrition/shopping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start_date: weekStart, product, purchased: next }),
      });
      if (!(await res.json()).success) throw new Error();
    } catch {
      setBought((prev) => ({ ...prev, [product]: !next }));
      toast.error("Отметка не сохранилась");
    }
  }

  async function regenerate() {
    if (!window.confirm("Собрать меню на неделю заново? Отметки «съедено» сбросятся.")) return;
    setRegenerating(true);
    try {
      const res = await fetch("/api/nutrition/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ week_start_date: weekStart, regenerate: true }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось собрать меню");
        return;
      }
      toast.success("Меню обновлено");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setRegenerating(false);
    }
  }

  if (entries.length === 0) {
    return (
      <p className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        Справочник блюд пока пуст — меню собрать не из чего.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {isDefaultTarget ? (
        <p className="rounded-xl bg-accent/12 p-3 text-sm">
          Норма {targetKcal} ккал — средняя, а не ваша.{" "}
          <Link href="/onboarding/general?keep_mode=1" className="font-medium text-primary underline-offset-4 hover:underline">
            Заполните анкету
          </Link>
          , и меню подстроится под вас.
        </p>
      ) : null}

      <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Разделы меню">
        {VIEWS.map(([value, label]) => (
          <Button
            key={value}
            role="tab"
            aria-selected={view === value}
            variant={view === value ? "default" : "outline"}
            className="h-11"
            onClick={() => setView(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {view === "today" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Итого{" "}
            <span className="font-mono font-medium text-foreground">{Math.round(todayKcal)}</span> из{" "}
            <span className="font-mono">{targetKcal}</span> ккал
          </p>
          {todays.map((e) => (
            <MealCard
              key={e.id}
              entry={e}
              consumed={consumed[e.id] ?? false}
              onToggle={() => toggleMeal(e.id)}
            />
          ))}
        </div>
      ) : null}

      {view === "week" ? (
        <div className="space-y-2">
          {days.map((date) => {
            const list = entries.filter((e) => e.date === date);
            const total = list.reduce((t, e) => t + e.meal.total_kcal * e.portion, 0);
            return (
              <section
                key={date}
                className={cn(
                  "space-y-1.5 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
                  date === today && "ring-primary/40",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="font-medium">
                    {dayName(dayOfWeek(date), true)}
                    {date === today ? <span className="ml-1.5 text-xs text-primary">сегодня</span> : null}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">{Math.round(total)} ккал</span>
                </div>
                <ul className="space-y-0.5 text-sm">
                  {list.map((e) => (
                    <li key={e.id} className="flex gap-2">
                      <span className="w-20 shrink-0 text-muted-foreground">{MEAL_TYPE_LABELS[e.meal_type]}</span>
                      <span>{e.meal.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {view === "shopping" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            На неделю, с учётом порций. Отмечайте купленное.
          </p>
          <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
            {shopping.map((item) => {
              const done = bought[item.product] ?? false;
              return (
                <li key={item.product}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    onClick={() => toggleProduct(item.product)}
                    className="flex min-h-12 w-full items-center gap-3 px-4 text-left"
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        done ? "border-primary bg-primary text-primary-foreground" : "border-input",
                      )}
                    >
                      {done ? <CheckIcon className="size-3.5" /> : null}
                    </span>
                    <span className={cn("flex-1 text-sm", done && "text-muted-foreground line-through")}>
                      {item.product}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{formatGrams(item.grams)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Button variant="ghost" className="h-11 w-full" onClick={regenerate} disabled={regenerating}>
        {regenerating ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <RefreshCwIcon className="size-4" aria-hidden />
        )}
        Собрать меню заново
      </Button>
    </div>
  );
}

function MealCard({
  entry,
  consumed,
  onToggle,
}: {
  entry: NutritionEntry;
  consumed: boolean;
  onToggle: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { meal, portion } = entry;
  const portionText = portionLabel(portion);
  const icon = mealIcon(meal.category, entry.meal_type);

  return (
    <article className={cn("rounded-xl bg-card ring-1 ring-foreground/10", consumed && "opacity-70")}>
      <div className="flex items-start gap-3 p-4">
        <span
          aria-hidden
          title={icon.label}
          className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl leading-none"
        >
          {icon.emoji}
        </span>

        <button
          type="button"
          role="checkbox"
          aria-checked={consumed}
          aria-label={consumed ? "Съедено" : "Отметить как съеденное"}
          onClick={onToggle}
          className={cn(
            "mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors",
            consumed ? "border-primary bg-primary text-primary-foreground" : "border-input hover:bg-muted",
          )}
        >
          <CheckIcon className={cn("size-5", !consumed && "opacity-30")} />
        </button>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex flex-1 items-start justify-between gap-2 text-left"
        >
          <span className="space-y-0.5">
            <span className="block text-xs text-muted-foreground">
              {MEAL_TYPE_LABELS[entry.meal_type]} · {MEAL_TIME_HINTS[entry.meal_type]}
            </span>
            <span className={cn("block font-medium", consumed && "line-through")}>{meal.name}</span>
            <span className="block text-xs text-muted-foreground">
              <span className="font-mono">{scaled(meal.total_kcal, portion)}</span> ккал · Б{" "}
              {scaled(meal.total_protein_g, portion)} Ж {scaled(meal.total_fat_g, portion)} У{" "}
              {scaled(meal.total_carbs_g, portion)}
              {portionText ? ` · ${portionText}` : ""}
            </span>
          </span>
          <ChevronDownIcon
            className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-border p-4 text-sm">
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <ClockIcon className="size-4" aria-hidden /> {meal.cook_time_min} мин
          </p>
          <ul className="space-y-1">
            {meal.ingredients.map((ing) => (
              <li key={ing.product} className="flex justify-between gap-3">
                <span>{ing.product}</span>
                <span className="font-mono text-muted-foreground">{scaled(ing.grams, portion)} г</span>
              </li>
            ))}
          </ul>
          <p className="leading-relaxed whitespace-pre-line">{meal.recipe}</p>
        </div>
      ) : null}
    </article>
  );
}
