import { fail, ok, parseBody } from "@/lib/api";
import { diagnosticsSchema } from "@/lib/schemas/diagnostics";
import { calculateDiagnostics } from "@/lib/onboarding/diagnostics-calc";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDefaultWeekPlan } from "@/lib/auth/provision";

/**
 * POST /api/onboarding/diagnostics (SPEC 3.2).
 * Считает интенсивность и фокус, сохраняет диагностику,
 * переводит пользователя в режим «Бехтерева» и раскладывает недельный план.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, diagnosticsSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { intensity, focus } = calculateDiagnostics(parsed.data);

  const { data, error } = await supabase
    .from("user_diagnostics")
    .insert({
      user_id: user.id,
      shober_test_cm: parsed.data.shober_test_cm ?? null,
      side_bend_left_cm: parsed.data.side_bend_left_cm ?? null,
      side_bend_right_cm: parsed.data.side_bend_right_cm ?? null,
      rotation_degrees: parsed.data.rotation_degrees ?? null,
      pain_areas: parsed.data.pain_areas ?? [],
      stiffness_level: parsed.data.stiffness_level ?? null,
      blood_pressure_ok: parsed.data.blood_pressure_ok ?? null,
      calculated_intensity: intensity,
      calculated_focus: focus,
    })
    .select("id")
    .single();

  if (error) {
    console.error("diagnostics insert failed:", error.message);
    return fail("Не удалось сохранить диагностику", 500);
  }

  const admin = createAdminClient();
  await admin.from("users").update({ mode: "behtereva" }).eq("id", user.id);

  try {
    await createDefaultWeekPlan(user.id, "behtereva");
  } catch (e) {
    // План не критичен для продолжения онбординга — соберём при первой тренировке.
    console.error("week plan creation failed:", e);
  }

  return ok({
    diagnostics_id: data.id,
    calculated_intensity: intensity,
    calculated_focus: focus,
    next_step: "theme",
  });
}
