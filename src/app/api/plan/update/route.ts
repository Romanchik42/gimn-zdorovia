import { fail, ok, parseBody } from "@/lib/api";
import { planUpdateSchema } from "@/lib/schemas/workout";
import { createClient } from "@/lib/supabase/server";
import { validateWeekPlan, type WeekPlanDay } from "@/lib/workout-engine/weekly-cycle";
import type { Intensity } from "@/lib/supabase/types";

/**
 * POST /api/plan/update (SPEC 3.3, US-06).
 * Предупреждения возвращаем, но план СОХРАНЯЕМ — это решение пользователя.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, planUpdateSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { data: current } = await supabase
    .from("user_week_plan")
    .select("day_of_week, focus, duration_min, intensity, is_rest_day, is_custom")
    .eq("user_id", user.id);

  const before = new Map((current ?? []).map((d) => [d.day_of_week, d]));

  const days: WeekPlanDay[] = parsed.data.days.map((d) => {
    const prev = before.get(d.day_of_week);
    return {
      day_of_week: d.day_of_week,
      // В день отдыха фокус не важен, но колонка NOT NULL — держим понятную метку.
      focus: d.is_rest_day ? (d.focus ?? "stretch") : (d.focus ?? prev?.focus ?? "full_body"),
      duration_min: d.duration_min ?? prev?.duration_min ?? (d.is_rest_day ? 15 : 40),
      intensity: (d.intensity ?? prev?.intensity ?? "medium") as Intensity,
      is_rest_day: d.is_rest_day,
    };
  });

  const rows = days.map((d) => {
    const prev = before.get(d.day_of_week);
    const changed =
      !prev ||
      prev.focus !== d.focus ||
      prev.duration_min !== d.duration_min ||
      prev.intensity !== d.intensity ||
      prev.is_rest_day !== d.is_rest_day;

    return {
      user_id: user.id,
      ...d,
      // Однажды изменённый вручную день остаётся custom, даже если его вернули.
      is_custom: changed || (prev?.is_custom ?? false),
    };
  });

  const { error } = await supabase
    .from("user_week_plan")
    .upsert(rows, { onConflict: "user_id,day_of_week" });

  if (error) {
    console.error("plan upsert failed:", error.message);
    return fail("Не удалось сохранить план", 500);
  }

  return ok({ saved: rows.length, warnings: validateWeekPlan(days) });
}
