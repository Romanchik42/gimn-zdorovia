/** Звуковые наборы (SPEC 5.6). Файлы: public/sounds/<набор>/<событие>.mp3 */

export const SOUND_EVENTS = ["done", "difficult", "skip", "complete", "transition"] as const;
export type SoundEvent = (typeof SOUND_EVENTS)[number];

export const PLAYABLE_PACKS = ["soft", "energetic", "minimal", "nature", "digital", "warm"] as const;
export type PlayablePack = (typeof PLAYABLE_PACKS)[number];
export type SoundPackId = PlayablePack | "none";

export const DEFAULT_SOUND_PACK: SoundPackId = "soft";

export const SOUND_PACK_LABELS: Record<SoundPackId, string> = {
  soft: "Мягкий",
  energetic: "Бодрый",
  minimal: "Минимальный",
  nature: "Природный",
  digital: "Цифровой",
  warm: "Тёплый",
  none: "Без звука",
};

export const SOUND_PACK_DESCRIPTIONS: Record<SoundPackId, string> = {
  soft: "Тёплые приглушённые тона, как колокольчик под водой",
  energetic: "Яркие спортивные сигналы — для драйва",
  minimal: "Сухие короткие щелчки, почти как клавиатура",
  nature: "Капли воды и мягкие деревянные тона",
  digital: "Чистые электронные сигналы, как у приборов",
  warm: "Маримба: округлое дерево, без резких краёв",
  none: "Тишина: для занятий под свою музыку",
};

export function soundUrl(pack: PlayablePack, event: SoundEvent): string {
  return `/sounds/${pack}/${event}.mp3`;
}

export function isPlayable(pack: SoundPackId): pack is PlayablePack {
  return pack !== "none";
}
