/**
 * Календарь приложения.
 *
 * Серверы Vercel живут в UTC, а пользователи — в России. Если брать «сегодня»
 * как new Date().toISOString(), то с 00:00 до 03:00 по Москве (а на Дальнем
 * Востоке — до полудня) приложение показывало бы вчерашнюю тренировку и меню.
 * Поэтому «сегодня» считается в часовом поясе приложения, а вся календарная
 * арифметика идёт по строкам YYYY-MM-DD через UTC — без влияния пояса сервера.
 *
 * Часового пояса пользователя в профиле пока нет, поэтому MVP живёт по Москве.
 */

export const APP_TIMEZONE = "Europe/Moscow";

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Сегодняшняя дата в поясе приложения, YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return dayFormatter.format(now);
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

/** День недели: понедельник = 1 … воскресенье = 7. */
export function dayOfWeek(iso: string): number {
  const js = parse(iso).getUTCDay();
  return js === 0 ? 7 : js;
}

/** Понедельник недели, в которую попадает дата. */
export function weekStartOf(iso: string): string {
  return addDays(iso, 1 - dayOfWeek(iso));
}

export function datesFrom(startIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(startIso, i));
}

/** Разница в днях между датами (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Минуты от полуночи по времени приложения: 07:30 → 450. */
export function nowMinutes(now: Date = new Date()): number {
  const [h, m] = timeFormatter.format(now).split(":").map(Number);
  return h * 60 + m;
}

/** «07:30» или «07:30:00» (как TIME из Postgres) → 450. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Начало сегодняшнего дня приложения в ISO (для фильтров по timestamptz).
 * У Москвы с 2014 года фиксированный сдвиг +03:00 без перехода на летнее время.
 */
export function startOfTodayUtcIso(now: Date = new Date()): string {
  return new Date(`${todayIso(now)}T00:00:00+03:00`).toISOString();
}
