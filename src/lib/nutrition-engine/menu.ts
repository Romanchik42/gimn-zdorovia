import type { MealRow, MealType, ShoppingListItem } from "@/lib/supabase/types";

/**
 * Подбор меню на неделю (SPEC 3.5, 5.3, US-07).
 *
 * Правила:
 * - сумма дня в пределах нормы ±5%;
 * - одно блюдо не чаще 2 раз в неделю;
 * - рецепты ≤ 30 минут и ≤ 6 ингредиентов (при нехватке — ослабляем);
 * - противопоказания пользователя исключают блюдо.
 *
 * Модуль чистый (без БД), чтобы его можно было проверить на seed напрямую.
 */

export const MEAL_ORDER: MealType[] = ["breakfast", "lunch", "snack", "dinner"];

/** Доли нормы по приёмам пищи (SPEC 5.3, середины диапазонов). */
export const MEAL_SHARE: Record<MealType, number> = {
  breakfast: 0.275,
  lunch: 0.375,
  snack: 0.125,
  dinner: 0.225,
};

export const MAX_USES_PER_WEEK = 2;
export const PORTION_MIN = 0.5;
export const PORTION_MAX = 2.5;
const PORTION_STEP = 0.05;
/** Целимся в ±3%, чтобы округление граммов не вытолкнуло за ±5%. */
const INNER_TOLERANCE = 0.03;
export const TOLERANCE = 0.05;

export type PlannedSlot = { meal_type: MealType; meal_id: string; portion: number };
export type PlannedDay = { date: string; slots: PlannedSlot[]; total_kcal: number };

type MenuMeal = Pick<
  MealRow,
  "id" | "meal_type" | "total_kcal" | "cook_time_min" | "ingredients" | "contraindications"
>;

/** Детерминированный ГПСЧ: одно и то же меню для пользователя и недели. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roundPortion(p: number): number {
  const stepped = Math.round(p / PORTION_STEP) * PORTION_STEP;
  return Math.min(PORTION_MAX, Math.max(PORTION_MIN, Number(stepped.toFixed(2))));
}

function isQuick(m: MenuMeal): boolean {
  return m.cook_time_min <= 30 && (m.ingredients?.length ?? 0) <= 6;
}

export function planWeek(args: {
  meals: MenuMeal[];
  targetKcal: number;
  dates: string[];
  contraindications?: string[];
  seed: number;
}): PlannedDay[] {
  const blocked = new Set(args.contraindications ?? []);
  const random = mulberry32(args.seed);
  const uses = new Map<string, number>();

  const allowed = args.meals.filter(
    (m) => !(m.contraindications ?? []).some((c) => blocked.has(c)),
  );

  return args.dates.map((date) => {
    const slots: PlannedSlot[] = [];
    const kcalOf = new Map<string, number>();

    for (const type of MEAL_ORDER) {
      const want = args.targetKcal * MEAL_SHARE[type];
      const ofType = allowed.filter((m) => m.meal_type === type);
      const fresh = ofType.filter((m) => (uses.get(m.id) ?? 0) < MAX_USES_PER_WEEK);

      // Ослабляем ограничения по очереди, только если иначе нечего есть.
      const pool =
        [fresh.filter(isQuick), fresh, ofType].find((list) => list.length > 0) ?? [];
      if (pool.length === 0) continue;

      let best = pool[0];
      let bestScore = Infinity;
      for (const m of pool) {
        const portion = want / m.total_kcal;
        // Предпочитаем блюда, которым почти не нужна подгонка порции,
        // и немного — те, что на этой неделе ещё не встречались.
        const score =
          Math.abs(Math.log(portion)) +
          ((uses.get(m.id) ?? 0) > 0 ? 0.25 : 0) +
          random() * 0.35;
        if (score < bestScore) {
          bestScore = score;
          best = m;
        }
      }

      uses.set(best.id, (uses.get(best.id) ?? 0) + 1);
      kcalOf.set(best.id, best.total_kcal);
      slots.push({ meal_type: type, meal_id: best.id, portion: roundPortion(want / best.total_kcal) });
    }

    balanceDay(slots, kcalOf, args.targetKcal);

    return { date, slots, total_kcal: dayKcal(slots, kcalOf) };
  });
}

function dayKcal(slots: PlannedSlot[], kcalOf: Map<string, number>): number {
  return Math.round(slots.reduce((t, s) => t + s.portion * (kcalOf.get(s.meal_id) ?? 0), 0));
}

/**
 * Доводка суммы дня до нормы шагами по 0.05 порции. Двигаем самое калорийное
 * блюдо, у которого ещё есть запас по порции, — так правка меньше заметна.
 */
function balanceDay(slots: PlannedSlot[], kcalOf: Map<string, number>, target: number): void {
  for (let i = 0; i < 200; i++) {
    const total = dayKcal(slots, kcalOf);
    const diff = target - total;
    if (Math.abs(diff) <= target * INNER_TOLERANCE) return;

    const up = diff > 0;
    const movable = slots
      .filter((s) => (up ? s.portion < PORTION_MAX : s.portion > PORTION_MIN))
      .sort((a, b) => (kcalOf.get(b.meal_id) ?? 0) - (kcalOf.get(a.meal_id) ?? 0));

    const slot = movable[0];
    if (!slot) return;
    slot.portion = roundPortion(slot.portion + (up ? PORTION_STEP : -PORTION_STEP));
  }
}

/** Список покупок: граммы × порции, суммой по продукту, вверх до 10 г. */
export function aggregateShopping(
  days: PlannedDay[],
  mealsById: Map<string, Pick<MealRow, "ingredients">>,
  previous: ShoppingListItem[] = [],
): ShoppingListItem[] {
  const grams = new Map<string, number>();

  for (const day of days) {
    for (const slot of day.slots) {
      for (const ing of mealsById.get(slot.meal_id)?.ingredients ?? []) {
        grams.set(ing.product, (grams.get(ing.product) ?? 0) + ing.grams * slot.portion);
      }
    }
  }

  // Галочки «куплено» переживают пересборку меню.
  const purchased = new Set(previous.filter((i) => i.purchased).map((i) => i.product));

  return [...grams.entries()]
    .map(([product, g]) => ({
      product,
      grams: Math.ceil(g / 10) * 10,
      purchased: purchased.has(product),
    }))
    .sort((a, b) => a.product.localeCompare(b.product, "ru"));
}
