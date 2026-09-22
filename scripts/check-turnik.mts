/**
 * Проверка разделения режимов по снаряду (GIMN-022).
 *
 * Правило: турник и брусья — принадлежность общего режима. Режим Бехтерева
 * не получает турниковых упражнений ни при каком ответе анкеты, даже если
 * общий режим у того же человека заполнен и там стоит «да»: режимов бывает
 * два сразу, и ответ одного на другой не распространяется.
 *
 * Тестового раннера в проекте нет, поэтому проверка запускается как обычный
 * скрипт и падает ненулевым кодом:
 *   node --import ./scripts/lib/ts-resolve-hook.mjs scripts/check-turnik.mts
 *
 * Пул здесь синтетический, но турниковые строки в нём настоящие: тип, уровень
 * и зона скопированы из сидов 0017. Важен прежде всего «Мёртвый вис»
 * (stretch, beginner, general) — он проходил в занятие Бехтерева через добор
 * из соседнего режима, где силовое отсекается по типу, а растяжка нет.
 */
import { buildWorkout, fitPlanWorkout } from "@/lib/workout-engine/generator";
import { buildCustomWorkout } from "@/lib/workout-engine/custom-builder";
import { equipmentAvailable } from "@/lib/workout-engine/equipment";
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

/** Турниковые строки — как в сидах 0017. */
const BAR_POOL: ExerciseRow[] = [
  ex("bar-dead-hang", "stretch", "spine", "general", "beginner", "pullup_bar"),
  ex("bar-hang-posture", "stretch", "spine", "general", "beginner", "pullup_bar"),
  ex("bar-active-hang", "main", "shoulder", "general", "beginner", "pullup_bar"),
  ex("bar-shrug", "main", "shoulder", "general", "beginner", "pullup_bar"),
  ex("bar-knee-raise", "main", "core", "general", "beginner", "pullup_bar"),
  ex("bar-pullup-overhand", "main", "shoulder", "general", "intermediate", "pullup_bar"),
  ex("dip-support-hold", "main", "core", "general", "beginner", "dip_bars"),
  ex("dip-pushup", "main", "shoulder", "general", "intermediate", "dip_bars"),
];

/**
 * Обычные упражнения обоих режимов. Своих у Бехтерева намеренно мало —
 * так добор до длительности доходит до запаса из соседнего режима, то есть
 * ровно до того места, где турниковые и протекали.
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

const POOL = [...PLAIN_POOL, ...BAR_POOL];
const BY_SLUG = new Map(POOL.map((e) => [e.slug, e]));

const isBar = (slug: string) => slug.startsWith("bar-") || slug.startsWith("dip-");
const barsIn = (list: { slug: string }[]) => list.filter((e) => isBar(e.slug)).map((e) => e.slug);

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

/**
 * Занятие дня: шаблон плюс добор до длительности. Протекал именно добор.
 *
 * `barInTemplate` — турниковое прямо в шаблоне последовательности. Настоящие
 * шаблоны таких не содержат, но подбор обязан отсекать и их, поэтому по
 * умолчанию оно там есть. Для проверок очерёдности добора шаблон берётся
 * чистый: упражнение из шаблона в очередь добора не попадает, оно уже в занятии.
 */
function planWorkout(
  mode: Mode,
  hasTurnik: HasTurnik,
  targetMin = 45,
  barInTemplate = true,
): ExerciseSnapshot[] {
  const items: SequenceItem[] = [
    { order: 1, slug: "breath-belly", duration_sec: 60 },
    {
      order: 2,
      slug: mode === "behtereva" ? "beh-cat-camel" : "gen-neck-tilts",
      duration_sec: 40,
    },
  ];
  if (barInTemplate) {
    items.push({ order: 3, slug: "bar-dead-hang", duration_sec: 30 });
  }

  const built = buildWorkout({
    items,
    exercisesBySlug: BY_SLUG,
    mode,
    intensity: "medium",
    hasTurnik,
  });

  return fitPlanWorkout(built.exercises, {
    pool: POOL,
    mode,
    focus: "spine",
    targetMin,
    intensity: "medium",
    difficulty: "beginner",
    isRestDay: false,
    hasTurnik,
  });
}

function customWorkout(mode: Mode, hasTurnik: HasTurnik, focus: string): ExerciseSnapshot[] {
  return buildCustomWorkout({
    pool: POOL,
    mode,
    focus,
    durationMin: 40,
    intensity: "medium",
    difficulty: "beginner",
    userContraindications: [],
    hasTurnik,
  }).exercises;
}

/** Каталог фильтрует тем же предикатом (catalog.ts) — проверяем предикат. */
function catalogFor(mode: Mode, hasTurnik: HasTurnik): ExerciseRow[] {
  return POOL.filter((e) => equipmentAvailable(e.equipment, mode, hasTurnik));
}

console.log("Режим Бехтерева — турника нет ни при каком ответе:");
for (const answer of ["yes", "no", "maybe"] as HasTurnik[]) {
  const day = planWorkout("behtereva", answer);
  check(`занятие дня, has_turnik='${answer}'`, barsIn(day).length === 0, barsIn(day).join(", "));

  const catalog = catalogFor("behtereva", answer);
  check(`каталог, has_turnik='${answer}'`, barsIn(catalog).length === 0, barsIn(catalog).join(", "));

  for (const focus of ["shoulder", "spine", "core"]) {
    const custom = customWorkout("behtereva", answer, focus);
    check(
      `конструктор, фокус '${focus}', has_turnik='${answer}'`,
      barsIn(custom).length === 0,
      barsIn(custom).join(", "),
    );
  }
}

console.log("\nОбщий режим — турник по ответу анкеты:");

const generalYes = planWorkout("general", "yes");
check("занятие дня, has_turnik='yes' — турниковые есть", barsIn(generalYes).length > 0);

const generalNo = planWorkout("general", "no");
check(
  "занятие дня, has_turnik='no' — турниковых нет",
  barsIn(generalNo).length === 0,
  barsIn(generalNo).join(", "),
);

check(
  "каталог, has_turnik='yes' — турниковые есть все",
  barsIn(catalogFor("general", "yes")).length === BAR_POOL.length,
);
check("каталог, has_turnik='no' — турниковых нет", barsIn(catalogFor("general", "no")).length === 0);

check(
  "конструктор, фокус 'shoulder', has_turnik='yes' — турниковые есть",
  barsIn(customWorkout("general", "yes", "shoulder")).length > 0,
);

/*
 * «Могу найти» — не «есть». Обещание кода: турниковые уходят в конец очереди
 * ДОБОРА, то есть занятие набирается из них, только когда без них до нужной
 * длительности не хватило. Это не про место в готовом занятии: там порядок
 * всё равно пересобирается по частям (дыхание, разминка, основная, растяжка),
 * поэтому проверяем именно очерёдность добора — коротким и длинным занятием.
 */
const maybeLong = planWorkout("general", "maybe", 45, false);
const maybeBars = maybeLong.filter((e) => isBar(e.slug));

check(
  "занятие дня, has_turnik='maybe', 45 мин — турниковые добраны и помечены необязательными",
  maybeBars.length > 0 && maybeBars.every((e) => e.optional === true && Boolean(e.warning)),
  maybeBars.map((e) => `${e.slug}:optional=${e.optional}`).join(", "),
);

const maybeShort = planWorkout("general", "maybe", 12, false);
const yesShort = planWorkout("general", "yes", 12, false);
check(
  "занятие дня, has_turnik='maybe', 12 мин — обошлось без турника",
  barsIn(maybeShort).length === 0,
  barsIn(maybeShort).join(", "),
);
check(
  "при 'yes' на той же длительности турниковые берутся наравне — значит откладывает именно 'maybe'",
  barsIn(yesShort).length > 0,
  `при 'yes' турниковых ${barsIn(yesShort).length}`,
);

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
