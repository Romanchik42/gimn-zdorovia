/**
 * Проверка дозировки и расчёта времени (GIMN-028).
 *
 * Силовое упражнение считалось по гимнастической формуле «повтор = 4 с,
 * отдых 15 с», и приседания 3×8 с отдыхом 90 секунд выходили 47 секундами
 * вместо почти пяти минут. Ошибка примерно в шесть раз: подбор набирал в
 * зал тринадцать упражнений вместо пяти и обещал сорок минут там, где
 * человек проводил больше двух часов.
 *
 * Запуск: npm run check:dosage
 */
import { exerciseSeconds, estimateMinutes, isStrength } from "@/lib/workout-engine/duration";
import { exerciseCount } from "@/lib/workout-engine/custom-builder";
import { applyDosage } from "@/lib/workout-engine/dosage";
import type { ExerciseDosageRow, ExerciseSnapshot } from "@/lib/supabase/types";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function snapshot(over: Partial<ExerciseSnapshot> = {}): ExerciseSnapshot {
  return {
    exercise_id: "ex-1",
    slug: "gym-barbell-squat",
    name: "Приседания со штангой",
    type: "main",
    target_joint: "legs",
    description: "",
    technique: "",
    gif_url: null,
    duration_sec: null,
    repetitions: 8,
    order: 1,
    ...over,
  };
}

function dosage(over: Partial<ExerciseDosageRow> = {}): ExerciseDosageRow {
  return {
    id: "d-1",
    exercise_id: "ex-1",
    level: "beginner",
    mode: "general",
    duration_sec: null,
    repetitions: null,
    rest_sec: null,
    sets: null,
    reps_per_set: null,
    rest_between_sets_sec: null,
    weight_pct_1rm: null,
    weight_kg_default: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

console.log("Время силового упражнения:");
{
  // 3 подхода по 8 повторов: работа 3×8×3 = 72 с, отдых 2×90 = 180 с,
  // переход к следующему 15 с. Итого 267 с ≈ 4,5 минуты.
  const squat = snapshot({ sets: 3, reps_per_set: 8, rest_between_sets_sec: 90 });
  const sec = exerciseSeconds(squat);
  check("приседания 3×8 с отдыхом 90 с — около 4,5 минут", sec >= 240 && sec <= 300, `${sec} с`);

  const gymnasticSame = exerciseSeconds(snapshot({ repetitions: 8 }));
  check("по старой формуле было бы меньше минуты", gymnasticSame < 60, `${gymnasticSame} с`);
  check("разница примерно в шесть раз", sec / gymnasticSame > 4, `${(sec / gymnasticSame).toFixed(1)}×`);

  const noRest = exerciseSeconds(snapshot({ sets: 3, reps_per_set: 8, rest_between_sets_sec: 0 }));
  check("без отдыха между подходами время меньше", noRest < sec, `${noRest} с против ${sec} с`);

  const more = exerciseSeconds(snapshot({ sets: 5, reps_per_set: 5, rest_between_sets_sec: 180 }));
  check("5×5 с отдыхом 180 с дольше, чем 3×8 с отдыхом 90", more > sec, `${more} с против ${sec} с`);
}

console.log("\nГимнастика считается как раньше:");
{
  const held = exerciseSeconds(snapshot({ duration_sec: 30, repetitions: null }));
  check("30 секунд удержания плюс переход = 45", held === 45, `${held} с`);

  const reps = exerciseSeconds(snapshot({ repetitions: 10 }));
  check("10 повторов по 4 секунды плюс переход = 55", reps === 55, `${reps} с`);

  check("упражнение без подходов силовым не считается", !isStrength(snapshot({ repetitions: 10 })));
  check("упражнение с подходами считается силовым", isStrength(snapshot({ sets: 3 })));
}

console.log("\nСколько упражнений берём:");
{
  check("гимнастика на 45 минут — тринадцать", exerciseCount(45) === 13, String(exerciseCount(45)));
  check("зал на 45 минут — пять", exerciseCount(45, true) === 5, String(exerciseCount(45, true)));
  check("зал на 20 минут — три", exerciseCount(20, true) === 3, String(exerciseCount(20, true)));
  check("зал всегда короче списком, чем гимнастика", exerciseCount(60, true) < exerciseCount(60));
}

console.log("\nНаложение дозировки:");
{
  const strength = applyDosage(
    snapshot({ duration_sec: 40, repetitions: 12 }),
    dosage({ sets: 4, reps_per_set: 8, rest_between_sets_sec: 120, weight_kg_default: 20 }),
  );
  check("подходы проставлены", strength.sets === 4 && strength.reps_per_set === 8);
  check("стартовый вес проставлен", strength.weight_kg === 20);
  check(
    "гимнастическая длительность убрана — иначе два назначения сразу",
    strength.duration_sec === null,
    String(strength.duration_sec),
  );
  check("повторы показывают повторы в подходе", strength.repetitions === 8, String(strength.repetitions));

  const gymnastic = applyDosage(snapshot({ duration_sec: null, repetitions: 10 }), dosage({ repetitions: 15 }));
  check("без подходов остаётся круг", gymnastic.sets === undefined && gymnastic.repetitions === 15);

  const untouched = applyDosage(snapshot({ repetitions: 10 }), undefined);
  check("без строки дозировки упражнение не меняется", untouched.repetitions === 10 && !untouched.sets);
}

console.log("\nЗанятие целиком:");
{
  const gymDay = [
    snapshot({ exercise_id: "a", sets: 3, reps_per_set: 8, rest_between_sets_sec: 90 }),
    snapshot({ exercise_id: "b", sets: 3, reps_per_set: 8, rest_between_sets_sec: 90 }),
    snapshot({ exercise_id: "c", sets: 3, reps_per_set: 10, rest_between_sets_sec: 60 }),
    snapshot({ exercise_id: "d", duration_sec: 45, repetitions: null }),
  ];
  // То же занятие, посчитанное как гимнастика: подходы убраны, остались повторы.
  const asGymnastics = gymDay.map((e) => ({ ...e, sets: null, repetitions: e.reps_per_set ?? e.repetitions }));

  const minutes = estimateMinutes(gymDay);
  const wrong = estimateMinutes(asGymnastics);
  check("четыре упражнения зала занимают больше десяти минут", minutes > 10, `${minutes} мин`);
  check(
    "по гимнастической формуле то же занятие выглядело бы втрое короче",
    minutes / wrong >= 3,
    `${minutes} мин против ${wrong} мин`,
  );
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
