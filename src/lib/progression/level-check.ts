import { daysBetween } from "@/lib/dates";
import { LEVEL_RANK } from "@/lib/workout-engine/custom-builder";
import type { Level } from "@/lib/supabase/types";

/**
 * Готов ли человек к следующему уровню (GIMN-028, блок F).
 *
 * Уровень поднимается только вверх и только с согласия человека. Понизить
 * его автоматически нельзя: плохая неделя бывает от недосыпа, отпуска или
 * обострения, и отобрать за неё уже освоенное — значит наказать за болезнь.
 * Если нагрузка стала тяжёлой, человек сам меняет уровень в настройках.
 *
 * Считаем по трём условиям сразу, и каждое закрывает свою дыру:
 *   объём     — без него достаточно одной удачной тренировки;
 *   сила      — без неё хватило бы двадцати раз с пустым грифом;
 *   регулярность — без неё двадцать тренировок можно набрать за месяц
 *                  рывком и получить средний уровень на нетренированном теле.
 *
 * Следующий уровень предлагается только новичку. Переход со среднего на
 * продвинутый приложение не считает: там появляется работа с околопредельными
 * весами, и решение про неё принимает не программа, а тренер или врач.
 */

export const MIN_WORKOUTS = 20;
export const MIN_GROWTH_PCT = 30;
export const STEADY_WEEKS = 12;
/** Пропуск больше недели рвёт серию: это уже не регулярность, а возвращение. */
export const MAX_GAP_DAYS = 7;
/** Сколько занятий с упражнением нужно, чтобы рост веса не был случайностью. */
const MIN_SESSIONS_PER_EXERCISE = 4;

export type ProgressSet = {
  date: string;
  exercise_id: string;
  reps: number;
  weight_kg: number | null;
};

export type LevelMetrics = {
  /** Занятий с записанными подходами — по одному на дату. */
  workouts: number;
  /** Рост рабочего веса в процентах в лучшем упражнении. null — не с чем сравнить. */
  growthPct: number | null;
  /** Упражнение, по которому считали рост, и его веса — для текста предложения. */
  growthExerciseId: string | null;
  startWeightKg: number | null;
  currentWeightKg: number | null;
  /** Недель подряд без пропусков больше недели. */
  steadyWeeks: number;
  /** Дней с последнего занятия. */
  daysSinceLast: number | null;
};

export type LevelUpCheck = {
  eligible: boolean;
  currentLevel: Level;
  nextLevel: Level | null;
  reason: string;
  metrics: LevelMetrics;
};

export const EMPTY_METRICS: LevelMetrics = {
  workouts: 0,
  growthPct: null,
  growthExerciseId: null,
  startWeightKg: null,
  currentWeightKg: null,
  steadyWeeks: 0,
  daysSinceLast: null,
};

const ORDER: Level[] = ["beginner", "intermediate", "advanced"];

/** Следующий уровень по порядку. У последнего следующего нет. */
export function nextLevel(level: Level): Level | null {
  return ORDER[LEVEL_RANK[level]] ?? null;
}

/** Даты занятий по убыванию, без повторов: в один день — одно занятие. */
function sessionDates(sets: ProgressSet[]): string[] {
  return [...new Set(sets.map((s) => s.date))].sort((a, b) => b.localeCompare(a));
}

/**
 * Рабочий вес занятия — самый тяжёлый подход дня. Разминочные подходы легче
 * рабочих, и среднее по дню размыло бы рост первой же разминкой.
 */
function workingWeightByDate(sets: ProgressSet[]): Map<string, number> {
  const byDate = new Map<string, number>();
  for (const set of sets) {
    if (set.weight_kg == null || set.weight_kg <= 0 || set.reps <= 0) continue;
    byDate.set(set.date, Math.max(byDate.get(set.date) ?? 0, set.weight_kg));
  }
  return byDate;
}

/**
 * Рост веса в одном упражнении: от первого занятия к лучшему из трёх
 * последних. Сравнивать с единственным последним занятием нельзя — один
 * удачный день не рост, а один неудачный обнулил бы месяц работы.
 */
function growthOf(sets: ProgressSet[]): { pct: number; start: number; current: number } | null {
  const byDate = workingWeightByDate(sets);
  if (byDate.size < MIN_SESSIONS_PER_EXERCISE) return null;

  const dates = [...byDate.keys()].sort();
  const start = byDate.get(dates[0]);
  if (!start) return null;

  const recent = dates.slice(-3).map((d) => byDate.get(d) ?? 0);
  const current = Math.max(...recent);
  return { pct: ((current - start) / start) * 100, start, current };
}

/**
 * Недель подряд без пропуска дольше MAX_GAP_DAYS. Считаем от последнего
 * занятия назад: серия, которая оборвалась полгода назад, регулярностью
 * сегодня не является.
 */
function steadyWeeksOf(datesDesc: string[], today: string): { weeks: number; daysSinceLast: number | null } {
  if (datesDesc.length === 0) return { weeks: 0, daysSinceLast: null };

  const daysSinceLast = daysBetween(datesDesc[0], today);
  if (daysSinceLast > MAX_GAP_DAYS) return { weeks: 0, daysSinceLast };

  let oldest = datesDesc[0];
  for (let i = 1; i < datesDesc.length; i++) {
    if (daysBetween(datesDesc[i], oldest) > MAX_GAP_DAYS) break;
    oldest = datesDesc[i];
  }

  return { weeks: Math.floor(daysBetween(oldest, datesDesc[0]) / 7), daysSinceLast };
}

/** Метрики по записанным подходам. Чистая функция — её и проверяет check:progression. */
export function levelMetrics(sets: ProgressSet[], today: string): LevelMetrics {
  const datesDesc = sessionDates(sets);
  const { weeks, daysSinceLast } = steadyWeeksOf(datesDesc, today);

  const byExercise = new Map<string, ProgressSet[]>();
  for (const set of sets) {
    const list = byExercise.get(set.exercise_id);
    if (list) list.push(set);
    else byExercise.set(set.exercise_id, [set]);
  }

  let best: { id: string; pct: number; start: number; current: number } | null = null;
  for (const [id, exerciseSets] of byExercise) {
    const growth = growthOf(exerciseSets);
    if (growth && (!best || growth.pct > best.pct)) best = { id, ...growth };
  }

  return {
    workouts: datesDesc.length,
    growthPct: best ? Math.round(best.pct) : null,
    growthExerciseId: best?.id ?? null,
    startWeightKg: best?.start ?? null,
    currentWeightKg: best?.current ?? null,
    steadyWeeks: weeks,
    daysSinceLast,
  };
}

/**
 * Решение по метрикам. Отдельно от загрузки данных, чтобы условия можно
 * было проверить без базы.
 */
export function evaluateLevelUp(level: Level, metrics: LevelMetrics): LevelUpCheck {
  const next = nextLevel(level);
  const base = { currentLevel: level, nextLevel: next, metrics };

  if (level !== "beginner") {
    return {
      ...base,
      eligible: false,
      reason:
        next === null
          ? "Уровень уже максимальный"
          : "Переход на продвинутый уровень приложение не предлагает: такие веса согласуют с тренером или врачом",
    };
  }

  if (metrics.workouts < MIN_WORKOUTS) {
    return { ...base, eligible: false, reason: `Тренировок ${metrics.workouts} из ${MIN_WORKOUTS}` };
  }
  if (metrics.growthPct === null || metrics.growthPct < MIN_GROWTH_PCT) {
    return {
      ...base,
      eligible: false,
      reason:
        metrics.growthPct === null
          ? "Рабочий вес ещё не с чем сравнить"
          : `Рост веса ${metrics.growthPct}% из ${MIN_GROWTH_PCT}%`,
    };
  }
  if (metrics.steadyWeeks < STEADY_WEEKS) {
    return { ...base, eligible: false, reason: `Регулярность ${metrics.steadyWeeks} недель из ${STEADY_WEEKS}` };
  }

  return { ...base, eligible: true, reason: "Все три условия выполнены" };
}
