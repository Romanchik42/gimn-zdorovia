/**
 * Оценка длительности занятия. Общая для сервера и клиента: конструктор
 * пересчитывает время на лету, пока пользователь двигает и правит упражнения.
 */

/** Стандартная пауза между упражнениями, если отдых не задан явно. */
export const DEFAULT_REST_SEC = 15;

/** Средний темп: ~4 секунды на повтор. */
export const SEC_PER_REP = 4;

type Dosed = {
  duration_sec: number | null;
  repetitions: number | null;
  rest_sec?: number | null;
};

export function exerciseSeconds(e: Dosed): number {
  const own = e.duration_sec ?? (e.repetitions ?? 0) * SEC_PER_REP;
  return own + (e.rest_sec ?? DEFAULT_REST_SEC);
}

/** Время + отдых по всем упражнениям, в минутах (не меньше 1). */
export function estimateMinutes(exercises: Dosed[]): number {
  const seconds = exercises.reduce((total, e) => total + exerciseSeconds(e), 0);
  return Math.max(1, Math.round(seconds / 60));
}
