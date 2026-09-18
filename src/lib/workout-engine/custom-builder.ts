import "server-only";

import type {
  ExerciseRow,
  ExerciseSnapshot,
  ExerciseType,
  Intensity,
  Level,
  Mode,
} from "@/lib/supabase/types";
import { DEFAULT_REST_SEC, SEC_PER_REP, estimateMinutes } from "@/lib/workout-engine/duration";

/**
 * Сборка своей тренировки по параметрам (SPEC 3.1, US-05).
 *
 * Ключевое отличие от генератора дня: противопоказанные упражнения здесь
 * НЕ исключаются, а помечаются warning. Пользователь сам собирает занятие
 * и сам решает — мы предупреждаем, но не блокируем (US-05).
 */

/** Доли времени по частям занятия (SPEC 3.1). */
const TIME_SPLIT: { type: ExerciseType; share: number }[] = [
  { type: "breathing", share: 0.1 },
  { type: "warmup", share: 0.2 },
  { type: "main", share: 0.5 },
  { type: "stretch", share: 0.2 },
];

/** Какие target_joint считаются подходящими под фокус из UI. */
export const FOCUS_JOINTS: Record<string, string[]> = {
  spine: ["spine", "core"],
  spine_thoracic: ["spine"],
  spine_lumbar: ["spine", "core", "hips"],
  shoulder: ["shoulder"],
  chest: ["shoulder", "core"],
  arms: ["shoulder"],
  back: ["spine", "shoulder"],
  neck: ["neck", "shoulder"],
  hips: ["hips", "legs"],
  legs: ["legs", "hips"],
  core: ["core", "full_body"],
  full_body: ["full_body", "spine", "legs", "shoulder", "core", "hips"],
};

export const LEVEL_RANK: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3 };

/** Потолок сложности: для Бехтерева — по интенсивности, для общей формы — по анкете. */
function maxLevel(mode: Mode, intensity: Intensity, difficulty: Level | null): number {
  if (mode === "behtereva") {
    return intensity === "high" ? 2 : 1;
  }
  return LEVEL_RANK[difficulty ?? "beginner"];
}

const CONTRA_LABELS: Record<string, string> = {
  high_blood_pressure: "повышенном давлении",
  shoulder_pain: "боли в плече",
  knee_pain: "боли в колене",
  acute_back_pain: "острой боли в спине",
  acute_neck_pain: "острой боли в шее",
};

export function warningText(exercise: ExerciseRow, userContra: string[]): string | null {
  const hit = (exercise.contraindications ?? []).filter((c) => userContra.includes(c));
  if (hit.length === 0) return null;
  return `Не рекомендуется при ${hit.map((c) => CONTRA_LABELS[c] ?? c).join(", ")}`;
}

export type CustomBuildArgs = {
  pool: ExerciseRow[];
  mode: Mode;
  focus: string;
  durationMin: number;
  intensity: Intensity;
  difficulty: Level | null;
  userContraindications: string[];
};

export function buildCustomWorkout(args: CustomBuildArgs): {
  exercises: ExerciseSnapshot[];
  totalDurationMin: number;
} {
  const levelCap = maxLevel(args.mode, args.intensity, args.difficulty);
  const joints = FOCUS_JOINTS[args.focus] ?? [args.focus];

  const inMode = (e: ExerciseRow) => e.mode === args.mode || e.mode === "both";
  const eligible = args.pool.filter((e) => inMode(e) && LEVEL_RANK[e.level] <= levelCap);

  const picked: ExerciseRow[] = [];
  const used = new Set<string>();

  const free = (list: ExerciseRow[]) => list.filter((e) => !used.has(e.id));
  // Щадящие упражнения соседнего режима — запас, если своего пула не хватило на длинное занятие.
  const crossGentle = args.pool.filter((e) => !inMode(e) && e.level === "beginner");

  const totalCount = exerciseCount(args.durationMin);

  for (const part of TIME_SPLIT) {
    const quota = Math.max(1, Math.round(totalCount * part.share));
    const ofType = (list: ExerciseRow[]) => list.filter((e) => e.type === part.type);

    // Кандидаты по убыванию уместности: сначала фокус, потом остальное своего режима,
    // потом щадящее из соседнего.
    const tiers: ExerciseRow[][] = [];
    if (part.type === "main") {
      const own = ofType(eligible);
      tiers.push(own.filter((e) => joints.includes(e.target_joint)));
      tiers.push(own.filter((e) => !joints.includes(e.target_joint)));
      tiers.push(ofType(crossGentle).filter((e) => joints.includes(e.target_joint)));
    } else {
      tiers.push(ofType(eligible));
      if (part.type === "warmup") tiers.push(eligible.filter((e) => e.type === "massage"));
      tiers.push(ofType(crossGentle));
    }

    let taken = 0;
    for (const tier of tiers) {
      for (const e of free(tier)) {
        if (taken >= quota) break;
        picked.push(e);
        used.add(e.id);
        taken++;
      }
      if (taken >= quota) break;
    }
  }

  const raw: ExerciseSnapshot[] = picked.map((e, i) => ({
    exercise_id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    description: e.description,
    technique: e.technique,
    gif_url: e.gif_url,
    duration_sec: e.duration_sec,
    repetitions: e.repetitions,
    order: i + 1,
    warning: warningText(e, args.userContraindications),
  }));

  const exercises = fitToDuration(raw, args.durationMin);
  return { exercises, totalDurationMin: estimateMinutes(exercises) };
}

/**
 * Сколько упражнений брать под длительность. US-05 ждёт 10-14 на обычное
 * занятие; короткое — меньше, длинное — чуть больше, но не бесконечно.
 */
export function exerciseCount(durationMin: number): number {
  if (durationMin <= 15) return 6;
  if (durationMin <= 30) return 10;
  if (durationMin <= 45) return 13;
  return 16;
}

/** Потолок отдыха: на длинном занятии восстановление между подходами дольше. */
function maxRestSec(durationMin: number): number {
  return durationMin >= 45 ? 120 : 90;
}

/**
 * Подгоняет занятие под заданное время (допуск ±10%, US-05).
 *
 * Идёт по частям, чтобы сохранить пропорции 10/20/50/20. Внутри части:
 * 1) повторы двигаем в узких пределах (0.6-1.5×) — 60 махов руками это
 *    не «тренировка подлиннее», а риск перегрузить сустав;
 * 2) время упражнений — шире (0.5-2.5×);
 * 3) остаток уходит в отдых между упражнениями (15-120 сек). Так и устроены
 *    длинные занятия: больше восстановления, а не больше повторов.
 */
export function fitToDuration(exercises: ExerciseSnapshot[], targetMin: number): ExerciseSnapshot[] {
  if (exercises.length === 0) return exercises;

  const byPart = new Map<ExerciseType, ExerciseSnapshot[]>();
  for (const e of exercises) {
    // Самомассаж идёт в бюджет разминки — он её часть по методике.
    const part: ExerciseType = e.type === "massage" ? "warmup" : e.type;
    byPart.set(part, [...(byPart.get(part) ?? []), e]);
  }

  const presentShare = TIME_SPLIT.filter((p) => byPart.has(p.type)).reduce((t, p) => t + p.share, 0);
  const fitted = new Map<string, ExerciseSnapshot>();

  for (const part of TIME_SPLIT) {
    const items = byPart.get(part.type);
    if (!items) continue;

    // Если какой-то части нет вовсе, её долю делят остальные пропорционально.
    const partTarget = targetMin * 60 * (part.share / presentShare);
    const minRest = items.length * DEFAULT_REST_SEC;
    const targetWork = Math.max(0, partTarget - minRest);

    const timed = items.reduce((t, e) => t + (e.duration_sec ?? 0), 0);
    const reps = items.reduce(
      (t, e) => t + (e.duration_sec ? 0 : (e.repetitions ?? 0) * SEC_PER_REP),
      0,
    );
    if (timed + reps <= 0) continue;

    const repFactor = Math.min(1.5, Math.max(0.6, targetWork / (timed + reps)));
    const timeFactor =
      timed > 0 ? Math.min(2.5, Math.max(0.5, (targetWork - reps * repFactor) / timed)) : 1;

    const scaled = items.map((e) => ({
      ...e,
      duration_sec: e.duration_sec
        ? Math.max(15, Math.round((e.duration_sec * timeFactor) / 5) * 5)
        : null,
      repetitions:
        e.repetitions && !e.duration_sec
          ? Math.max(4, Math.round(e.repetitions * repFactor))
          : e.repetitions,
    }));

    const work = scaled.reduce(
      (t, e) => t + (e.duration_sec ?? (e.repetitions ?? 0) * SEC_PER_REP),
      0,
    );
    const restEach = Math.min(
      maxRestSec(targetMin),
      Math.max(DEFAULT_REST_SEC, Math.round((partTarget - work) / items.length / 5) * 5),
    );

    for (const e of scaled) {
      fitted.set(`${e.exercise_id}:${e.order}`, { ...e, rest_sec: restEach });
    }
  }

  const result = exercises.map((e) => fitted.get(`${e.exercise_id}:${e.order}`) ?? e);
  return redistributeShortfall(result, targetMin);
}

/**
 * Если часть занятия упёрлась в потолки (например, основной блок только из
 * упражнений на повторы), недобор отдаём упражнениям на время из других частей —
 * растяжке и дыханию тянуться не вредно.
 */
function redistributeShortfall(exercises: ExerciseSnapshot[], targetMin: number): ExerciseSnapshot[] {
  const targetSec = targetMin * 60;
  const totalSec = estimateMinutes(exercises) * 60;
  const gap = targetSec * 0.95 - totalSec;
  if (gap <= 0) return exercises;

  const timed = exercises.filter((e) => e.duration_sec);
  const timedSum = timed.reduce((t, e) => t + (e.duration_sec ?? 0), 0);
  if (timedSum <= 0) return exercises;

  const factor = Math.min(1.6, 1 + gap / timedSum);
  return exercises.map((e) =>
    e.duration_sec
      ? { ...e, duration_sec: Math.round((e.duration_sec * factor) / 5) * 5 }
      : e,
  );
}

/** Снимок упражнения с пользовательскими правками длительности/повторов. */
export function snapshotFrom(
  e: ExerciseRow,
  order: number,
  overrides: { duration_sec?: number | null; repetitions?: number | null; rest_sec?: number | null },
  userContra: string[],
): ExerciseSnapshot {
  return {
    exercise_id: e.id,
    slug: e.slug,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    description: e.description,
    technique: e.technique,
    gif_url: e.gif_url,
    duration_sec: overrides.duration_sec ?? e.duration_sec,
    repetitions: overrides.repetitions ?? e.repetitions,
    order,
    warning: warningText(e, userContra),
    rest_sec: overrides.rest_sec ?? null,
  };
}
