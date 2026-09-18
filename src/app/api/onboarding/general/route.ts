import { fail, ok, parseBody } from "@/lib/api";
import { generalProfileSchema } from "@/lib/schemas/diagnostics";
import { calculateAll } from "@/lib/nutrition-engine/calories";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDefaultWeekPlan } from "@/lib/auth/provision";

/**
 * POST /api/onboarding/general (US-02).
 * Считает BMR → TDEE → целевые калории (Миффлин, SPEC 5.1),
 * сохраняет анкету и раскладывает недельный план общего режима.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, generalProfileSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const input = parsed.data;
  const { bmr, tdee, target } = calculateAll({
    gender: input.gender,
    weightKg: input.weight_kg,
    heightCm: input.height_cm,
    ageYears: input.age_years,
    activity: input.activity_level,
    goal: input.goal,
  });

  const { error } = await supabase.from("user_profiles_general").upsert(
    {
      user_id: user.id,
      weight_kg: input.weight_kg,
      height_cm: input.height_cm,
      goal: input.goal,
      activity_level: input.activity_level,
      difficulty: input.difficulty,
      training_days: input.training_days,
      calculated_bmr: bmr,
      calculated_tdee: tdee,
      calculated_target_calories: target,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("general profile upsert failed:", error.message);
    return fail("Не удалось сохранить анкету", 500);
  }

  // Пол и возраст живут в users — они нужны и вне анкеты.
  const birthYear = new Date().getFullYear() - input.age_years;
  const admin = createAdminClient();
  await admin
    .from("users")
    .update({
      mode: "general",
      gender: input.gender,
      birth_date: `${birthYear}-01-01`,
    })
    .eq("id", user.id);

  try {
    await createDefaultWeekPlan(user.id, "general");
  } catch (e) {
    console.error("week plan creation failed:", e);
  }

  return ok({
    bmr,
    tdee,
    target_calories: target,
    next_step: "theme",
  });
}
