import { fail, ok, parseBody } from "@/lib/api";
import { toggleShoppingItemSchema } from "@/lib/schemas/nutrition";
import { createClient } from "@/lib/supabase/server";
import type { ShoppingListItem } from "@/lib/supabase/types";

/** POST /api/nutrition/shopping — галочка «куплено» у продукта. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, toggleShoppingItemSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { week_start_date, product, purchased } = parsed.data;

  const { data: list } = await supabase
    .from("shopping_list")
    .select("items")
    .eq("user_id", user.id)
    .eq("week_start_date", week_start_date)
    .maybeSingle();

  if (!list) return fail("Список покупок не найден", 404);

  const items = ((list.items ?? []) as ShoppingListItem[]).map((i) =>
    i.product === product ? { ...i, purchased } : i,
  );

  const { error } = await supabase
    .from("shopping_list")
    .update({ items })
    .eq("user_id", user.id)
    .eq("week_start_date", week_start_date);

  if (error) return fail("Не удалось обновить список", 500);

  return ok({ product, purchased });
}
