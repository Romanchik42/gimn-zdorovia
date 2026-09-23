/**
 * Проверка автопрогрессии (GIMN-028, блок F).
 *
 * Здесь два разных механизма, и оба опасны в одну сторону — «поднять рано».
 * Уровень открывает сплиты и тяжёлые веса, шаг штанги добавляет килограммы:
 * ошибка в любом из них приходит к человеку с больной спиной как травма,
 * а не как неверное число на экране.
 *
 * Поэтому почти к каждой проверке идёт парная, обратная: условие не просто
 * выполняется, а ломается ровно от того, от чего должно.
 *
 * Запуск: npm run check:progression
 */
import { addDays, todayIso } from "@/lib/dates";
import {
  EMPTY_METRICS,
  MAX_GAP_DAYS,
  MIN_GROWTH_PCT,
  MIN_WORKOUTS,
  STEADY_WEEKS,
  evaluateLevelUp,
  levelMetrics,
  nextLevel,
  type ProgressSet,
} from "@/lib/progression/level-check";
import {
  DELOAD_VOLUME_PCT,
  FULL_VOLUME_PCT,
  LOWER_STEP_KG,
  UPPER_STEP_KG,
  isDeloadWeek,
  stepFor,
  suggestNextWeight,
  type ExercisePlan,
  type ProgressSet as WeightSet,
} from "@/lib/progression/weight";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const TODAY = todayIso();
const ago = (days: number): string => addDays(TODAY, -days);

/** Занятия раз в N дней, начиная с самого давнего. */
function history(count: number, everyDays: number, weights: (i: number) => number | null): ProgressSet[] {
  return Array.from({ length: count }, (_, i) => ({
    date: ago((count - 1 - i) * everyDays),
    exercise_id: "squat",
    reps: 8,
    weight_kg: weights(i),
  }));
}

/** Ровно то, что нужно для повышения: 24 занятия за 13 недель, вес с 20 до 31,5. */
function eligibleHistory(): ProgressSet[] {
  return history(24, 4, (i) => 20 + i * 0.5);
}

console.log("Пороги:");
{
  // Пороги зафиксированы числами намеренно. Остальные проверки строят данные
  // от самих констант («на одну тренировку меньше порога»), и опущенный порог
  // им незаметен: сдвигается и условие, и данные. А опустить порог — ровно то
  // изменение, которое отправит человека на средний уровень раньше времени.
  check(`тренировок нужно ${MIN_WORKOUTS}`, MIN_WORKOUTS === 20, String(MIN_WORKOUTS));
  check(`роста нужно ${MIN_GROWTH_PCT}%`, MIN_GROWTH_PCT === 30, String(MIN_GROWTH_PCT));
  check(`регулярности нужно ${STEADY_WEEKS} недель`, STEADY_WEEKS === 12, String(STEADY_WEEKS));
  check(`пропуск считается с ${MAX_GAP_DAYS + 1} дней`, MAX_GAP_DAYS === 7, String(MAX_GAP_DAYS));
}

console.log("\nМетрики:");
{
  const sets = eligibleHistory();
  const m = levelMetrics(sets, TODAY);
  check("занятий столько, сколько дат", m.workouts === 24, String(m.workouts));

  const twiceADay = [...sets, { ...sets[0], exercise_id: "bench", weight_kg: 30 }];
  check(
    "два упражнения в один день — одно занятие, а не два",
    levelMetrics(twiceADay, TODAY).workouts === 24,
    String(levelMetrics(twiceADay, TODAY).workouts),
  );

  check("рост веса посчитан", m.growthPct !== null && m.growthPct > MIN_GROWTH_PCT, `${m.growthPct}%`);
  check("видно, с чего начинали", m.startWeightKg === 20, String(m.startWeightKg));

  const noWeight = levelMetrics(history(24, 4, () => null), TODAY);
  check("без веса рост не выдумывается", noWeight.growthPct === null, String(noWeight.growthPct));

  const short = levelMetrics(history(3, 4, (i) => 20 + i * 10), TODAY);
  check(
    "три занятия — ещё не тенденция, рост не засчитан",
    short.growthPct === null,
    `${short.growthPct}% за ${short.workouts} занятия`,
  );

  // Разминочные подходы легче рабочих: если считать средним, рост размоется.
  const withWarmup: ProgressSet[] = [
    { date: ago(30), exercise_id: "squat", reps: 8, weight_kg: 20 },
    { date: ago(30), exercise_id: "squat", reps: 5, weight_kg: 10 },
    { date: ago(20), exercise_id: "squat", reps: 8, weight_kg: 24 },
    { date: ago(10), exercise_id: "squat", reps: 8, weight_kg: 28 },
    { date: ago(2), exercise_id: "squat", reps: 8, weight_kg: 30 },
  ];
  check(
    "рабочий вес — самый тяжёлый подход дня, разминка его не занижает",
    levelMetrics(withWarmup, TODAY).startWeightKg === 20,
    String(levelMetrics(withWarmup, TODAY).startWeightKg),
  );
}

console.log("\nРегулярность:");
{
  const m = levelMetrics(eligibleHistory(), TODAY);
  check("двенадцать недель подряд засчитаны", m.steadyWeeks >= STEADY_WEEKS, `${m.steadyWeeks} нед.`);

  // Пропуск в середине: всё, что было до него, в серию не входит.
  const withGap = eligibleHistory().filter((s) => {
    const days = Math.round((Date.parse(TODAY) - Date.parse(s.date)) / 86_400_000);
    return days < 28 || days > 42;
  });
  const gapped = levelMetrics(withGap, TODAY);
  check(
    "пропуск в две недели обрывает серию",
    gapped.steadyWeeks < STEADY_WEEKS,
    `${gapped.steadyWeeks} нед. против ${m.steadyWeeks}`,
  );
  check(
    "при этом занятия никуда не делись — режет именно пропуск, а не их число",
    gapped.workouts >= MIN_WORKOUTS,
    `${gapped.workouts} занятий`,
  );

  // Серия, которая оборвалась месяц назад, регулярностью сегодня не является.
  const stale = eligibleHistory().map((s) => ({ ...s, date: addDays(s.date, -30) }));
  const staleM = levelMetrics(stale, TODAY);
  check("месяц без тренировок — серия обнулена", staleM.steadyWeeks === 0, `${staleM.steadyWeeks} нед.`);
  check("и это видно по дате последнего занятия", (staleM.daysSinceLast ?? 0) > 7, `${staleM.daysSinceLast} дн.`);
}

console.log("\nРешение о повышении:");
{
  const m = levelMetrics(eligibleHistory(), TODAY);
  const yes = evaluateLevelUp("beginner", m);
  check("все три условия — предлагаем средний", yes.eligible && yes.nextLevel === "intermediate", yes.reason);

  const fewWorkouts = evaluateLevelUp("beginner", { ...m, workouts: MIN_WORKOUTS - 1 });
  check("на одну тренировку меньше — не предлагаем", !fewWorkouts.eligible, fewWorkouts.reason);

  const weakGrowth = evaluateLevelUp("beginner", { ...m, growthPct: MIN_GROWTH_PCT - 1 });
  check("роста не хватило — не предлагаем", !weakGrowth.eligible, weakGrowth.reason);

  const unsteady = evaluateLevelUp("beginner", { ...m, steadyWeeks: STEADY_WEEKS - 1 });
  check("регулярности не хватило — не предлагаем", !unsteady.eligible, unsteady.reason);

  check("на пустых данных ничего не предлагаем", !evaluateLevelUp("beginner", EMPTY_METRICS).eligible);

  const mid = evaluateLevelUp("intermediate", m);
  check("со среднего на продвинутый сами не зовём", !mid.eligible, mid.reason);
  check("продвинутый — последний", nextLevel("advanced") === null);
  check("уровень идёт только вверх", nextLevel("beginner") === "intermediate");
}

console.log("\nШаг веса:");
{
  const legs: ExercisePlan = { targetReps: 8, sets: 3, joint: "legs" };
  const shoulder: ExercisePlan = { targetReps: 8, sets: 3, joint: "shoulder" };

  check("ноги растут большим шагом", stepFor("legs") === LOWER_STEP_KG);
  check("плечи — малым", stepFor("shoulder") === UPPER_STEP_KG);
  check("шаг верха меньше шага низа", UPPER_STEP_KG < LOWER_STEP_KG);

  const full = (date: string, weight: number): WeightSet[] =>
    [1, 2, 3].map((n) => ({ date, set_number: n, reps: 8, weight_kg: weight }));

  const threeGood = [...full(ago(4), 40), ...full(ago(2), 40), ...full(TODAY, 40)];
  const up = suggestNextWeight(threeGood, legs);
  check("три раза подряд вышло — добавляем 5 кг", up.weight_kg === 45 && up.change_kg === 5, up.reason);
  check("то же на плечах — 2,5 кг", suggestNextWeight(threeGood, shoulder).weight_kg === 42.5);

  const twoGood = [...full(ago(2), 40), ...full(TODAY, 40)];
  const hold = suggestNextWeight(twoGood, legs);
  check("двух раз мало — вес прежний", hold.weight_kg === 40 && hold.change_kg === 0, hold.reason);

  // Недобранный повтор — это недобранный подход, даже если вес тот же.
  const missed = [...full(ago(4), 40), ...full(ago(2), 40), ...[1, 2, 3].map((n) => ({
    date: TODAY,
    set_number: n,
    reps: n === 3 ? 5 : 8,
    weight_kg: 40,
  }))];
  const missedResult = suggestNextWeight(missed, legs);
  check("один недобранный подход отменяет прибавку", missedResult.change_kg === 0, missedResult.reason);

  const twoSetsOnly = [...full(ago(4), 40), ...full(ago(2), 40), ...[1, 2].map((n) => ({
    date: TODAY,
    set_number: n,
    reps: 8,
    weight_kg: 40,
  }))];
  check("пропущенный подход тоже отменяет прибавку", suggestNextWeight(twoSetsOnly, legs).change_kg === 0);

  const failedTwice = [
    ...full(ago(4), 40),
    ...[1, 2, 3].map((n) => ({ date: ago(2), set_number: n, reps: 5, weight_kg: 40 })),
    ...[1, 2, 3].map((n) => ({ date: TODAY, set_number: n, reps: 5, weight_kg: 40 })),
  ];
  const down = suggestNextWeight(failedTwice, legs);
  check("дважды не вышло — отступаем на 10%", down.weight_kg === 36, `${down.weight_kg} кг, ${down.reason}`);
  check("отступ именно вниз", down.change_kg < 0, String(down.change_kg));

  const onceFailed = [...full(ago(4), 40), ...full(ago(2), 40), ...[1, 2, 3].map((n) => ({
    date: TODAY,
    set_number: n,
    reps: 5,
    weight_kg: 40,
  }))];
  check(
    "один неудачный раз веса не снижает — иначе любой плохой день откатывал бы месяц",
    suggestNextWeight(onceFailed, legs).change_kg === 0,
  );

  const empty = suggestNextWeight([], legs);
  check("без записей вес не выдумывается", empty.weight_kg === null, String(empty.weight_kg));

  const bodyweight: WeightSet[] = [1, 2, 3].map((n) => ({ date: TODAY, set_number: n, reps: 8, weight_kg: null }));
  check("подтягивания без веса прогрессию не ломают", suggestNextWeight(bodyweight, legs).weight_kg === null);
}

console.log("\nРазгрузочная неделя:");
{
  const legs: ExercisePlan = { targetReps: 8, sets: 3, joint: "legs" };
  const full = (date: string, weight: number): WeightSet[] =>
    [1, 2, 3].map((n) => ({ date, set_number: n, reps: 8, weight_kg: weight }));

  const month = [...full(ago(24), 40), ...full(ago(16), 40), ...full(ago(8), 40), ...full(TODAY, 40)];
  check("четвёртая неделя — разгрузочная", isDeloadWeek(month));

  const deload = suggestNextWeight(month, legs);
  check("объём срезан", deload.volume_pct === DELOAD_VOLUME_PCT, `${deload.volume_pct}%`);
  check("вес при этом не трогаем", deload.change_kg === 0 && deload.weight_kg === 40, deload.reason);

  const firstWeek = [...full(ago(4), 40), ...full(ago(2), 40), ...full(TODAY, 40)];
  check("в первую неделю разгрузки нет", !isDeloadWeek(firstWeek));
  check(
    "и объём полный — значит режет именно разгрузка",
    suggestNextWeight(firstWeek, legs).volume_pct === FULL_VOLUME_PCT,
  );
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
