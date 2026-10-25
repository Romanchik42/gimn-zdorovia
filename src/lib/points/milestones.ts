/**
 * Достижения за тренировки: серия дней подряд и круглое число тренировок.
 *
 * Чистые функции без базы — их держит под проверкой check:points. Обещание
 * висит в разделе «Баллы» («30 дней тренировок подряд», «100 тренировок
 * всего»), и до этого модуля его никто не выполнял.
 */

import { addDays, todayIso } from "@/lib/dates";

export const STREAK_TARGET_DAYS = 30;
export const WORKOUTS_TARGET = 100;

/**
 * Серия дней подряд, заканчивающаяся сегодня.
 *
 * Дни — строки YYYY-MM-DD в поясе приложения. Возвращает длину серии и её
 * первый день: по первому дню начисление отличает одну серию от другой —
 * после перерыва новая серия заслуживает новых баллов, а та же самая нет.
 */
export function currentStreak(days: string[], today: string): { length: number; startedOn: string | null } {
  const set = new Set(days);
  if (!set.has(today)) return { length: 0, startedOn: null };

  let length = 0;
  let day = today;
  while (set.has(day)) {
    length += 1;
    day = addDays(day, -1);
  }
  return { length, startedOn: addDays(today, -(length - 1)) };
}

/** День завершения тренировки в поясе приложения. */
export function completionDay(completedAt: string): string {
  return todayIso(new Date(completedAt));
}
