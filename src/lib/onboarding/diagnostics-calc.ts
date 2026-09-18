import type { DiagnosticsInput } from "@/lib/schemas/diagnostics";
import type { SequenceIntensity } from "@/lib/supabase/types";

/**
 * Расчёт интенсивности и фокуса по диагностике (SPEC 3.2).
 *
 * Все измерения опциональны — пользователь мог нажать «не знаю».
 * Отсутствие данных НЕ должно приводить к завышению нагрузки, поэтому
 * при нехватке информации остаёмся на medium, а не на normal.
 */

/** Норма теста Шобера — прирост около 5 см и больше. */
const SHOBER_LOW_THRESHOLD = 3;
const SHOBER_GOOD_THRESHOLD = 4.5;
const ROTATION_LOW_THRESHOLD = 25;
const MANY_PAIN_AREAS = 3;

export type DiagnosticsResult = {
  intensity: SequenceIntensity;
  focus: string[];
  reasons: string[];
};

export function calculateDiagnostics(input: DiagnosticsInput): DiagnosticsResult {
  const reasons: string[] = [];
  const painAreas = input.pain_areas ?? [];

  let low = false;

  if (input.stiffness_level === "high") {
    low = true;
    reasons.push("сильная утренняя скованность");
  }

  if (input.blood_pressure_ok === false) {
    low = true;
    reasons.push("давление не в норме");
  }

  if (typeof input.shober_test_cm === "number" && input.shober_test_cm < SHOBER_LOW_THRESHOLD) {
    low = true;
    reasons.push("тест Шобера ниже нормы");
  }

  if (painAreas.length > MANY_PAIN_AREAS) {
    low = true;
    reasons.push("боль сразу в нескольких зонах");
  }

  if (
    typeof input.rotation_degrees === "number" &&
    input.rotation_degrees < ROTATION_LOW_THRESHOLD
  ) {
    low = true;
    reasons.push("ограничена ротация позвоночника");
  }

  let intensity: SequenceIntensity;

  if (low) {
    intensity = "low";
  } else {
    // normal даём только когда показатели реально хорошие И их измерили.
    const shoberGood =
      typeof input.shober_test_cm === "number" && input.shober_test_cm >= SHOBER_GOOD_THRESHOLD;
    const stiffnessLow = input.stiffness_level === "low";
    const fewPains = painAreas.length <= 1;

    intensity = shoberGood && stiffnessLow && fewPains ? "normal" : "medium";
    if (intensity === "medium") reasons.push("данных для повышенной нагрузки недостаточно");
  }

  return { intensity, focus: calculateFocus(painAreas, input), reasons };
}

/**
 * Приоритет зонам, где есть боль или ограничение.
 * Позвоночник в списке всегда: при Бехтерева он основная мишень болезни,
 * даже если сегодня не болит.
 */
function calculateFocus(painAreas: string[], input: DiagnosticsInput): string[] {
  const focus = new Set<string>();

  for (const area of painAreas) {
    switch (area) {
      case "neck":
        focus.add("neck");
        break;
      case "shoulder":
        focus.add("shoulder");
        break;
      case "spine_thoracic":
        focus.add("spine_thoracic");
        break;
      case "spine_lumbar":
        focus.add("spine_lumbar");
        break;
      case "hips":
        focus.add("hips");
        break;
      case "legs":
        focus.add("legs");
        break;
    }
  }

  if (typeof input.shober_test_cm === "number" && input.shober_test_cm < SHOBER_GOOD_THRESHOLD) {
    focus.add("spine_lumbar");
  }

  if (
    typeof input.rotation_degrees === "number" &&
    input.rotation_degrees < ROTATION_LOW_THRESHOLD
  ) {
    focus.add("spine_thoracic");
  }

  const bendDiff =
    typeof input.side_bend_left_cm === "number" && typeof input.side_bend_right_cm === "number"
      ? Math.abs(input.side_bend_left_cm - input.side_bend_right_cm)
      : 0;
  // Заметная асимметрия наклонов — повод отдельно поработать с позвоночником.
  if (bendDiff >= 3) focus.add("spine");

  focus.add("spine");

  return [...focus];
}

/** Повторная диагностика доступна раз в 30 дней (US-01). */
export const REDIAGNOSIS_INTERVAL_DAYS = 30;

export function canRediagnose(lastCreatedAt: string | null | undefined): boolean {
  if (!lastCreatedAt) return true;
  const elapsed = Date.now() - new Date(lastCreatedAt).getTime();
  return elapsed >= REDIAGNOSIS_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
}
