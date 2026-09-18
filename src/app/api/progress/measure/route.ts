import { fail, ok, parseBody } from "@/lib/api";
import { measurementSchema } from "@/lib/schemas/progress";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";

/**
 * POST /api/progress/measure — замер за сегодня (US-09).
 * Одна строка на день: повторный замер дополняет её, не стирая то,
 * что в этот раз не заполняли.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, measurementSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const date = todayIso();
  const { data: current } = await supabase
    .from("user_progress")
    .select("weight_kg, shober_test_cm, stiffness_level")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const m = parsed.data;
  const { error } = await supabase.from("user_progress").upsert(
    {
      user_id: user.id,
      date,
      weight_kg: m.weight_kg ?? current?.weight_kg ?? null,
      shober_test_cm: m.shober_test_cm ?? current?.shober_test_cm ?? null,
      stiffness_level: m.stiffness_level ?? current?.stiffness_level ?? null,
    },
    { onConflict: "user_id,date" },
  );

  if (error) {
    console.error("measurement upsert failed:", error.message);
    return fail("Не удалось сохранить замер", 500);
  }

  return ok({ date });
}
