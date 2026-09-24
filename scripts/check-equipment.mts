/**
 * Проверка разделения режимов по снаряду (GIMN-022, расширена в GIMN-028).
 *
 * Правило: снаряд — принадлежность общего режима. Режим Бехтерева не получает
 * упражнений со снарядом ни при каком снаряжении и ни при каком месте занятий,
 * даже если общий режим у того же человека заполнен и там отмечен весь зал:
 * режимов бывает два сразу, и ответ одного на другой не распространяется.
 *
 * Раньше файл назывался check-turnik.mts и знал только про турник. Снарядов
 * стало одиннадцать, и проверка переименована вместе с охватом.
 *
 * Запуск: npm run check:equipment
 */
import { buildWorkout, fitPlanWorkout } from "@/lib/workout-engine/generator";
import { buildCustomWorkout } from "@/lib/workout-engine/custom-builder";
import {
  EQUIPMENT_BY_LOCATION,
  EQUIPMENT_VALUES,
  NO_EQUIPMENT,
  accessFromProfile,
  equipmentAvailable,
  type EquipmentAccess,
} from "@/lib/workout-engine/equipment";
import type {
  Equipment,
  ExerciseRow,
  ExerciseSnapshot,
  ExerciseType,
  HasTurnik,
  Level,
  Mode,
  SequenceItem,
  TargetJoint,
  TrainingLocation,
} from "@/lib/supabase/types";

/* ------------------------------- фикстуры -------------------------------- */

let seq = 0;

function ex(
  slug: string,
  type: ExerciseType,
  joint: TargetJoint,
  mode: Mode | "both",
  level: Level,
  equipment: Equipment = "none",
  equipmentExtra: Equipment[] = [],
): ExerciseRow {
  seq += 1;
  return {
    id: `id-${seq}`,
    slug,
    name: slug,
    type,
    target_joint: joint,
    mode,
    description: "",
    technique: "",
    gif_url: null,
    equipment_extra: equipmentExtra,
    image_url: null,
    image_credit: null,
    duration_sec: type === "main" ? null : 30,
    repetitions: type === "main" ? 10 : null,
    level,
    contraindications: [],
    side_effects: [],
    position: "standing",
    gentle: mode === "behtereva",
    equipment,
    created_at: "2026-01-01T00:00:00Z",
  };
}

/** Турник и брусья — как в сидах 0017. */
const BAR_POOL: ExerciseRow[] = [
  ex("bar-dead-hang", "stretch", "spine", "general", "beginner", "pullup_bar"),
  ex("bar-hang-posture", "stretch", "spine", "general", "beginner", "pullup_bar"),
  ex("bar-active-hang", "main", "shoulder", "general", "beginner", "pullup_bar"),
  ex("bar-shrug", "main", "shoulder", "general", "beginner", "pullup_bar"),
  ex("bar-knee-raise", "main", "core", "general", "beginner", "pullup_bar"),
  ex("dip-support-hold", "main", "core", "general", "beginner", "dip_bars"),
  ex("dip-pushup", "main", "shoulder", "general", "intermediate", "dip_bars"),
];

/** Зал — по одному упражнению на каждый новый снаряд (0021, 0023). */
const GYM_POOL: ExerciseRow[] = [
  ex("gym-goblet-squat", "main", "legs", "general", "beginner", "dumbbell"),
  ex("gym-barbell-squat", "main", "legs", "general", "beginner", "barbell"),
  ex("gym-dumbbell-bench", "main", "shoulder", "general", "beginner", "bench"),
  ex("gym-kettlebell-swing", "main", "hips", "general", "beginner", "kettlebell"),
  ex("gym-band-row", "main", "spine", "general", "beginner", "resistance_band"),
  ex("gym-lat-pulldown", "main", "spine", "general", "beginner", "cable"),
  ex("gym-leg-press", "main", "legs", "general", "beginner", "machine"),
  ex("gym-rack-squat", "main", "legs", "general", "beginner", "squat_rack"),
];

/**
 * Обычные упражнения обоих режимов. Своих у Бехтерева намеренно мало —
 * так добор до длительности доходит до запаса из соседнего режима, то есть
 * ровно до того места, где снаряд и протекал.
 */
const PLAIN_POOL: ExerciseRow[] = [
  ex("breath-belly", "breathing", "full_body", "both", "beginner"),
  ex("beh-cat-camel", "warmup", "spine", "behtereva", "beginner"),
  ex("beh-shoulder-rolls", "warmup", "shoulder", "behtereva", "beginner"),
  ex("beh-bridge", "main", "spine", "behtereva", "beginner"),
  ex("beh-stretch-spine", "stretch", "spine", "behtereva", "beginner"),
  ex("gen-squat", "main", "legs", "general", "beginner"),
  ex("gen-pushup", "main", "shoulder", "general", "beginner"),
  ex("gen-plank", "main", "core", "general", "beginner"),
  ex("gen-stretch-back", "stretch", "spine", "general", "beginner"),
  ex("gen-neck-tilts", "warmup", "neck", "general", "beginner"),
];

const POOL = [...PLAIN_POOL, ...BAR_POOL, ...GYM_POOL];
const BY_SLUG = new Map(POOL.map((e) => [e.slug, e]));
const WITH_EQUIPMENT = new Set(POOL.filter((e) => e.equipment !== "none").map((e) => e.slug));

const usesEquipment = (slug: string) => WITH_EQUIPMENT.has(slug);
const equipIn = (list: { slug: string }[]) => list.filter((e) => usesEquipment(e.slug)).map((e) => e.slug);

/** Всё снаряжение как своё — самый неблагоприятный случай для Бехтерева. */
const ALL_OWNED: EquipmentAccess = { owned: EQUIPMENT_VALUES, maybe: [] };

/* -------------------------------- проверки -------------------------------- */

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function planWorkout(
  mode: Mode,
  access: EquipmentAccess,
  targetMin = 45,
  equipmentInTemplate = true,
): ExerciseSnapshot[] {
  const items: SequenceItem[] = [
    { order: 1, slug: "breath-belly", duration_sec: 60 },
    { order: 2, slug: mode === "behtereva" ? "beh-cat-camel" : "gen-neck-tilts", duration_sec: 40 },
  ];
  // Настоящие шаблоны упражнений со снарядом не содержат, но подбор обязан
  // отсекать и их — поэтому по умолчанию одно такое в шаблоне есть.
  if (equipmentInTemplate) items.push({ order: 3, slug: "bar-dead-hang", duration_sec: 30 });

  const built = buildWorkout({ items, exercisesBySlug: BY_SLUG, mode, intensity: "medium", access });

  return fitPlanWorkout(built.exercises, {
    pool: POOL,
    mode,
    focus: "spine",
    targetMin,
    intensity: "medium",
    difficulty: "beginner",
    isRestDay: false,
    access,
  });
}

function customWorkout(mode: Mode, access: EquipmentAccess, focus: string): ExerciseSnapshot[] {
  return buildCustomWorkout({
    pool: POOL,
    mode,
    focus,
    durationMin: 40,
    intensity: "medium",
    difficulty: "beginner",
    userContraindications: [],
    access,
  }).exercises;
}

/** Каталог фильтрует тем же предикатом (catalog.ts) — проверяем предикат. */
function catalogFor(mode: Mode, access: EquipmentAccess): ExerciseRow[] {
  return POOL.filter((e) => equipmentAvailable(e, mode, access));
}

const LOCATIONS: TrainingLocation[] = ["home", "home_bar", "gym", "home_and_gym"];

console.log("Режим Бехтерева — снаряда нет ни при каком месте занятий:");
for (const location of LOCATIONS) {
  const access: EquipmentAccess = { owned: EQUIPMENT_BY_LOCATION[location], maybe: [] };

  const day = planWorkout("behtereva", access);
  check(`занятие дня, место '${location}'`, equipIn(day).length === 0, equipIn(day).join(", "));

  const catalog = catalogFor("behtereva", access);
  check(`каталог, место '${location}'`, equipIn(catalog).length === 0, equipIn(catalog).join(", "));

  const custom = customWorkout("behtereva", access, "legs");
  check(`конструктор, место '${location}'`, equipIn(custom).length === 0, equipIn(custom).join(", "));
}

console.log("\nРежим Бехтерева — даже когда отмечено всё снаряжение сразу:");
{
  const day = planWorkout("behtereva", ALL_OWNED);
  check("занятие дня", equipIn(day).length === 0, equipIn(day).join(", "));
  check("каталог", equipIn(catalogFor("behtereva", ALL_OWNED)).length === 0);
  for (const focus of ["shoulder", "spine", "core", "legs"]) {
    const custom = customWorkout("behtereva", ALL_OWNED, focus);
    check(`конструктор, фокус '${focus}'`, equipIn(custom).length === 0, equipIn(custom).join(", "));
  }
}

console.log("\nОбщий режим — берётся только отмеченное:");
for (const item of EQUIPMENT_VALUES) {
  const access: EquipmentAccess = { owned: [item], maybe: [] };
  const catalog = catalogFor("general", access);
  const shown = catalog.filter((e) => usesEquipment(e.slug));
  const wrong = shown.filter((e) => e.equipment !== item).map((e) => e.slug);
  check(`каталог с одним снарядом '${item}' — чужого нет`, wrong.length === 0, wrong.join(", "));
}

console.log("\nОбщий режим — без снаряжения не берётся ничего:");
{
  const day = planWorkout("general", NO_EQUIPMENT);
  check("занятие дня пустого профиля", equipIn(day).length === 0, equipIn(day).join(", "));
  check("каталог пустого профиля", equipIn(catalogFor("general", NO_EQUIPMENT)).length === 0);
}

console.log("\nСовместимость со старой анкетой про турник:");
{
  const yes = accessFromProfile({ has_turnik: "yes" as HasTurnik });
  check("'да' даёт турник и брусья", yes.owned.includes("pullup_bar") && yes.owned.includes("dip_bars"));
  check("'да' не даёт штангу", !yes.owned.includes("barbell"));

  const no = accessFromProfile({ has_turnik: "no" as HasTurnik });
  check("'нет' не даёт ничего", no.owned.length === 0 && no.maybe.length === 0);

  const maybe = accessFromProfile({ has_turnik: "maybe" as HasTurnik });
  check("'могу найти' уходит в maybe", maybe.owned.length === 0 && maybe.maybe.includes("pullup_bar"));

  // Чек-лист и вопрос про турник спрашивают про разное, поэтому складываются.
  const listed = accessFromProfile({ has_turnik: "no" as HasTurnik, gym_equipment: ["barbell", "bench"] });
  check(
    "чек-лист без турника даёт только зал",
    listed.owned.includes("barbell") && !listed.owned.includes("pullup_bar"),
    listed.owned.join(", "),
  );

  const both = accessFromProfile({ has_turnik: "yes" as HasTurnik, gym_equipment: ["barbell"] });
  check(
    "чек-лист и турник складываются",
    both.owned.includes("barbell") && both.owned.includes("pullup_bar") && both.owned.includes("dip_bars"),
    both.owned.join(", "),
  );

  const gymPlusMaybe = accessFromProfile({ has_turnik: "maybe" as HasTurnik, gym_equipment: ["barbell"] });
  check(
    "'могу найти' не мешает залу: штанга своя, турник — под вопросом",
    gymPlusMaybe.owned.includes("barbell") && gymPlusMaybe.maybe.includes("pullup_bar"),
    `owned=${gymPlusMaybe.owned.join(",")} maybe=${gymPlusMaybe.maybe.join(",")}`,
  );

  const barsInList = accessFromProfile({ has_turnik: "no" as HasTurnik, gym_equipment: ["pullup_bar"] });
  check(
    "турник из чек-листа игнорируется — за него отвечает свой вопрос",
    !barsInList.owned.includes("pullup_bar"),
    barsInList.owned.join(", "),
  );

  const dirty = accessFromProfile({ gym_equipment: ["barbell", "чужое", 42, null] });
  check("чужие значения отброшены", dirty.owned.length === 1 && dirty.owned[0] === "barbell");
}

console.log("\n«Могу найти» — добирается последним и помечается:");
{
  const maybeAccess: EquipmentAccess = { owned: [], maybe: ["pullup_bar", "dip_bars"] };

  const long = planWorkout("general", maybeAccess, 45, false);
  const marked = long.filter((e) => usesEquipment(e.slug));
  check(
    "на 45 мин добрано и помечено необязательным",
    marked.length > 0 && marked.every((e) => e.optional === true && Boolean(e.warning)),
    marked.map((e) => `${e.slug}:optional=${e.optional}`).join(", "),
  );

  const short = planWorkout("general", maybeAccess, 12, false);
  check("на 12 мин обошлось без него", equipIn(short).length === 0, equipIn(short).join(", "));

  const owned: EquipmentAccess = { owned: ["pullup_bar", "dip_bars"], maybe: [] };
  const shortOwned = planWorkout("general", owned, 12, false);
  check(
    "при 'есть' на той же длительности берётся наравне — значит откладывает именно 'могу найти'",
    equipIn(shortOwned).length > 0,
  );
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
