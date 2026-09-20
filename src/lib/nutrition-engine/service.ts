import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { datesFrom } from "@/lib/dates";
import {
  MEAL_ORDER,
  aggregateShopping,
  hashSeed,
  planWeek,
} from "@/lib/nutrition-engine/menu";
import type { MealRow, MealType, ShoppingListItem } from "@/lib/supabase/types";
import { currentMode } from "@/lib/modes/server";
import type { Mode } from "@/lib/modes";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Норма по умолчанию, если анкеты общего режима нет (например, режим Бехтерева).
 * Это средняя величина, а не расчёт, — в интерфейсе об этом честно сказано.
 */
export const DEFAULT_TARGET_KCAL = 2000;

/** Насколько меню может разойтись с нормой, прежде чем считаться устаревшим. */
const OUTDATED_THRESHOLD = 0.15;

export type MenuEntry = {
  id: string;
  date: string;
  meal_type: MealType;
  portion: number;
  consumed: boolean;
  meal: MealRow;
};

export type WeekMenu = {
  weekStart: string;
  mode: Mode;
  targetKcal: number;
  isDefaultTarget: boolean;
  entries: MenuEntry[];
  shopping: ShoppingListItem[];
};

/**
 * Норма калорий. Считается по анкете общего режима — и только в нём:
 * в режиме Бехтерева меню не должно подстраиваться под цель «похудеть»,
 * даже если человек заполнил анкету второго режима (GIMN-012).
 */
async function loadTarget(supabase: ServerClient, userId: string, mode: Mode) {
  if (mode !== "general") return { targetKcal: DEFAULT_TARGET_KCAL, isDefaultTarget: true };

  const { data } = await supabase
    .from("user_profiles_general")
    .select("calculated_target_calories")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.calculated_target_calories
    ? { targetKcal: data.calculated_target_calories, isDefaultTarget: false }
    : { targetKcal: DEFAULT_TARGET_KCAL, isDefaultTarget: true };
}

/**
 * Меню недели: читает готовое или собирает, если его нет (или просили пересобрать).
 * Сборка идемпотентна: UNIQUE (user_id, date, meal_type) + upsert.
 */
export async function ensureWeekMenu(
  supabase: ServerClient,
  userId: string,
  weekStart: string,
  opts: { regenerate?: boolean; mode?: Mode } = {},
): Promise<WeekMenu> {
  const dates = datesFrom(weekStart, 7);
  const mode = opts.mode ?? (await currentMode(supabase, userId));
  const { targetKcal, isDefaultTarget } = await loadTarget(supabase, userId, mode);

  const { data: mealsData } = await supabase.from("meals").select("*");
  const meals = (mealsData ?? []) as MealRow[];
  const mealsById = new Map(meals.map((m) => [m.id, m]));

  const existing = await supabase
    .from("user_meals")
    .select("id, date, meal_type, meal_id, portion, consumed")
    .eq("user_id", userId)
    .eq("mode", mode)
    .gte("date", dates[0])
    .lte("date", dates[6]);

  const complete = (existing.data?.length ?? 0) >= dates.length * MEAL_ORDER.length;

  // Норма могла измениться (заполнили анкету, сменили цель) — тогда меню,
  // собранное под старую норму, уже не годится и собирается заново.
  const dayTotals = new Map<string, number>();
  for (const r of existing.data ?? []) {
    const kcal = (mealsById.get(r.meal_id)?.total_kcal ?? 0) * Number(r.portion ?? 1);
    dayTotals.set(r.date, (dayTotals.get(r.date) ?? 0) + kcal);
  }
  // Порог шире допуска меню: при очень высокой норме (≥3750 ккал) даже порции
  // ×2.5 не дотягивают до ±5%, и строгая проверка пересобирала бы меню — со
  // сбросом отметок «съедено» — при каждом заходе. Смена нормы из-за анкеты
  // или цели — это десятки процентов, её 15% ловят надёжно.
  const outdated = [...dayTotals.values()].some(
    (total) => Math.abs(total - targetKcal) / targetKcal > OUTDATED_THRESHOLD,
  );

  if ((!complete || outdated || opts.regenerate) && meals.length > 0) {
    const planned = planWeek({
      meals,
      targetKcal,
      dates,
      seed: hashSeed(`${userId}:${weekStart}:${opts.regenerate ? Date.now() : 0}`),
    });

    const rows = planned.flatMap((day) =>
      day.slots.map((s) => ({
        user_id: userId,
        mode,
        date: day.date,
        meal_type: s.meal_type,
        meal_id: s.meal_id,
        portion: s.portion,
        consumed: false,
      })),
    );

    const { error } = await supabase
      .from("user_meals")
      .upsert(rows, { onConflict: "user_id,mode,date,meal_type" });
    if (error) throw new Error(`Не удалось сохранить меню: ${error.message}`);

    const { data: prevList } = await supabase
      .from("shopping_list")
      .select("items")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("week_start_date", weekStart)
      .maybeSingle();

    const items = aggregateShopping(
      planned,
      mealsById,
      (prevList?.items as ShoppingListItem[] | undefined) ?? [],
    );

    const { error: listError } = await supabase
      .from("shopping_list")
      .upsert(
        { user_id: userId, mode, week_start_date: weekStart, items },
        { onConflict: "user_id,mode,week_start_date" },
      );
    if (listError) throw new Error(`Не удалось сохранить список покупок: ${listError.message}`);
  }

  const [{ data: rows }, { data: list }] = await Promise.all([
    supabase
      .from("user_meals")
      .select("id, date, meal_type, meal_id, portion, consumed")
      .eq("user_id", userId)
      .eq("mode", mode)
      .gte("date", dates[0])
      .lte("date", dates[6])
      .order("date"),
    supabase
      .from("shopping_list")
      .select("items")
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("week_start_date", weekStart)
      .maybeSingle(),
  ]);

  const order = new Map(MEAL_ORDER.map((t, i) => [t, i]));
  const entries = (rows ?? [])
    .filter((r) => mealsById.has(r.meal_id))
    .map((r) => ({
      id: r.id,
      date: r.date,
      meal_type: r.meal_type as MealType,
      portion: Number(r.portion ?? 1),
      consumed: r.consumed,
      meal: mealsById.get(r.meal_id)!,
    }))
    .sort((a, b) =>
      a.date === b.date
        ? (order.get(a.meal_type) ?? 0) - (order.get(b.meal_type) ?? 0)
        : a.date.localeCompare(b.date),
    );

  return {
    weekStart,
    mode,
    targetKcal,
    isDefaultTarget,
    entries,
    shopping: (list?.items as ShoppingListItem[] | undefined) ?? [],
  };
}
