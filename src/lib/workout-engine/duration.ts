/**
 * Оценка длительности занятия. Общая для сервера и клиента: конструктор
 * пересчитывает время на лету, пока пользователь двигает и правит упражнения.
 */

/** Стандартная пауза между упражнениями, если отдых не задан явно. */
export const DEFAULT_REST_SEC = 15;

/** Средний темп гимнастики: ~4 секунды на повтор. */
export const SEC_PER_REP = 4;

/**
 * Темп силового повтора (GIMN-028): ~3 секунды с учётом опускания веса.
 * Меньше, чем у гимнастики: там повтор часто с фиксацией и растяжением.
 */
export const SEC_PER_STRENGTH_REP = 3;

/** Отдых между подходами, если дозировка его не задала. */
export const DEFAULT_SET_REST_SEC = 90;

type Dosed = {
  duration_sec: number | null;
  repetitions: number | null;
  rest_sec?: number | null;
  /** Подходы (0023). Есть — считаем как силовое. */
  sets?: number | null;
  reps_per_set?: number | null;
  rest_between_sets_sec?: number | null;
};

/**
 * Сколько занимает одно упражнение.
 *
 * Силовое считается иначе, и разница огромна: приседания 3×8 с отдыхом
 * 90 секунд — это около пяти минут, а по гимнастической формуле выходило
 * 47 секунд, то есть в шесть раз меньше. На такой арифметике подбор
 * набирал в зал 13 упражнений вместо пяти и обещал сорок минут там, где
 * человек проводил больше двух часов.
 *
 * Отдых считается между подходами, а не после последнего: после него идёт
 * переход к следующему упражнению, он уже учтён отдельно.
 */
export function exerciseSeconds(e: Dosed): number {
  if (e.sets && e.sets > 0) {
    const reps = e.reps_per_set ?? e.repetitions ?? 8;
    const work = e.sets * reps * SEC_PER_STRENGTH_REP;
    const rest = (e.sets - 1) * (e.rest_between_sets_sec ?? DEFAULT_SET_REST_SEC);
    return work + rest + (e.rest_sec ?? DEFAULT_REST_SEC);
  }

  const own = e.duration_sec ?? (e.repetitions ?? 0) * SEC_PER_REP;
  return own + (e.rest_sec ?? DEFAULT_REST_SEC);
}

/** Время + отдых по всем упражнениям, в минутах (не меньше 1). */
export function estimateMinutes(exercises: Dosed[]): number {
  const seconds = exercises.reduce((total, e) => total + exerciseSeconds(e), 0);
  return Math.max(1, Math.round(seconds / 60));
}

/** Силовое ли это упражнение — по наличию подходов в дозировке. */
export function isStrength(e: Pick<Dosed, "sets">): boolean {
  return Boolean(e.sets && e.sets > 0);
}
