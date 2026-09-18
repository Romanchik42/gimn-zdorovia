import { fail, ok, parseBody } from "@/lib/api";
import { toggleMealSchema } from "@/lib/schemas/nutrition";
import { createClient } from "@/lib/supabase/server";

/** POST /api/nutrition/meal — отметить приём пищи съеденным. */
export async function POST(request: Request) {
  const parsed = await parseBody(request, toggleMealSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { data, error } = await supabase
    .from("user_meals")
    .update({ consumed: parsed.data.consumed })
    .eq("id", parsed.data.user_meal_id)
    .eq("user_id", user.id)
    .select("id");

  if (error) return fail("Не удалось сохранить отметку", 500);
  if (!data?.length) return fail("Приём пищи не найден", 404);

  return ok({ id: parsed.data.user_meal_id, consumed: parsed.data.consumed });
}
