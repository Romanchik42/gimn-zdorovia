import { fail, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { createDefaultWeekPlan } from "@/lib/auth/provision";
import { DEFAULT_WEEK_PLAN } from "@/lib/workout-engine/weekly-cycle";

/** POST /api/plan/reset — «Вернуть рекомендуемый план» (US-06). */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const { data: profile } = await supabase
    .from("users")
    .select("mode")
    .eq("id", user.id)
    .maybeSingle();

  const mode = profile?.mode ?? "general";

  try {
    await createDefaultWeekPlan(user.id, mode);
  } catch (e) {
    console.error("plan reset failed:", e);
    return fail("Не удалось вернуть рекомендуемый план", 500);
  }

  return ok({ days: DEFAULT_WEEK_PLAN[mode] });
}
