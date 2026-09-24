/**
 * Проверка дня в зале (GIMN-028, блок D).
 *
 * Три опасности, за которыми здесь следят.
 *
 * Первая — режим Бехтерева. Упражнения зала все со снарядом, а снаряд в
 * этом режиме запрещён (GIMN-022). Проверка стоит отдельно, потому что
 * запрет держится на одной функции, и её легко обойти новым кодом.
 *
 * Вторая — снаряжение, которого нет. Жиму лёжа нужны и штанга, и скамья;
 * записать один снаряд из двух значит выдать упражнение тому, кому его
 * не на чем делать.
 *
 * Третья — уровень. Новичок не должен получить становую тягу оттого, что
 * у него оказалась штанга.
 *
 * Запуск: npm run check:gym
 */
import {
  buildGymDay,
  gymDayLetter,
  hasGymExercises,
  shouldBuildGymDay,
  GYM_DAY_A,
  GYM_DAY_B,
  missingText,
} from "@/lib/workout-engine/gym-generator";
import { equipmentAvailable, requiredEquipment, equipmentHint, NO_EQUIPMENT } from "@/lib/workout-engine/equipment";
import { exerciseSeconds, estimateMinutes } from "@/lib/workout-engine/duration";
import { applyDosage } from "@/lib/workout-engine/dosage";
import type {
  Equipment,
  ExerciseDosageRow,
  ExerciseRow,
  ExerciseSnapshot,
  ExerciseType,
  Level,
  TargetJoint,
} from "@/lib/supabase/types";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

/* ------------------------------- фикстуры -------------------------------- */

let seq = 0;

function ex(
  slug: string,
  level: Level,
  equipment: Equipment,
  extra: Equipment[] = [],
  type: ExerciseType = "main",
  joint: TargetJoint = "legs",
): ExerciseRow {
  seq += 1;
  return {
    id: `id-${seq}`,
    slug,
    name: slug,
    type,
    target_joint: joint,
    mode: "general",
    description: "",
    technique: "",
    gif_url: null,
    image_url: null,
    image_credit: null,
    duration_sec: null,
    repetitions: 8,
    level,
    contraindications: [],
    side_effects: [],
    position: "standing",
    gentle: false,
    equipment,
    equipment_extra: extra,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/** Справочник в том виде, в каком его создаёт миграция 0026. */
const CATALOG: ExerciseRow[] = [
  ex("gym-goblet-squat", "beginner", "dumbbell"),
  ex("gym-leg-press", "beginner", "machine"),
  ex("gym-barbell-squat", "intermediate", "barbell", ["squat_rack"]),
  ex("gym-leg-extension", "beginner", "machine"),
  ex("gym-leg-curl", "beginner", "machine"),
  ex("gym-calf-raise", "beginner", "machine"),
  ex("gym-kettlebell-swing", "intermediate", "kettlebell", [], "main", "hips"),
  ex("gym-romanian-deadlift", "intermediate", "barbell", [], "main", "hips"),
  ex("gym-barbell-deadlift", "advanced", "barbell", [], "main", "hips"),
  ex("gym-dumbbell-bench", "beginner", "dumbbell", ["bench"], "main", "shoulder"),
  ex("gym-bench-press", "intermediate", "barbell", ["bench"], "main", "shoulder"),
  ex("gym-dumbbell-shoulder-press", "beginner", "dumbbell", ["bench"], "main", "shoulder"),
  ex("gym-overhead-press", "intermediate", "barbell", [], "main", "shoulder"),
  ex("gym-dumbbell-row", "beginner", "dumbbell", ["bench"], "main", "shoulder"),
  ex("gym-lat-pulldown", "beginner", "cable", [], "main", "shoulder"),
  ex("gym-cable-row", "beginner", "cable", [], "main", "shoulder"),
  ex("gym-barbell-row", "intermediate", "barbell", [], "main", "shoulder"),
  ex("gym-face-pull", "beginner", "cable", [], "main", "shoulder"),
  ex("gym-farmer-carry", "beginner", "dumbbell", [], "main", "full_body"),
  // Существующие общие упражнения, на которые день зала опирается.
  ex("gen-step-touch", "beginner", "none", [], "main", "full_body"),
  ex("gen-arm-swings", "beginner", "none", [], "warmup", "shoulder"),
  ex("gen-stretch-full", "beginner", "none", [], "stretch", "full_body"),
  ex("gen-plank", "beginner", "none", [], "main", "core"),
  ex("gen-squat", "beginner", "none"),
  ex("gen-pushup", "intermediate", "none", [], "main", "shoulder"),
  ex("gen-row-band", "beginner", "resistance_band", [], "main", "shoulder"),
  ex("gen-glute-bridge", "beginner", "none", [], "main", "hips"),
];

const bySlug = new Map(CATALOG.map((e) => [e.slug, e]));
const GYM = { owned: ["barbell", "squat_rack", "bench", "dumbbell", "cable", "machine", "kettlebell"] as Equipment[], maybe: [] };
const DUMBBELLS_ONLY = { owned: ["dumbbell"] as Equipment[], maybe: [] };
const slugsOf = (day: { items: { slug: string }[] }) => day.items.map((i) => i.slug);

console.log("Режим Бехтерева не получает зала:");
{
  const gymOnly = CATALOG.filter((e) => e.slug.startsWith("gym-"));
  const leaked = gymOnly.filter((e) => equipmentAvailable(e, "behtereva", GYM));
  check("ни одно упражнение зала не проходит в режим Бехтерева", leaked.length === 0, leaked.map((e) => e.slug).join(", "));

  const inGeneral = gymOnly.filter((e) => equipmentAvailable(e, "general", GYM));
  check(
    "а в общем режиме при полном зале проходят все — значит режет режим, а не фикстура",
    inGeneral.length === gymOnly.length,
    `${inGeneral.length} из ${gymOnly.length}`,
  );

  check("день зала не собирается в режиме Бехтерева", !shouldBuildGymDay({
    mode: "behtereva",
    location: "gym",
    isRestDay: false,
    gymExercisesLoaded: true,
  }));
}

console.log("\nДва снаряда вместо одного:");
{
  const bench = bySlug.get("gym-bench-press")!;
  check("жиму лёжа нужны штанга и скамья", requiredEquipment(bench).length === 2, requiredEquipment(bench).join(", "));

  const barbellOnly = { owned: ["barbell", "squat_rack"] as Equipment[], maybe: [] };
  check(
    "со штангой без скамьи жим лёжа не выдаётся",
    !equipmentAvailable(bench, "general", barbellOnly),
  );
  check(
    "со штангой и скамьёй — выдаётся",
    equipmentAvailable(bench, "general", { owned: ["barbell", "bench"], maybe: [] }),
  );
  check(
    "приседания со штангой при этом доступны — режет именно скамья",
    equipmentAvailable(bySlug.get("gym-barbell-squat")!, "general", barbellOnly),
  );

  check("подсказка называет оба снаряда", equipmentHint(bench) === "Нужны штанга и скамья", String(equipmentHint(bench)));
  check("для одного снаряда род согласован", equipmentHint(bySlug.get("gym-barbell-row")!) === "Нужна штанга");
  check("у старых упражнений ничего не поменялось", equipmentHint(bySlug.get("gen-plank")!) === null);
}

console.log("\nЧто получает новичок:");
{
  const day = buildGymDay({ letter: "A", bySlug, access: GYM, level: "beginner" });
  const picked = slugsOf(day);

  check("день начинается с разминки", picked[0] === "gen-step-touch", picked[0]);
  check("день заканчивается растяжкой", picked[picked.length - 1] === "gen-stretch-full", picked[picked.length - 1]);

  const heavy = picked.filter((s) => ["gym-barbell-squat", "gym-bench-press", "gym-barbell-row", "gym-barbell-deadlift"].includes(s));
  check("штанги у новичка нет, даже когда она есть в зале", heavy.length === 0, heavy.join(", "));
  check("присед есть — кубковый", picked.includes("gym-goblet-squat"), picked.join(", "));
  check("жим есть — с гантелями", picked.includes("gym-dumbbell-bench"));
  check("тяга есть", picked.includes("gym-dumbbell-row"));
  check("корпус есть", picked.includes("gen-plank"));

  const mid = slugsOf(buildGymDay({ letter: "A", bySlug, access: GYM, level: "intermediate" }));
  check("на среднем уровне штанга открывается", mid.includes("gym-barbell-squat"), mid.join(", "));
  check("и жим становится штанговым", mid.includes("gym-bench-press"));

  const adv = slugsOf(buildGymDay({ letter: "B", bySlug, access: GYM, level: "advanced" }));
  check("становая появляется только на продвинутом", adv.includes("gym-barbell-deadlift"), adv.join(", "));
  const midB = slugsOf(buildGymDay({ letter: "B", bySlug, access: GYM, level: "intermediate" }));
  check("у среднего вместо неё румынская тяга", !midB.includes("gym-barbell-deadlift") && midB.includes("gym-romanian-deadlift"), midB.join(", "));
}

console.log("\nЗамена по снаряжению:");
{
  const poor = slugsOf(buildGymDay({ letter: "A", bySlug, access: DUMBBELLS_ONLY, level: "intermediate" }));
  check("без штанги присед становится кубковым", poor.includes("gym-goblet-squat"), poor.join(", "));
  check("без скамьи жим гантелей лёжа не берётся", !poor.includes("gym-dumbbell-bench"));
  check("вместо него отжимания", poor.includes("gen-pushup"));

  const withBench = slugsOf(buildGymDay({
    letter: "A",
    bySlug,
    access: { owned: ["dumbbell", "bench"], maybe: [] },
    level: "intermediate",
  }));
  check("со скамьёй жим гантелей возвращается — значит режет именно скамья", withBench.includes("gym-dumbbell-bench"), withBench.join(", "));

  const nothing = buildGymDay({ letter: "A", bySlug, access: NO_EQUIPMENT, level: "beginner" });
  check("совсем без снаряжения день всё равно собирается", nothing.items.length >= 4, String(nothing.items.length));
  check("и в нём нет ничего со снарядом", slugsOf(nothing).every((s) => requiredEquipment(bySlug.get(s)!).length === 0), slugsOf(nothing).join(", "));
}

console.log("\nЧередование A и B:");
{
  check("первая тренировка — A", gymDayLetter(0) === "A");
  check("вторая — B", gymDayLetter(1) === "B");
  check("третья снова A", gymDayLetter(2) === "A");

  const a = slugsOf(buildGymDay({ letter: "A", bySlug, access: GYM, level: "intermediate" }));
  const b = slugsOf(buildGymDay({ letter: "B", bySlug, access: GYM, level: "intermediate" }));
  check("дни различаются", a.join() !== b.join());
  check("жим в A горизонтальный, в B — над головой", a.includes("gym-bench-press") && b.includes("gym-overhead-press"));
  check("наклон есть только в B", !a.includes("gym-romanian-deadlift") && b.includes("gym-romanian-deadlift"));

  const roles = (day: readonly { role: string }[]) => day.filter((s) => s.role !== "extra").map((s) => s.role);
  check("в каждом дне четыре обязательные роли", roles(GYM_DAY_A).length === 4 && roles(GYM_DAY_B).length === 4);
  check("присед есть в обоих днях", roles(GYM_DAY_A).includes("squat") && roles(GYM_DAY_B).includes("squat"));
}

console.log("\nДлина занятия:");
{
  const day = buildGymDay({ letter: "A", bySlug, access: GYM, level: "intermediate" });
  check("основных движений не больше пяти", day.items.length - 3 <= 5, String(day.items.length - 3));
  check("и не меньше четырёх", day.items.length - 3 >= 4, String(day.items.length - 3));

  const dosage = (over: Partial<ExerciseDosageRow> = {}): ExerciseDosageRow => ({
    id: "d", exercise_id: "e", level: "beginner", mode: "general",
    duration_sec: null, repetitions: null, rest_sec: null,
    sets: 3, reps_per_set: 8, rest_between_sets_sec: 90,
    weight_pct_1rm: null, weight_kg_default: 20, notes: null,
    created_at: "2026-01-01T00:00:00Z", ...over,
  });

  const snap = (over: Partial<ExerciseSnapshot> = {}): ExerciseSnapshot => ({
    exercise_id: "e", slug: "gym-barbell-squat", name: "Приседания", type: "main",
    target_joint: "legs", description: "", technique: "", gif_url: null,
    duration_sec: null, repetitions: 8, order: 1, ...over,
  });

  const strength = applyDosage(snap(), dosage());
  check("силовое упражнение занимает около пяти минут", exerciseSeconds(strength) > 240, `${exerciseSeconds(strength)} с`);

  // Прогулка фермера — подходы на время, а не на повторы.
  const carry = applyDosage(
    snap({ slug: "gym-farmer-carry", duration_sec: 30, repetitions: null }),
    dosage({ reps_per_set: null, duration_sec: 30 }),
  );
  check("у переноса веса время сохранилось", carry.duration_sec === 30, String(carry.duration_sec));
  check("а повторов нет", carry.repetitions === null, String(carry.repetitions));
  check(
    "и время считается по секундам подхода, а не по выдуманным повторам",
    exerciseSeconds(carry) === 3 * 30 + 2 * 90 + 15,
    `${exerciseSeconds(carry)} с`,
  );

  const wholeDay = day.items.map((i, n) => applyDosage(snap({ exercise_id: `e${n}`, order: n + 1 }), dosage({ sets: 3 })));
  const minutes = estimateMinutes(wholeDay);
  check("занятие в зале укладывается в полтора часа", minutes <= 90, `${minutes} мин`);
  check("и не выглядит получасовым", minutes >= 25, `${minutes} мин`);
}

console.log("\nКогда день зала вообще собирается:");
{
  const base = { mode: "general", isRestDay: false, gymExercisesLoaded: true };
  check("в зале — да", shouldBuildGymDay({ ...base, location: "gym" }));
  check("и дома, и в зале — да", shouldBuildGymDay({ ...base, location: "home_and_gym" }));
  check("дома — нет", !shouldBuildGymDay({ ...base, location: "home" }));
  check("дома с турником — нет", !shouldBuildGymDay({ ...base, location: "home_bar" }));
  check("анкета не заполнена — нет", !shouldBuildGymDay({ ...base, location: null }));
  check("в день отдыха — нет", !shouldBuildGymDay({ ...base, location: "gym", isRestDay: true }));
  check(
    "до миграции 0026 — нет",
    !shouldBuildGymDay({ ...base, location: "gym", gymExercisesLoaded: false }),
  );
  check("справочник без упражнений зала виден", !hasGymExercises(new Map()));
  check("а с ними — виден тоже", hasGymExercises(bySlug));

  check("пустой список недостающего молчит", missingText([]) === null);
  check("непустой — говорит", (missingText(["press"]) ?? "").includes("жим"));
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
