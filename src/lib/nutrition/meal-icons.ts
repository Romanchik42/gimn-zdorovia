import type { MealCategory, MealType } from "@/lib/supabase/types";

/**
 * Иконки блюд (GIMN-011). Эмодзи, а не картинки: ничего не весит, не требует
 * лицензий и ключей, одинаково читается на телефоне. Категория блюда —
 * meals.category (миграция 0014); если её нет, берём по типу приёма пищи,
 * чтобы в карточке не было пустого места.
 */

export const MEAL_CATEGORY_ICONS: Record<MealCategory, { emoji: string; label: string }> = {
  porridge: { emoji: "🥣", label: "Каша" },
  meat: { emoji: "🍗", label: "Мясо и птица" },
  fish: { emoji: "🐟", label: "Рыба" },
  vegetables: { emoji: "🥦", label: "Овощи" },
  dairy: { emoji: "🧀", label: "Творог и молочное" },
  soup: { emoji: "🍲", label: "Суп" },
  eggs: { emoji: "🍳", label: "Яйца" },
  fruit: { emoji: "🍎", label: "Фрукты" },
};

const BY_MEAL_TYPE: Record<MealType, MealCategory> = {
  breakfast: "porridge",
  lunch: "meat",
  snack: "fruit",
  dinner: "vegetables",
};

export function mealIcon(
  category: MealCategory | null | undefined,
  mealType: MealType,
): { emoji: string; label: string } {
  return MEAL_CATEGORY_ICONS[category ?? BY_MEAL_TYPE[mealType]];
}
