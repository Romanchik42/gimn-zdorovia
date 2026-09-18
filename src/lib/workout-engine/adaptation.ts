/**
 * Персональная адаптация программы раз в 30 дней от регистрации (SPEC 5.5).
 * Модуль чистый — только правила, без БД.
 */

export type Adjustment = "harder" | "keep" | "change_focus" | "simplify" | "reduce_and_doctor";

export type PeriodStats = {
  mode: "behtereva" | "general";
  goal: "lose" | "gain" | "maintain" | null;
  /** Завершённых тренировок за период. */
  workouts: number;
  periodDays: number;
  /** Побочки за период без «просто тяжело». */
  sideEffects: number;
  shoberFirst: number | null;
  shoberLast: number | null;
  stiffnessFirst: number | null;
  stiffnessLast: number | null;
  weightFirst: number | null;
  weightLast: number | null;
  /** Зона для смены акцента — подпись для текста рекомендации. */
  newFocusLabel: string | null;
};

export type Verdict = {
  adjustment: Adjustment;
  recommendation: string;
  /** null — замеров не хватило, чтобы судить о прогрессе. */
  progress: boolean | null;
  perWeek: number;
};

const SIDE_EFFECTS_FOR_DOCTOR = 5;
const FLEX_GAIN = 0.05;
const STIFFNESS_DROP = 1;
const WEIGHT_STEP_KG = 0.5;
const MAINTAIN_BAND_KG = 1;

/**
 * Есть ли прогресс. Намеренно трёхзначно: без замеров мы не знаем — и в этом
 * случае НЕ делаем вывод «показатели стоят», чтобы не менять программу вслепую.
 */
export function detectProgress(s: PeriodStats): boolean | null {
  const signals: boolean[] = [];

  if (s.shoberFirst !== null && s.shoberLast !== null && s.shoberFirst > 0) {
    signals.push((s.shoberLast - s.shoberFirst) / s.shoberFirst >= FLEX_GAIN);
  }
  if (s.stiffnessFirst !== null && s.stiffnessLast !== null) {
    signals.push(s.stiffnessFirst - s.stiffnessLast >= STIFFNESS_DROP);
  }
  if (s.weightFirst !== null && s.weightLast !== null && s.goal) {
    const delta = s.weightLast - s.weightFirst;
    if (s.goal === "lose") signals.push(delta <= -WEIGHT_STEP_KG);
    else if (s.goal === "gain") signals.push(delta >= WEIGHT_STEP_KG);
    else signals.push(Math.abs(delta) <= MAINTAIN_BAND_KG);
  }

  if (signals.length === 0) return null;
  return signals.some(Boolean);
}

export function decide(s: PeriodStats): Verdict {
  const perWeek = s.periodDays > 0 ? (s.workouts / s.periodDays) * 7 : 0;
  const progress = detectProgress(s);
  const base = { progress, perWeek };

  // Порядок важен: безопасность выше любых целей.
  if (s.sideEffects >= SIDE_EFFECTS_FOR_DOCTOR) {
    return {
      ...base,
      adjustment: "reduce_and_doctor",
      recommendation:
        "Несколько раз было плохое самочувствие. Снижаем нагрузку и рекомендуем показаться врачу.",
    };
  }

  if (perWeek < 2) {
    return {
      ...base,
      adjustment: "simplify",
      recommendation:
        "Получается реже, чем хотелось. Сделаем программу короче — 20 минут вместо 40. Главное — регулярность.",
    };
  }

  if (progress === true && perWeek >= 4) {
    return {
      ...base,
      adjustment: "harder",
      recommendation: "Отлично идёшь. Со следующей недели добавим нагрузки — программа станет чуть сложнее.",
    };
  }

  if (progress === true) {
    return {
      ...base,
      adjustment: "keep",
      recommendation: "Стабильно. Программа остаётся прежней — она тебе подходит.",
    };
  }

  if (progress === false && perWeek >= 4) {
    return {
      ...base,
      adjustment: "change_focus",
      recommendation: s.newFocusLabel
        ? `Занимаешься регулярно, но показатели стоят. Меняем акцент: добавим работу над зоной «${s.newFocusLabel}».`
        : "Занимаешься регулярно, но показатели стоят. Попробуй на неделе собрать пару своих тренировок с другим акцентом.",
    };
  }

  // Прогресса нет при 2-3 занятиях или замеров не хватило — программу не трогаем.
  return {
    ...base,
    adjustment: "keep",
    recommendation:
      progress === null
        ? "Программа остаётся прежней. Чтобы система видела прогресс, раз в неделю добавляй замер в разделе «Прогресс»."
        : "Программа остаётся прежней. Попробуй добавить одно занятие в неделю — так результат придёт быстрее.",
  };
}
