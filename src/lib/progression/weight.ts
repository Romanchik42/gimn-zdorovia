import { daysBetween } from "@/lib/dates";
import type { TargetJoint } from "@/lib/supabase/types";

/**
 * Сколько ставить в следующий раз (GIMN-028, блок F).
 *
 * Правило линейной прогрессии Starting Strength / StrongLifts: пока
 * выполняешь назначенное — добавляй, дважды не выполнил — отступи и зайди
 * снова. Для начинающего это работает лучше любых процентов от максимума,
 * потому что никакого максимума он ещё не знает, а замерять его на больной
 * спине незачем.
 *
 * Функция ничего не решает за человека: она возвращает предложение и
 * причину. Причина важнее числа — «два раза не вышло, отступаем» человек
 * примет, а молча уехавший вниз вес воспримет как поломку.
 */

/** Верх тела растёт медленнее: те же 5 кг на жиме — совсем другой шаг, чем в приседе. */
export const UPPER_STEP_KG = 2.5;
export const LOWER_STEP_KG = 5;
export const SUCCESS_STREAK = 3;
export const FAIL_STREAK = 2;
export const DROP_PCT = 10;
/** Разгрузка каждую четвёртую неделю: объём ниже, вес прежний. */
export const DELOAD_EVERY_WEEKS = 4;
export const DELOAD_VOLUME_PCT = 60;
export const FULL_VOLUME_PCT = 100;

/** Крупные суставы — крупный шаг. Всё, что не ноги и не спина, идёт малым. */
const LOWER_JOINTS: TargetJoint[] = ["legs", "hips", "spine"];

export function stepFor(joint: TargetJoint): number {
  return LOWER_JOINTS.includes(joint) ? LOWER_STEP_KG : UPPER_STEP_KG;
}

export type ProgressSet = {
  date: string;
  set_number: number;
  reps: number;
  weight_kg: number | null;
};

export type ExercisePlan = {
  /** Сколько повторов назначено в подходе. */
  targetReps: number;
  /** Сколько подходов назначено. */
  sets: number;
  joint: TargetJoint;
};

export type WeightSuggestion = {
  /** Предлагаемый вес. null — веса в записях нет, прогрессию считать не по чему. */
  weight_kg: number | null;
  /** Насколько меняем: 0 — оставляем как есть. */
  change_kg: number;
  /** 100 обычно, 60 на разгрузочной неделе. */
  volume_pct: number;
  reason: string;
};

type Session = { date: string; weight: number; success: boolean };

/** Вес округляем до половины килограмма: меньшего шага на обычных блинах нет. */
function roundKg(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Одно занятие — один вес и приговор. Занятие засчитано, когда сделано
 * назначенное число подходов и в каждом — назначенные повторы. Подход,
 * доделанный с меньшим весом, в зачёт не идёт: это уже другой подход.
 */
function sessions(history: ProgressSet[], plan: ExercisePlan): Session[] {
  const byDate = new Map<string, ProgressSet[]>();
  for (const set of history) {
    if (set.weight_kg == null || set.weight_kg <= 0) continue;
    const list = byDate.get(set.date);
    if (list) list.push(set);
    else byDate.set(set.date, [set]);
  }

  return [...byDate.entries()]
    .map(([date, sets]) => {
      const weight = Math.max(...sets.map((s) => s.weight_kg ?? 0));
      const atWeight = sets.filter((s) => s.weight_kg === weight);
      const success = atWeight.length >= plan.sets && atWeight.every((s) => s.reps >= plan.targetReps);
      return { date, weight, success };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Разгрузочная неделя — каждая четвёртая от начала работы над упражнением.
 * Считаем по календарю, а не по числу тренировок: организм восстанавливается
 * во времени, и тому, кто ходит раз в неделю, разгрузка нужна не после трёх
 * занятий, а через месяц.
 */
export function isDeloadWeek(history: ProgressSet[]): boolean {
  if (history.length === 0) return false;
  const dates = history.map((s) => s.date).sort();
  const weeks = Math.floor(daysBetween(dates[0], dates[dates.length - 1]) / 7);
  return weeks > 0 && (weeks + 1) % DELOAD_EVERY_WEEKS === 0;
}

export function suggestNextWeight(history: ProgressSet[], plan: ExercisePlan): WeightSuggestion {
  const done = sessions(history, plan);
  if (done.length === 0) {
    return {
      weight_kg: null,
      change_kg: 0,
      volume_pct: FULL_VOLUME_PCT,
      reason: "Веса в записях нет — начните с того, с которым техника не рассыпается",
    };
  }

  const current = done[0].weight;
  const atCurrent = done.filter((s) => s.weight === current);

  if (isDeloadWeek(history)) {
    return {
      weight_kg: current,
      change_kg: 0,
      volume_pct: DELOAD_VOLUME_PCT,
      reason: "Разгрузочная неделя: вес прежний, подходов меньше — так растут между тренировками, а не на них",
    };
  }

  let successes = 0;
  for (const s of atCurrent) {
    if (!s.success) break;
    successes++;
  }
  if (successes >= SUCCESS_STREAK) {
    const step = stepFor(plan.joint);
    return {
      weight_kg: roundKg(current + step),
      change_kg: step,
      volume_pct: FULL_VOLUME_PCT,
      reason: `${SUCCESS_STREAK} раза подряд вышло полностью — добавляем ${step} кг`,
    };
  }

  let failures = 0;
  for (const s of atCurrent) {
    if (s.success) break;
    failures++;
  }
  if (failures >= FAIL_STREAK) {
    const dropped = roundKg(current * (1 - DROP_PCT / 100));
    return {
      weight_kg: dropped,
      change_kg: dropped - current,
      volume_pct: FULL_VOLUME_PCT,
      reason: `Дважды не добрали повторы — отступаем на ${DROP_PCT}% и заходим снова`,
    };
  }

  return {
    weight_kg: current,
    change_kg: 0,
    volume_pct: FULL_VOLUME_PCT,
    reason: "Остаёмся на прежнем весе",
  };
}
