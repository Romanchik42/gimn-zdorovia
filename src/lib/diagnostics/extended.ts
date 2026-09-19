import { z } from "zod";

/**
 * Углублённая диагностика (GIMN-011) — единый источник вопросов, вариантов
 * ответа, схемы валидации и выводов для подбора упражнений. Экран опроса,
 * API и движок тренировок читают только отсюда.
 *
 * Главный принцип подбора:
 * - «не могу» про ПОЛОЖЕНИЕ тела (лёжа на животе, на спине, сидя на полу) —
 *   упражнения из этого положения убираем и меняем на аналог из доступного;
 * - «не могу» про ЗОНУ (шея, наклоны, ноги, повороты) — зону НЕ убираем,
 *   а даём ей самые щадящие упражнения (микроамплитуда, изометрика):
 *   ограничение — повод мягко развивать, а не забрасывать.
 */

type Option = readonly [value: string, label: string];
type Question = { readonly key: string; readonly text: string; readonly options: readonly Option[] };
type Block = { readonly id: string; readonly title: string; readonly hint: string; readonly questions: readonly Question[] };

export const EXTENDED_BLOCKS = [
  {
    id: "positions",
    title: "Положения тела",
    hint: "Отвечайте про обычный день, не про самый тяжёлый.",
    questions: [
      { key: "can_lie_prone", text: "Можете лежать на животе?", options: [["yes", "Да"], ["no", "Нет — больно или живот вздут"]] },
      { key: "can_lie_supine", text: "Можете лежать на спине с вытянутыми ногами?", options: [["yes", "Да"], ["hard", "С трудом"], ["no", "Нет"]] },
      { key: "can_stand_unsupported", text: "Можете стоять без опоры?", options: [["yes", "Да"], ["support", "Нужна опора"]] },
      { key: "can_sit_floor", text: "Можете сидеть на полу?", options: [["yes", "Да"], ["hard", "С трудом"], ["no", "Нет"]] },
    ],
  },
  {
    id: "arms",
    title: "Руки и плечи",
    hint: "Поднимайте руки вперёд-вверх, без рывков.",
    questions: [
      { key: "arms_equal", text: "Обе руки поднимаются одинаково?", options: [["yes", "Да"], ["left_worse", "Левая хуже"], ["right_worse", "Правая хуже"]] },
      { key: "worse_arm_raise", text: "Насколько поднимается худшая рука?", options: [["shoulder", "До уровня плеча"], ["chest", "До груди"], ["barely", "Почти не поднимается"]] },
      { key: "hands_behind_back", text: "Можете завести руки за спину?", options: [["yes", "Да"], ["partial", "Частично"], ["no", "Нет"]] },
    ],
  },
  {
    id: "neck",
    title: "Шея",
    hint: "Двигайте головой медленно, до первого натяжения.",
    questions: [
      { key: "neck_rotation", text: "Голова поворачивается в стороны?", options: [["free", "Свободно"], ["some", "Немного"], ["barely", "Почти не крутится"]] },
      { key: "neck_side_tilt", text: "Можете наклонить голову к плечу?", options: [["yes", "Да"], ["some", "Немного"], ["no", "Нет"]] },
      { key: "neck_flex_ext", text: "Можете посмотреть вверх и вниз?", options: [["yes", "Да"], ["some", "Немного"], ["no", "Нет"]] },
    ],
  },
  {
    id: "spine",
    title: "Позвоночник",
    hint: "Стоя или сидя — как вам удобнее.",
    questions: [
      { key: "forward_bend", text: "Наклон вперёд", options: [["free", "Свободно"], ["some", "Немного"], ["barely", "Почти нет"]] },
      { key: "side_bend", text: "Наклоны вбок", options: [["free", "Свободно"], ["some", "Немного"], ["barely", "Еле заметно"]] },
      { key: "trunk_rotation", text: "Повороты корпуса", options: [["free", "Свободно"], ["some", "Немного"], ["barely", "Почти нет"]] },
      { key: "back_extension", text: "Прогиб назад", options: [["yes", "Да"], ["some", "Немного"], ["no", "Нет"]] },
    ],
  },
  {
    id: "legs",
    title: "Ноги и таз",
    hint: "Если какое-то движение не пробовали — выберите вариант, который ближе.",
    questions: [
      { key: "leg_raise_supine", text: "Лёжа на спине поднимаете прямую ногу?", options: [["both", "Обе легко"], ["one", "Только по одной"], ["none", "Ни одной"]] },
      { key: "legs_apart", text: "Можете расставить ноги на ширину плеч?", options: [["yes", "Да"], ["hard", "С трудом"], ["no", "Нет"]] },
      { key: "leg_abduction", text: "Можете отвести ногу в сторону?", options: [["yes", "Да"], ["some", "Немного"], ["no", "Нет"]] },
      { key: "squat_ability", text: "Приседания или полуприсед?", options: [["yes", "Да"], ["support", "Держась за опору"], ["no", "Нет"]] },
    ],
  },
  {
    id: "general",
    title: "Общее состояние",
    hint: "Последний блок.",
    questions: [
      { key: "flexibility", text: "Растяжка есть?", options: [["normal", "Нормальная"], ["weak", "Слабая"], ["barely", "Почти нет"]] },
      { key: "morning_stiffness_duration", text: "Утренняя скованность длится", options: [["lt30", "До 30 минут"], ["30_60", "30-60 минут"], ["gt60", "Больше часа"]] },
      { key: "hard_days", text: "Бывают дни, когда двигаться совсем тяжело?", options: [["often", "Часто"], ["sometimes", "Иногда"], ["rarely", "Редко"]] },
      { key: "bp_spikes", text: "Давление скачет при нагрузке?", options: [["yes", "Да"], ["no", "Нет"], ["unknown", "Не знаю"]] },
    ],
  },
] as const satisfies readonly Block[];

type AnyQuestion = (typeof EXTENDED_BLOCKS)[number]["questions"][number];
export type ExtendedKey = AnyQuestion["key"];

/** Ответы: ключ вопроса → значение варианта. Любой вопрос можно пропустить. */
export type ExtendedAnswers = {
  [K in ExtendedKey]?: Extract<AnyQuestion, { key: K }>["options"][number][0];
};

export const EXTENDED_QUESTIONS = EXTENDED_BLOCKS.flatMap((b) => [...b.questions]) as readonly AnyQuestion[];

/** Одна схема на клиент и сервер: только известные ключи и только их варианты. */
export const extendedAnswersSchema = z
  .object(
    Object.fromEntries(
      EXTENDED_QUESTIONS.map((q) => [
        q.key,
        z.enum(q.options.map((o) => o[0]) as [string, ...string[]]).optional(),
      ]),
    ),
  )
  .strict()
  .transform((v) => v as ExtendedAnswers);

export const extendedDiagnosticsSchema = z.object({ answers: extendedAnswersSchema });

/* -------------------------------------------------------------------------- */
/*                             Выводы для подбора                              */
/* -------------------------------------------------------------------------- */

/** Положение тела в упражнении (exercises.position, миграция 0014). */
export const POSITIONS = [
  "any",
  "standing",
  "standing_free",
  "sitting",
  "sitting_floor",
  "kneeling",
  "quadruped",
  "supine",
  "prone",
  "side",
] as const;
export type Position = (typeof POSITIONS)[number];

/** Зоны, которые опрос может отметить как ограниченные (совпадают с exercises.target_joint). */
export type LimitedZone = "neck" | "shoulder" | "spine" | "hips" | "legs";

export type Restrictions = {
  /** Положения, из которых упражнения убираем (меняем на доступный аналог). */
  blockedPositions: Position[];
  /** Зоны с ограничением — им щадящие упражнения, а не исключение. */
  limitedZones: LimitedZone[];
  /** Слабая рука: нагрузку на неё снижаем, но не убираем. */
  weakArm: "left" | "right" | null;
  /** «Растяжки почти нет» — старт с минимальной амплитуды. */
  lowFlexibility: boolean;
  /** Давление скачет при нагрузке — как «давление не в норме». */
  bpRisk: boolean;
  /** Тяжёлое общее состояние — интенсивность не выше низкой. */
  heavy: boolean;
};

export const NO_RESTRICTIONS: Restrictions = {
  blockedPositions: [],
  limitedZones: [],
  weakArm: null,
  lowFlexibility: false,
  bpRisk: false,
  heavy: false,
};

export function deriveRestrictions(answers: ExtendedAnswers | null | undefined): Restrictions {
  if (!answers) return NO_RESTRICTIONS;
  const a = answers;

  const blocked = new Set<Position>();
  if (a.can_lie_prone === "no") blocked.add("prone");
  if (a.can_lie_supine === "no") blocked.add("supine");
  if (a.can_sit_floor === "no") {
    // Не сесть на пол — значит, не опуститься и на колени или четвереньки.
    blocked.add("sitting_floor");
    blocked.add("kneeling");
    blocked.add("quadruped");
  }
  // Нужна опора — убираем упражнения, где держат равновесие без неё.
  if (a.can_stand_unsupported === "support") blocked.add("standing_free");

  const zones = new Set<LimitedZone>();
  if (a.neck_rotation === "barely" || a.neck_side_tilt === "no" || a.neck_flex_ext === "no") zones.add("neck");
  if (a.worse_arm_raise === "barely" || a.hands_behind_back === "no") zones.add("shoulder");
  if (a.forward_bend === "barely" || a.side_bend === "barely" || a.trunk_rotation === "barely" || a.back_extension === "no")
    zones.add("spine");
  if (a.leg_raise_supine === "none" || a.legs_apart === "no" || a.leg_abduction === "no" || a.squat_ability === "no") {
    zones.add("legs");
    zones.add("hips");
  }

  const lowFlexibility = a.flexibility === "barely";

  return {
    blockedPositions: [...blocked],
    limitedZones: [...zones],
    weakArm: a.arms_equal === "left_worse" ? "left" : a.arms_equal === "right_worse" ? "right" : null,
    lowFlexibility,
    bpRisk: a.bp_spikes === "yes",
    heavy: lowFlexibility || a.morning_stiffness_duration === "gt60" || a.hard_days === "often",
  };
}

/** Короткие пояснения к подбору — показываем человеку, чтобы подбор не был «чёрным ящиком». */
export function explainRestrictions(r: Restrictions): string[] {
  const out: string[] = [];
  const posLabels: Partial<Record<Position, string>> = {
    prone: "лёжа на животе",
    supine: "лёжа на спине",
    sitting_floor: "сидя на полу",
    kneeling: "на коленях",
    quadruped: "на четвереньках",
    standing_free: "стоя без опоры",
  };
  const zoneLabels: Record<LimitedZone, string> = {
    neck: "шеи",
    shoulder: "плеч",
    spine: "позвоночника",
    hips: "таза",
    legs: "ног",
  };
  const pos = r.blockedPositions.map((p) => posLabels[p]).filter(Boolean);
  if (pos.length) out.push(`Упражнения ${pos.join(", ")} заменим на доступные положения.`);
  if (r.limitedZones.length)
    out.push(`Для ${r.limitedZones.map((z) => zoneLabels[z]).join(", ")} — самые щадящие упражнения, чтобы мягко развивать подвижность.`);
  if (r.weakArm) out.push(`${r.weakArm === "left" ? "Левой" : "Правой"} рукой — меньше амплитуда и повторов.`);
  if (r.lowFlexibility) out.push("Растяжку начнём с минимальной амплитуды.");
  if (r.bpRisk) out.push("Уберём упражнения, которые поднимают давление.");
  if (r.heavy) out.push("Нагрузка — низкая, наращивать будем медленно.");
  return out;
}
