/**
 * Где сейчас находится тур (GIMN-029).
 *
 * Тур ходит по экранам, а переход между экранами в Next — это новая
 * отрисовка: состояние в React не переживёт его. Поэтому номер шага лежит
 * в sessionStorage: он живёт ровно столько, сколько открыта вкладка, и
 * исчезает сам, когда человек закрыл приложение на середине тура.
 *
 * В базе хранится только факт «тур пройден» — он должен пережить смену
 * устройства. Номер шага там не нужен: возвращаться к брошенному туру
 * через неделю никто не захочет.
 */

const KEY = "gz-tour-step";

/** Номер текущего шага или null, если тур не идёт. */
export function readStep(): number | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    // Хранилище может быть закрыто политикой браузера. Тогда тур просто
    // не переживёт переход между экранами — это лучше, чем падение.
    return null;
  }
}

export function writeStep(index: number): void {
  try {
    sessionStorage.setItem(KEY, String(index));
  } catch {
    // см. readStep
  }
}

export function clearStep(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // см. readStep
  }
}

/**
 * Приглушение кнопки «Начать» на время тура.
 *
 * Отметка ставится на <body>, а не передаётся пропсами: кнопка живёт в
 * карточке дня, тур — в другом углу дерева, и тащить состояние через
 * половину приложения ради непрозрачности не стоит. Гасит её CSS.
 */
export function setStartMuted(muted: boolean): void {
  if (typeof document === "undefined") return;
  if (muted) document.body.dataset.tour = "running";
  else delete document.body.dataset.tour;
}
