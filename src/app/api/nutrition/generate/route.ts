import { fail, ok, parseBody } from "@/lib/api";
import { generateNutritionSchema } from "@/lib/schemas/nutrition";
import { createClient } from "@/lib/supabase/server";
import { ensureWeekMenu } from "@/lib/nutrition-engine/service";
import { todayIso, weekStartOf } from "@/lib/dates";

/** POST /api/nutrition/generate — меню на неделю + список покупок (SPEC 3.5). */
export async function POST(request: Request) {
  const parsed = await parseBody(request, generateNutritionSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  // Неделя всегда с понедельника: любую дату приводим к её понедельнику.
  const weekStart = weekStartOf(parsed.data.week_start_date ?? todayIso());

  try {
    const menu = await ensureWeekMenu(supabase, user.id, weekStart, {
      regenerate: parsed.data.regenerate,
    });
    return ok({
      week_start_date: weekStart,
      days_generated: new Set(menu.entries.map((e) => e.date)).size,
      target_kcal: menu.targetKcal,
    });
  } catch (e) {
    console.error("nutrition generate failed:", e);
    return fail("Не удалось собрать меню", 500);
  }
}
