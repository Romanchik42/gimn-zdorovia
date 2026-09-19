import { fail, ok, parseBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";
import {
  deriveRestrictions,
  explainRestrictions,
  extendedDiagnosticsSchema,
  type LimitedZone,
} from "@/lib/diagnostics/extended";
import type { SequenceIntensity } from "@/lib/supabase/types";

/** Зона опроса → фокус плана (как в calculateDiagnostics). */
const ZONE_FOCUS: Record<LimitedZone, string> = {
  neck: "neck",
  shoulder: "shoulder",
  spine: "spine",
  hips: "hips",
  legs: "legs",
};

/**
 * POST /api/onboarding/diagnostics/extended — углублённая диагностика (GIMN-011).
 *
 * Дополняет последнюю базовую диагностику: сохраняет ответы и пересчитывает
 * интенсивность и фокус. Пройти можно повторно (из настроек) — ответы
 * перезаписываются. Ещё не начатые тренировки из плана сбрасываются, чтобы
 * следующая собралась уже с новыми ограничениями.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, extendedDiagnosticsSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("id, calculated_intensity, calculated_focus")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!diagnostics) return fail("Сначала пройдите основную диагностику", 409);

  const answers = parsed.data.answers;
  const restrictions = deriveRestrictions(answers);

  // Углублённые ответы могут только облегчить нагрузку, но не утяжелить её.
  const intensity: SequenceIntensity =
    restrictions.heavy || restrictions.bpRisk ? "low" : (diagnostics.calculated_intensity as SequenceIntensity);
  const focus = [
    ...new Set([...(diagnostics.calculated_focus ?? []), ...restrictions.limitedZones.map((z) => ZONE_FOCUS[z])]),
  ];

  const { error } = await supabase
    .from("user_diagnostics")
    .update({
      extended_answers: answers,
      extended_completed_at: new Date().toISOString(),
      calculated_intensity: intensity,
      calculated_focus: focus,
    })
    .eq("id", diagnostics.id);

  if (error) {
    console.error("extended diagnostics save failed:", error.message);
    return fail("Не удалось сохранить ответы", 500);
  }

  // Не начатые тренировки из плана собраны по старым ответам — пересоберутся сами.
  await supabase
    .from("user_workouts")
    .delete()
    .eq("user_id", user.id)
    .eq("source", "plan")
    .eq("status", "planned")
    .is("started_at", null)
    .gte("scheduled_date", todayIso());

  return ok({
    calculated_intensity: intensity,
    calculated_focus: focus,
    restrictions,
    explanation: explainRestrictions(restrictions),
  });
}
