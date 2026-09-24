import { equipmentAvailable, type EquipmentAccess } from "@/lib/workout-engine/equipment";
import { LEVEL_RANK } from "@/lib/workout-engine/custom-builder";
import type { ExerciseRow, Level, SequenceItem } from "@/lib/supabase/types";

/**
 * День в зале (GIMN-028, блок D).
 *
 * Гимнастический день собирается из шаблона последовательности: порядок
 * там — часть методики. В зале ведущая идея другая: движения, а не
 * упражнения. Присед, жим, тяга, наклон, корпус — а чем именно приседать,
 * зависит от того, что у человека есть и что ему по уровню.
 *
 * Отсюда и устройство: день — это список ролей, у каждой роли список
 * вариантов от основного к запасному. Нет штанги — берём гантель, нет
 * гантели — тренажёр. Ничего не подошло — роль пропускается и попадает в
 * `missing`, чтобы человеку можно было сказать, чего не хватило, вместо
 * молчаливо короткой тренировки.
 *
 * Чередование A/B, а не «понедельник — ноги»: пропущенная тренировка не
 * должна означать пропущенное движение. Кто занимался в среду вместо
 * вторника, получит тот же день, который не сделал.
 */

export type SlotRole = "squat" | "hinge" | "press" | "pull" | "core" | "carry" | "extra";

export type GymSlot = {
  role: SlotRole;
  /** Варианты от предпочтительного к запасному. */
  options: readonly string[];
  /** Необязательная роль: берётся, только если остаётся время. */
  optional?: boolean;
};

export type GymDayLetter = "A" | "B";

/**
 * Разминка обязательна и стоит первой. В батче её не было, но заходить на
 * присед со штангой с холодных ног — это та экономия пяти минут, которая
 * заканчивается месяцем без тренировок.
 */
const WARMUP: readonly string[] = ["gen-step-touch", "gen-arm-swings"];

/** Растяжка в конце — из существующего общего справочника. */
const COOLDOWN: readonly string[] = ["gen-stretch-full"];

export const GYM_DAY_A: readonly GymSlot[] = [
  { role: "squat", options: ["gym-barbell-squat", "gym-goblet-squat", "gym-leg-press", "gen-squat"] },
  { role: "press", options: ["gym-bench-press", "gym-dumbbell-bench", "gen-pushup"] },
  { role: "pull", options: ["gym-barbell-row", "gym-dumbbell-row", "gym-cable-row", "gen-row-band"] },
  { role: "core", options: ["gen-plank"] },
  { role: "extra", options: ["gym-lat-pulldown", "gym-face-pull"], optional: true },
  { role: "extra", options: ["gym-leg-curl", "gym-calf-raise"], optional: true },
];

export const GYM_DAY_B: readonly GymSlot[] = [
  { role: "squat", options: ["gym-barbell-squat", "gym-goblet-squat", "gym-leg-press", "gen-squat"] },
  { role: "press", options: ["gym-overhead-press", "gym-dumbbell-shoulder-press"] },
  {
    role: "hinge",
    options: ["gym-barbell-deadlift", "gym-romanian-deadlift", "gym-kettlebell-swing", "gym-leg-curl", "gen-glute-bridge"],
  },
  { role: "carry", options: ["gym-farmer-carry", "gen-plank"] },
  { role: "extra", options: ["gym-lat-pulldown", "gym-cable-row"], optional: true },
  { role: "extra", options: ["gym-face-pull", "gym-leg-extension"], optional: true },
];

export const SLOT_LABELS: Record<SlotRole, string> = {
  squat: "приседание",
  hinge: "наклон",
  press: "жим",
  pull: "тяга",
  core: "корпус",
  carry: "перенос веса",
  extra: "добивка",
};

/**
 * Какой сегодня день — A или B. Считаем по числу уже сделанных занятий в
 * зале, а не по дню недели: тренировка, перенесённая с понедельника на
 * среду, остаётся той же тренировкой.
 */
export function gymDayLetter(completedGymWorkouts: number): GymDayLetter {
  return completedGymWorkouts % 2 === 0 ? "A" : "B";
}

export function gymDaySlots(letter: GymDayLetter): readonly GymSlot[] {
  return letter === "A" ? GYM_DAY_A : GYM_DAY_B;
}

/**
 * Собирать ли сегодня день зала.
 *
 * Только общий режим и только тем, кто в анкете указал зал: у остальных
 * программа домашняя, и подменять её силовым днём нельзя — снаряда у них
 * нет, и день собрался бы из одних запасных вариантов.
 *
 * Отдельным условием — наличие упражнений в справочнике. Миграция 0026
 * и деплой кода не атомарны, и до её применения день зала собрался бы из
 * гимнастики, притворяющейся залом.
 */
export function shouldBuildGymDay(args: {
  mode: string;
  location: string | null | undefined;
  isRestDay: boolean;
  gymExercisesLoaded: boolean;
}): boolean {
  if (args.mode !== "general" || args.isRestDay || !args.gymExercisesLoaded) return false;
  return args.location === "gym" || args.location === "home_and_gym";
}

/** Есть ли в справочнике упражнения зала — по ним и узнаём, применена ли 0026. */
export function hasGymExercises(bySlug: Map<string, ExerciseRow>): boolean {
  return bySlug.has("gym-goblet-squat");
}

export type GymDayArgs = {
  letter: GymDayLetter;
  bySlug: Map<string, ExerciseRow>;
  access: EquipmentAccess;
  level: Level;
  /** Сколько основных упражнений брать, не считая разминки и растяжки. */
  maxExercises?: number;
};

export type GymDay = {
  items: SequenceItem[];
  /** Роли, под которые не нашлось ни одного доступного варианта. */
  missing: SlotRole[];
};

/** Подходит ли упражнение человеку: режим общий, снаряд есть, уровень не выше. */
function fits(exercise: ExerciseRow | undefined, access: EquipmentAccess, level: Level): boolean {
  if (!exercise) return false;
  if (exercise.mode !== "general" && exercise.mode !== "both") return false;
  if (LEVEL_RANK[exercise.level] > LEVEL_RANK[level]) return false;
  // Режим здесь всегда общий: зал — принадлежность общего режима (GIMN-022).
  return equipmentAvailable(exercise, "general", access);
}

/** По умолчанию пять основных движений — столько влезает в час с разминкой. */
const DEFAULT_MAX_EXERCISES = 5;

/**
 * Собирает день: разминка, основные движения по ролям, растяжка.
 * Возвращает список для buildWorkout — дальше работают общие правила о
 * противопоказаниях, побочках и дозировке.
 */
export function buildGymDay(args: GymDayArgs): GymDay {
  const max = args.maxExercises ?? DEFAULT_MAX_EXERCISES;
  const slots = gymDaySlots(args.letter);

  const chosen: string[] = [];
  const missing: SlotRole[] = [];
  const used = new Set<string>();

  for (const slot of slots) {
    if (slot.optional && chosen.length >= max) continue;

    const pick = slot.options.find(
      (slug) => !used.has(slug) && fits(args.bySlug.get(slug), args.access, args.level),
    );

    if (!pick) {
      // Необязательная роль без варианта — не потеря: о ней и сообщать нечего.
      if (!slot.optional) missing.push(slot.role);
      continue;
    }

    used.add(pick);
    chosen.push(pick);
    if (chosen.length >= max) break;
  }

  const present = (slugs: readonly string[]) => slugs.filter((slug) => args.bySlug.has(slug));

  const order = [...present(WARMUP), ...chosen, ...present(COOLDOWN)];

  return {
    items: order.map((slug, index) => ({ slug, order: index + 1 })),
    missing,
  };
}

/** Что сказать человеку, если под роль ничего не нашлось. */
export function missingText(missing: SlotRole[]): string | null {
  if (missing.length === 0) return null;
  const names = missing.map((role) => SLOT_LABELS[role]);
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} и ${names[names.length - 1]}`;
  return `Из-за нехватки снаряжения в тренировке нет движений: ${list}. Отметьте в настройках, что у вас появилось.`;
}
