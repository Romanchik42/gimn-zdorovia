import "server-only";

import type {
  ExerciseRow,
  ExerciseSnapshot,
  Level,
  Mode,
  SequenceIntensity,
  SequenceItem,
  WorkoutLength,
} from "@/lib/supabase/types";
import {
  NO_EQUIPMENT,
  equipmentAvailable,
  equipmentNote,
  equipmentOptional,
  needsEquipment,
  type EquipmentAccess,
} from "@/lib/workout-engine/equipment";
import { estimateMinutes } from "@/lib/workout-engine/duration";
import { cutToLength } from "@/lib/workout-engine/length";
import { NO_RESTRICTIONS, type Restrictions } from "@/lib/diagnostics/extended";
import {
  FOCUS_JOINTS,
  LEVEL_RANK,
  exerciseCount,
  fitToDuration,
} from "@/lib/workout-engine/custom-builder";

/**
 * Сборка тренировки из шаблона последовательности (SPEC 3.3).
 * Порядок в шаблоне не пересортировываем: дыхание → разминка и массаж →
 * основное → растяжка задан заранее и является частью методики (SPEC 5.4).
 */

/**
 * Соответствие «зона боли → метка противопоказания».
 * Упражнение отфильтровывается, если у пользователя болит зона,
 * для которой у упражнения проставлено противопоказание.
 */
const PAIN_TO_CONTRAINDICATION: Record<string, string[]> = {
  neck: ["acute_neck_pain"],
  shoulder: ["shoulder_pain"],
  spine_thoracic: ["acute_back_pain"],
  spine_lumbar: ["acute_back_pain"],
  hips: ["knee_pain"],
  legs: ["knee_pain"],
};

/** Противопоказания, не зависящие от зон боли. */
export function healthContraindications(bloodPressureOk: boolean | null | undefined): string[] {
  return bloodPressureOk === false ? ["high_blood_pressure"] : [];
}

export function contraindicationsFor(
  painAreas: string[],
  bloodPressureOk: boolean | null | undefined,
): string[] {
  const set = new Set<string>(healthContraindications(bloodPressureOk));
  for (const area of painAreas) {
    for (const tag of PAIN_TO_CONTRAINDICATION[area] ?? []) set.add(tag);
  }
  return [...set];
}

export function isContraindicated(exercise: ExerciseRow, blocked: string[]): boolean {
  if (blocked.length === 0) return false;
  return (exercise.contraindications ?? []).some((c) => blocked.includes(c));
}

/** Коэффициент объёма нагрузки по интенсивности. */
const INTENSITY_FACTOR: Record<SequenceIntensity, number> = {
  low: 0.7,
  medium: 0.85,
  normal: 1,
};

function scale(value: number | null | undefined, factor: number, min: number): number | null {
  if (value === null || value === undefined) return null;
  return Math.max(min, Math.round(value * factor));
}

export type BuildArgs = {
  items: SequenceItem[];
  exercisesBySlug: Map<string, ExerciseRow>;
  /** Режим занятия: у Бехтерева упражнений со снарядом нет (GIMN-022). */
  mode: Mode;
  intensity: SequenceIntensity;
  painAreas?: string[];
  bloodPressureOk?: boolean | null;
  /** Упражнения, исключённые Decision Tree после побочек. */
  excludeExerciseIds?: string[];
  /** Зоны, исключённые после побочки (skip_joint). */
  excludeJoints?: string[];
  /** Снаряжение человека (GIMN-028). Не передали — считаем, что снаряда нет. */
  access?: EquipmentAccess;
};

export type BuildResult = {
  exercises: ExerciseSnapshot[];
  skipped: { slug: string; reason: string }[];
  totalDurationMin: number;
};

export function buildWorkout(args: BuildArgs): BuildResult {
  const blocked = contraindicationsFor(args.painAreas ?? [], args.bloodPressureOk);
  const factor = INTENSITY_FACTOR[args.intensity];
  const exclude = new Set(args.excludeExerciseIds ?? []);
  const excludeJoints = new Set(args.excludeJoints ?? []);

  const exercises: ExerciseSnapshot[] = [];
  const skipped: { slug: string; reason: string }[] = [];

  const ordered = [...args.items].sort((a, b) => a.order - b.order);

  for (const item of ordered) {
    const exercise = args.exercisesBySlug.get(item.slug);

    if (!exercise) {
      skipped.push({ slug: item.slug, reason: "упражнения нет в справочнике" });
      continue;
    }

    if (exclude.has(exercise.id)) {
      skipped.push({ slug: item.slug, reason: "исключено после побочного эффекта" });
      continue;
    }

    // Дыхание и растяжку не трогаем: они щадящие и держат структуру занятия.
    if (
      excludeJoints.has(exercise.target_joint) &&
      exercise.type !== "breathing" &&
      exercise.type !== "stretch"
    ) {
      skipped.push({ slug: item.slug, reason: "зона исключена после побочного эффекта" });
      continue;
    }

    if (isContraindicated(exercise, blocked)) {
      skipped.push({ slug: item.slug, reason: "противопоказано по диагностике" });
      continue;
    }

    // Снаряда нет — упражнения нет (GIMN-014). Шаблоны последовательностей
    // турниковых упражнений не содержат, это защита на случай, если однажды
    // будут: показать подтягивание человеку без турника хуже, чем не показать.
    // В режиме Бехтерева отсекается по режиму, независимо от ответа (GIMN-022).
    if (!equipmentAvailable(exercise.equipment, args.mode, args.access ?? NO_EQUIPMENT)) {
      skipped.push({ slug: item.slug, reason: "нужен снаряд, которого нет" });
      continue;
    }

    // Значения из шаблона приоритетнее справочника: шаблон задаёт дозировку дня.
    const durationSec = item.duration_sec ?? exercise.duration_sec;
    const repetitions = item.repetitions ?? exercise.repetitions;

    exercises.push({
      exercise_id: exercise.id,
      slug: exercise.slug,
      name: exercise.name,
      type: exercise.type,
      target_joint: exercise.target_joint,
      description: exercise.description,
      technique: exercise.technique,
      gif_url: exercise.gif_url,
      image_url: exercise.image_url,
      image_credit: exercise.image_credit,
      duration_sec: scale(durationSec, factor, 15),
      repetitions: scale(repetitions, factor, 4),
      order: exercises.length + 1,
      warning: joinNotes(
        warningFor(exercise, blocked),
        equipmentNote(exercise.equipment, args.mode, args.access ?? NO_EQUIPMENT),
      ),
      equipment: exercise.equipment,
      optional: equipmentOptional(exercise.equipment, args.mode, args.access ?? NO_EQUIPMENT),
    });
  }

  return { exercises, skipped, totalDurationMin: estimateMinutes(exercises) };
}

/** Пометки в карточке — одной строкой, пустые отбрасываются. */
function joinNotes(...parts: (string | null | undefined)[]): string | null {
  const list = parts.filter((p): p is string => Boolean(p));
  return list.length > 0 ? list.join(". ") : null;
}

/**
 * Предупреждение показывается, когда упражнение не заблокировано,
 * но у пользователя есть повод к нему присмотреться.
 */
function warningFor(exercise: ExerciseRow, blocked: string[]): string | null {
  const risky = (exercise.contraindications ?? []).filter((c) => !blocked.includes(c));
  if (risky.length === 0) return null;

  const labels: Record<string, string> = {
    high_blood_pressure: "повышенном давлении",
    shoulder_pain: "боли в плече",
    knee_pain: "боли в колене",
    acute_back_pain: "острой боли в спине",
    acute_neck_pain: "острой боли в шее",
  };

  const names = risky.map((c) => labels[c] ?? c);
  return `Осторожно при ${names.join(", ")}`;
}

/* ------------------------ подгонка под длительность ------------------------ */

/** Место части в занятии: новое упражнение встаёт в конец своей части. */
const PART_RANK: Record<string, number> = { breathing: 0, warmup: 1, massage: 1, main: 2, stretch: 3 };

export type FitPlanArgs = {
  /** Весь справочник упражнений — из него добираем недостающее. */
  pool: ExerciseRow[];
  mode: Mode;
  focus: string | null;
  targetMin: number;
  intensity: SequenceIntensity;
  difficulty: Level | null;
  isRestDay: boolean;
  painAreas?: string[];
  bloodPressureOk?: boolean | null;
  excludeExerciseIds?: string[];
  excludeJoints?: string[];
  /** Длина занятия; по умолчанию — полное (весь план). */
  length?: WorkoutLength;
  /** Часто пропускаемые или тяжёлые за прошлую неделю — меняем на лёгкие аналоги. */
  struggling?: string[];
  /** Выводы углублённой диагностики: недоступные положения, ограниченные зоны. */
  restrictions?: Restrictions;
  /** Снаряжение человека (GIMN-028). Не передали — считаем, что снаряда нет. */
  access?: EquipmentAccess;
};

/**
 * Доводит тренировку дня до длительности из плана (SPEC 3.1: ±10%).
 *
 * Шаблон задаёт костяк и порядок по методике, но в нём 7-8 упражнений — это
 * ~10 минут, а в плане стоит 40. Сначала добираем упражнения из справочника
 * по фокусу дня (с теми же фильтрами, что и для шаблона: противопоказания,
 * исключения после побочек, потолок сложности), потом подгоняем дозировку
 * и отдых так же, как в конструкторе. В день отдыха добираем только дыхание
 * и растяжку.
 */
export function fitPlanWorkout(exercises: ExerciseSnapshot[], args: FitPlanArgs): ExerciseSnapshot[] {
  if (exercises.length === 0 || args.targetMin <= 0) return exercises;

  const blocked = contraindicationsFor(args.painAreas ?? [], args.bloodPressureOk);
  const exclude = new Set(args.excludeExerciseIds ?? []);
  const excludeJoints = new Set(args.excludeJoints ?? []);
  const struggling = new Set(args.struggling ?? []);
  // Трудные упражнения тоже считаем «занятыми» — чтобы добор не вернул их обратно.
  const inWorkout = new Set([...exercises.map((e) => e.exercise_id), ...struggling]);
  const joints = FOCUS_JOINTS[args.focus ?? ""] ?? [];
  const restrictions = args.restrictions ?? NO_RESTRICTIONS;
  const blockedPositions = new Set<string>(restrictions.blockedPositions);
  const limitedZones = new Set<string>(restrictions.limitedZones);
  // Нагрузочные упражнения ограниченной зоны в добор не берём: ей — только щадящие.
  const tooHardForZone = (e: ExerciseRow) =>
    limitedZones.has(e.target_joint) && !e.gentle && (e.type === "main" || e.type === "warmup");

  // Потолок сложности: Бехтерева — только щадящее, выше лишь на полной нагрузке.
  const levelCap =
    args.mode === "behtereva" ? (args.intensity === "normal" ? 2 : 1) : LEVEL_RANK[args.difficulty ?? "beginner"];

  const allowed = (e: ExerciseRow) =>
    !inWorkout.has(e.id) &&
      !exclude.has(e.id) &&
      !isContraindicated(e, blocked) &&
      !blockedPositions.has(e.position) &&
      !tooHardForZone(e) &&
      equipmentAvailable(e.equipment, args.mode, args.access ?? NO_EQUIPMENT) &&
    !(excludeJoints.has(e.target_joint) && e.type !== "breathing" && e.type !== "stretch");
  const inMode = (e: ExerciseRow) => e.mode === args.mode || e.mode === "both";
  const safe = args.pool.filter((e) => allowed(e) && inMode(e) && LEVEL_RANK[e.level] <= levelCap);
  // Запас, как в конструкторе: щадящее из соседнего режима. Для Бехтерева —
  // только дыхание, разминка и растяжка, силовое общего режима туда не берём.
  const cross = args.pool.filter(
    (e) =>
      allowed(e) &&
      !inMode(e) &&
      e.level === "beginner" &&
      (args.mode === "general" || e.type !== "main"),
  );

  const factor = INTENSITY_FACTOR[args.intensity];
  const snapshotOf = (e: ExerciseRow): ExerciseSnapshot => ({
    exercise_id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    description: e.description,
    technique: e.technique,
    gif_url: e.gif_url,
    image_url: e.image_url,
    image_credit: e.image_credit,
    duration_sec: scale(e.duration_sec, factor, 15),
    repetitions: scale(e.repetitions, factor, 4),
    order: 0,
    warning: joinNotes(warningFor(e, blocked), equipmentNote(e.equipment, args.mode, args.access ?? NO_EQUIPMENT)),
    equipment: e.equipment,
    optional: equipmentOptional(e.equipment, args.mode, args.access ?? NO_EQUIPMENT),
  });

  const list = [...exercises];
  const byId = new Map(args.pool.map((e) => [e.id, e]));
  const partKey = (type: string) => (type === "massage" ? "warmup" : type);
  const candidates = [...safe, ...cross];

  const add = (e: ExerciseRow, extra?: Partial<ExerciseSnapshot>) => {
    const rank = PART_RANK[e.type] ?? 2;
    // После последнего упражнения той же или более ранней части, но до
    // финального дыхания: заминка по методике остаётся последней.
    let at = 0;
    for (let i = 0; i < list.length; i++) {
      const trailingBreath = list[i].type === "breathing" && i > 0 && i === list.length - 1;
      if ((PART_RANK[list[i].type] ?? 2) <= rank && !trailingBreath) at = i + 1;
    }
    list.splice(at, 0, { ...snapshotOf(e), ...extra });
  };

  // Углублённая диагностика (GIMN-011), 1: положение тела. Упражнение из
  // недоступного положения меняем на аналог той же зоны и части занятия;
  // аналога нет — убираем, количество восполнит добор ниже.
  for (let i = list.length - 1; i >= 0; i--) {
    const original = byId.get(list[i].exercise_id);
    if (!original || !blockedPositions.has(original.position)) continue;
    const alternative = candidates
      .filter((e) => !inWorkout.has(e.id) && e.target_joint === original.target_joint && partKey(e.type) === partKey(original.type))
      .sort((a, b) => Number(b.gentle) - Number(a.gentle) || LEVEL_RANK[a.level] - LEVEL_RANK[b.level])[0];
    if (alternative) {
      inWorkout.add(alternative.id);
      list[i] = { ...snapshotOf(alternative), order: list[i].order, replaced: original.name, replaced_reason: "position" };
    } else {
      list.splice(i, 1);
    }
  }

  // 2: зона с ограничением подвижности НЕ убирается — ей самые щадящие
  // упражнения (микроамплитуда, изометрика): мягко развивать, а не забрасывать.
  // Нагрузочное упражнение зоны меняем на щадящее той же зоны (или соседней —
  // ноги↔таз, спина↔корпус); замены нет — убираем, добор восполнит количество.
  const SIBLING: Record<string, string> = { legs: "hips", hips: "legs", spine: "core", core: "spine" };
  for (const zone of restrictions.limitedZones) {
    const gentleIn = (z: string) => (e: ExerciseRow) => e.gentle && e.target_joint === z && !inWorkout.has(e.id);
    for (let i = list.length - 1; i >= 0; i--) {
      const original = byId.get(list[i].exercise_id);
      if (!original || original.target_joint !== zone || !tooHardForZone(original)) continue;
      const alternative =
        candidates.find((e) => gentleIn(zone)(e) && partKey(e.type) === partKey(original.type)) ??
        candidates.find(gentleIn(zone)) ??
        (SIBLING[zone] ? candidates.find(gentleIn(SIBLING[zone])) : undefined);
      if (alternative) {
        inWorkout.add(alternative.id);
        list[i] = {
          ...snapshotOf(alternative),
          order: list[i].order,
          replaced: original.name,
          replaced_reason: "gentle",
        };
      } else {
        list.splice(i, 1);
      }
    }
    // Минимум щадящих этой зоны; шее — два (микроповороты и изометрия).
    // Основные — вперёд: разминочная часть коротка и уже занята.
    const need = zone === "neck" ? 2 : 1;
    let have = list.filter((e) => byId.get(e.exercise_id)?.gentle && e.target_joint === zone).length;
    const pool = candidates.filter(gentleIn(zone)).sort((x, y) => Number(y.type === "main") - Number(x.type === "main"));
    for (const pick of pool) {
      if (have >= need) break;
      if (inWorkout.has(pick.id)) continue;
      inWorkout.add(pick.id);
      add(pick);
      have++;
    }
  }

  // Недельная адаптация (GIMN-010): упражнение, которое на прошлой неделе
  // часто пропускали или отмечали «тяжело», меняем на аналог той же зоны
  // и той же части занятия — не сложнее исходного. Число упражнений то же.
  for (let i = 0; i < list.length; i++) {
    const original = byId.get(list[i].exercise_id);
    if (!original || !struggling.has(original.id)) continue;
    const alternative = [...safe, ...cross]
      .filter(
        (e) =>
          !inWorkout.has(e.id) &&
          e.target_joint === original.target_joint &&
          partKey(e.type) === partKey(original.type) &&
          LEVEL_RANK[e.level] <= LEVEL_RANK[original.level],
      )
      .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])[0];
    if (!alternative) continue;
    inWorkout.add(alternative.id);
    list[i] = { ...snapshotOf(alternative), order: list[i].order, replaced: original.name, replaced_reason: "weekly" };
  }

  // Дыхание — обязательная часть занятия в любой длине (GIMN-010). Шаблоны
  // общего режима начинаются сразу с разминки — ставим дыхание первым.
  if (!args.isRestDay && !list.some((e) => e.type === "breathing")) {
    const breath = [...safe, ...cross].find((e) => e.type === "breathing" && !inWorkout.has(e.id));
    if (breath) {
      inWorkout.add(breath.id);
      list.unshift(snapshotOf(breath));
    }
  }

  // Очередь кандидатов по убыванию уместности, без повторов.
  const onFocus = (e: ExerciseRow) => joints.includes(e.target_joint);
  const tiers: ExerciseRow[][] = args.isRestDay
    ? [safe, cross].map((l) => l.filter((e) => e.type === "stretch" || e.type === "breathing"))
    : [
        safe.filter((e) => e.type === "main" && onFocus(e)),
        safe.filter((e) => e.type === "stretch" && onFocus(e)),
        safe.filter((e) => (e.type === "warmup" || e.type === "massage") && onFocus(e)),
        safe.filter((e) => e.type === "stretch" || e.type === "warmup" || e.type === "massage"),
        safe.filter((e) => e.type === "main"),
        cross.filter((e) => onFocus(e)),
        cross.filter((e) => e.type !== "main"),
      ];
  const seen = new Set<string>();
  const queue = tiers.flat().filter((e) => !inWorkout.has(e.id) && !seen.has(e.id) && seen.add(e.id));

  // «Могу найти» — не «есть»: турниковые уходят в конец очереди, и занятие
  // набирается из них, только когда без них до нужной длительности не хватило.
  // «Могу найти» — не «есть»: такие упражнения уходят в конец очереди, и
  // занятие набирается из них, только когда без них до длительности не хватило.
  const maybeOnly = args.mode === "general" && (args.access?.maybe.length ?? 0) > 0;
  if (maybeOnly) {
    const isMaybe = (e: ExerciseRow) =>
      needsEquipment(e.equipment) && (args.access?.maybe ?? []).includes(e.equipment);
    queue.sort((a, b) => Number(isMaybe(a)) - Number(isMaybe(b)));
  }

  // Убираем с конца основной части, потом разминки; каждая часть остаётся хотя бы с одним.
  const removeOne = (): boolean => {
    for (const types of [["main"], ["warmup", "massage"], ["stretch"]]) {
      const idx = list.map((e, i) => (types.includes(e.type) ? i : -1)).filter((i) => i >= 0);
      if (idx.length > 1) {
        list.splice(idx[idx.length - 1], 1);
        return true;
      }
    }
    return false;
  };

  const fit = () => fitToDuration(list.map((e, i) => ({ ...e, order: i + 1 })), args.targetMin);

  // Каждая часть занятия — хотя бы одним безопасным упражнением: шаблон мог
  // потерять разминку целиком из-за противопоказаний (GIMN-010).
  if (!args.isRestDay) {
    for (const types of [["warmup", "massage"], ["stretch"]]) {
      if (list.some((e) => types.includes(e.type))) continue;
      const pick =
        queue.find((e) => types.includes(e.type)) ??
        [...safe, ...cross].find((e) => types.includes(e.type) && !inWorkout.has(e.id));
      if (!pick) continue;
      const at = queue.indexOf(pick);
      if (at >= 0) queue.splice(at, 1);
      inWorkout.add(pick.id);
      add(pick);
    }
  }

  // Стартуем с разумного числа упражнений, дальше — по одному, пока не попадём в ±10%.
  while (list.length < exerciseCount(args.targetMin) && queue.length > 0) add(queue.shift()!);

  // Щадящие упражнения ограниченных зон — в приоритете: короткое занятие их не отрезает.
  for (let i = 0; i < list.length; i++) {
    const ex = byId.get(list[i].exercise_id);
    if (ex?.gentle && limitedZones.has(ex.target_joint)) list[i] = { ...list[i], priority: true };
  }

  // Короткое и среднее — меньше упражнений в обычной дозировке, без подгонки
  // под минуты плана: иначе отдых раздулся бы до потолка.
  const length = args.length ?? "full";
  if (length !== "full") return annotate(cutToLength(list.map((e, i) => ({ ...e, order: i + 1 })), length), restrictions);

  let result = fit();
  for (let guard = 0; guard < 20; guard++) {
    const minutes = estimateMinutes(result);
    if (minutes > args.targetMin * 1.1) {
      if (!removeOne()) break;
    } else if (minutes < args.targetMin * 0.9) {
      const next = queue.shift();
      if (!next) break;
      add(next);
    } else break;
    result = fit();
  }
  return annotate(result, restrictions);
}

/**
 * Пометки по углублённой диагностике: слабая рука — нагрузку на неё снижаем,
 * но не убираем; растяжки почти нет — старт с минимальной амплитуды
 * и укороченное удержание.
 */
function annotate(list: ExerciseSnapshot[], r: Restrictions): ExerciseSnapshot[] {
  const note = (e: ExerciseSnapshot, text: string): ExerciseSnapshot => ({
    ...e,
    warning: e.warning ? `${e.warning}. ${text}` : text,
  });
  return list.map((e) => {
    let out = e;
    if (r.weakArm && e.target_joint === "shoulder") {
      out = note(out, `${r.weakArm === "left" ? "Левой" : "Правой"} рукой — меньше амплитуда и повторов, без боли`);
    }
    if (r.limitedZones.includes(e.target_joint as never) && e.type !== "breathing" && !e.priority) {
      out = note(out, "Зона с ограничением — двигайтесь с минимальной амплитудой, без боли");
    }
    if (r.lowFlexibility && e.type === "stretch") {
      out = note(out, "Начните с минимальной амплитуды — только до лёгкого натяжения");
      if (out.duration_sec) out = { ...out, duration_sec: Math.max(15, Math.round((out.duration_sec * 0.7) / 5) * 5) };
    }
    return out;
  });
}

/**
 * Сколько минут ставить на день: из плана, но облегчённая интенсивность
 * (диагностика или поправка после побочки) делает занятие и короче.
 */
export function targetMinutes(
  planMin: number | null | undefined,
  fallbackMin: number,
  planIntensity: SequenceIntensity | null,
  intensity: SequenceIntensity,
): number {
  const base = planMin ?? fallbackMin;
  const ratio = planIntensity ? INTENSITY_FACTOR[intensity] / INTENSITY_FACTOR[planIntensity] : 1;
  return Math.max(10, Math.round(base * Math.min(1, ratio)));
}

// Оценка длительности живёт в общем модуле — она нужна и клиенту (конструктор).
export { DEFAULT_REST_SEC, estimateMinutes } from "@/lib/workout-engine/duration";

/** Сдвиг интенсивности после побочек (SPEC 5.2). */
export function applyAdjustment(
  base: SequenceIntensity,
  adjustment: string | null | undefined,
): SequenceIntensity {
  const order: SequenceIntensity[] = ["low", "medium", "normal"];
  const index = order.indexOf(base);

  switch (adjustment) {
    case "lighter_only":
      return "low";
    case "reduce_intensity_20":
      return order[Math.max(0, index - 1)];
    case "reduce_intensity_10":
      return base === "normal" ? "medium" : base;
    default:
      return base;
  }
}
