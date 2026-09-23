import type { Equipment, HasTurnik, Mode, TrainingLocation } from "@/lib/supabase/types";

/**
 * Снаряд (GIMN-014, расширен в GIMN-028) — единый источник правил о том,
 * чем человек может заниматься.
 *
 * Снаряд — принадлежность ОБЩЕГО режима (GIMN-022). Режим Бехтерева не
 * получает упражнений со снарядом ни при каком ответе анкеты: это программа
 * реабилитации, а ответ про снаряжение мог остаться от второго режима —
 * режимы у человека бывают оба сразу. Поэтому режим стоит в подписи
 * обязательным аргументом, а не читается из контекста: так ни одно место
 * подбора не сможет о нём забыть молча.
 *
 * Про совместимость. Раньше вопрос был один — есть ли турник, с ответами
 * «да», «нет», «могу найти». Теперь человек отмечает список снаряжения.
 * Пока список пуст, подбор читает старый ответ: иначе у всех, кто заполнил
 * анкету до GIMN-028, турник молча исчез бы из программы.
 */

export const HAS_TURNIK_VALUES = ["yes", "no", "maybe"] as const;

export const HAS_TURNIK_LABELS: Record<HasTurnik, string> = {
  yes: "Да",
  no: "Нет",
  maybe: "Могу найти",
};

/** Все снаряды, кроме «ничего не нужно». Порядок — как в анкете. */
export const EQUIPMENT_VALUES = [
  "pullup_bar",
  "dip_bars",
  "dumbbell",
  "kettlebell",
  "resistance_band",
  "bench",
  "barbell",
  "squat_rack",
  "cable",
  "machine",
] as const satisfies readonly Equipment[];

/** Снаряд, который человек может отметить в анкете. Всё, кроме «ничего не нужно». */
export type SelectableEquipment = (typeof EQUIPMENT_VALUES)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "",
  pullup_bar: "турник",
  dip_bars: "брусья",
  dumbbell: "гантели",
  barbell: "штанга",
  bench: "скамья",
  kettlebell: "гиря",
  resistance_band: "резинки",
  cable: "блок",
  machine: "тренажёр",
  squat_rack: "стойка",
};

export const TRAINING_LOCATION_LABELS: Record<TrainingLocation, string> = {
  home: "Дома: свой вес и простой инвентарь",
  home_bar: "Дома плюс турник или брусья",
  gym: "В тренажёрном зале",
  home_and_gym: "И дома, и в зале — по обстоятельствам",
};

/**
 * Что предлагаем отметить при таком месте занятий. Гантели, гиря и резинки
 * бывают и дома, поэтому их показываем всегда; штангу, стойку, скамью и
 * тренажёры — только тем, кто ходит в зал.
 *
 * Турника и брусьев в списке нет: про них спрашивает отдельный вопрос с
 * тремя ответами, включая «могу найти», а галочка выражает только «есть»
 * или «нет». Два вопроса про одно и то же в анкете хуже, чем один точный.
 */
const HOME_EQUIPMENT: readonly SelectableEquipment[] = ["dumbbell", "kettlebell", "resistance_band"];
const GYM_EQUIPMENT: readonly SelectableEquipment[] = [
  "dumbbell",
  "kettlebell",
  "resistance_band",
  "bench",
  "barbell",
  "squat_rack",
  "cable",
  "machine",
];

export const EQUIPMENT_BY_LOCATION: Record<TrainingLocation, readonly SelectableEquipment[]> = {
  home: HOME_EQUIPMENT,
  home_bar: HOME_EQUIPMENT,
  gym: GYM_EQUIPMENT,
  home_and_gym: GYM_EQUIPMENT,
};

/** Турник и брусья — их даёт отдельный вопрос анкеты, а не чек-лист. */
export const BAR_EQUIPMENT: readonly SelectableEquipment[] = ["pullup_bar", "dip_bars"];

/** Нужен ли упражнению снаряд. */
export function needsEquipment(equipment: Equipment | null | undefined): boolean {
  return Boolean(equipment) && equipment !== "none";
}

/**
 * Работает ли снаряжение в этом режиме. У Бехтерева — нет: в этой программе
 * снаряда не бывает, и ответы общего режима на неё не распространяются.
 */
export function equipmentAllowedInMode(mode: Mode): boolean {
  return mode === "general";
}

/**
 * Что у человека есть. `owned` — отмеченное в анкете, `maybe` — «могу
 * найти»: участвует в подборе, но последним в очереди и с пометкой.
 */
export type EquipmentAccess = {
  owned: readonly Equipment[];
  maybe: readonly Equipment[];
};

export const NO_EQUIPMENT: EquipmentAccess = { owned: [], maybe: [] };

/**
 * Доступ по анкете. Новый список важнее старого ответа про турник, но пока
 * список пуст, читаем старый ответ — у тех, кто заполнял анкету до
 * GIMN-028, ничего не должно пропасть.
 */
export function accessFromProfile(profile: {
  gym_equipment?: unknown;
  has_turnik?: HasTurnik | null;
}): EquipmentAccess {
  // Чек-лист отвечает за зал и домашний инвентарь, отдельный вопрос — за
  // турник и брусья. Складываем оба: они спрашивают про разное.
  const listed = parseEquipmentList(profile.gym_equipment).filter((e) => !BAR_EQUIPMENT.includes(e));

  if (profile.has_turnik === "yes") return { owned: [...listed, ...BAR_EQUIPMENT], maybe: [] };
  if (profile.has_turnik === "maybe") return { owned: listed, maybe: BAR_EQUIPMENT };
  return listed.length > 0 ? { owned: listed, maybe: [] } : NO_EQUIPMENT;
}

/** gym_equipment приходит из JSONB — чужие и неизвестные значения отбрасываем. */
export function parseEquipmentList(value: unknown): SelectableEquipment[] {
  if (!Array.isArray(value)) return [];
  const known = new Set<string>(EQUIPMENT_VALUES);
  return value.filter((v): v is SelectableEquipment => typeof v === "string" && known.has(v));
}

/** Доступно ли упражнение в этом режиме при таком снаряжении. */
export function equipmentAvailable(
  equipment: Equipment | null | undefined,
  mode: Mode,
  access: EquipmentAccess,
): boolean {
  if (!needsEquipment(equipment)) return true;
  if (!equipmentAllowedInMode(mode)) return false;
  const item = equipment as Equipment;
  return access.owned.includes(item) || access.maybe.includes(item);
}

/**
 * Пометка к упражнению со снарядом. Ставится только у «могу найти»: если
 * человек отметил снаряд как свой, напоминать об этом в каждой карточке
 * незачем.
 */
export function equipmentNote(
  equipment: Equipment | null | undefined,
  mode: Mode,
  access: EquipmentAccess,
): string | null {
  if (!needsEquipment(equipment) || !equipmentAllowedInMode(mode)) return null;
  if (!access.maybe.includes(equipment as Equipment)) return null;
  return `Нужен ${EQUIPMENT_LABELS[equipment as Equipment]} — не нашли, пропустите это упражнение`;
}

/**
 * Необязательное упражнение: снаряд нужен, а человек отметил его как «могу
 * найти». Занятие должно складываться и без него.
 */
export function equipmentOptional(
  equipment: Equipment | null | undefined,
  mode: Mode,
  access: EquipmentAccess,
): boolean {
  return (
    needsEquipment(equipment) &&
    equipmentAllowedInMode(mode) &&
    access.maybe.includes(equipment as Equipment)
  );
}

/** Пометка в каталоге и конструкторе, где анкета не спрашивается по месту. */
export function equipmentHint(equipment: Equipment | null | undefined): string | null {
  return needsEquipment(equipment) ? `Нужен ${EQUIPMENT_LABELS[equipment as Equipment]}` : null;
}
