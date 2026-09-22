import type { Equipment, HasTurnik } from "@/lib/supabase/types";

/**
 * Снаряд (GIMN-014) — единый источник правил про турник и брусья.
 *
 * Анкета общего режима спрашивает одно: есть ли турник. Брусья отдельным
 * вопросом не спрашиваем — там, где во дворе турник, обычно рядом и брусья,
 * а лишний вопрос в анкете стоит дороже, чем пара упражнений мимо.
 *
 * Три ответа дают три поведения подбора:
 *   'no'    — упражнений со снарядом не существует, как было до тикета;
 *   'yes'   — они участвуют наравне с остальными;
 *   'maybe' — участвуют, но последними в очереди добора и с пометкой:
 *             «могу найти» — это не «есть», занятие должно складываться
 *             и без них.
 */

export const HAS_TURNIK_VALUES = ["yes", "no", "maybe"] as const;

export const HAS_TURNIK_LABELS: Record<HasTurnik, string> = {
  yes: "Да",
  no: "Нет",
  maybe: "Могу найти",
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  none: "",
  pullup_bar: "турник",
  dip_bars: "брусья",
};

/** Нужен ли упражнению снаряд. */
export function needsEquipment(equipment: Equipment | null | undefined): boolean {
  return equipment === "pullup_bar" || equipment === "dip_bars";
}

/** Доступно ли упражнение при таком ответе анкеты. */
export function equipmentAvailable(
  equipment: Equipment | null | undefined,
  hasTurnik: HasTurnik | null | undefined,
): boolean {
  if (!needsEquipment(equipment)) return true;
  return hasTurnik === "yes" || hasTurnik === "maybe";
}

/**
 * Пометка к упражнению со снарядом. При «да» её нет: человек сказал, что
 * турник есть, напоминать об этом в каждой карточке незачем.
 */
export function equipmentNote(
  equipment: Equipment | null | undefined,
  hasTurnik: HasTurnik | null | undefined,
): string | null {
  if (!needsEquipment(equipment) || hasTurnik !== "maybe") return null;
  return `Нужен ${EQUIPMENT_LABELS[equipment as Equipment]} — не нашли, пропустите это упражнение`;
}

/** Пометка в каталоге и конструкторе, где анкета не спрашивается по месту. */
export function equipmentHint(equipment: Equipment | null | undefined): string | null {
  return needsEquipment(equipment) ? `Нужен ${EQUIPMENT_LABELS[equipment as Equipment]}` : null;
}
