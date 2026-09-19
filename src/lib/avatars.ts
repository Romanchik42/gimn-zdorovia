/**
 * Готовые аватары профиля (GIMN-010) — один источник для схемы, API и UI.
 * Файлы: public/avatars/<id>.svg. Стиль Open Peeps (Pablo Stanley, CC0),
 * собраны генератором DiceBear со спокойными лицами — см. docs/IMAGE_SOURCES.md.
 */
export const AVATARS = [
  "avatar-01",
  "avatar-02",
  "avatar-03",
  "avatar-04",
  "avatar-05",
  "avatar-06",
  "avatar-07",
  "avatar-08",
  "avatar-09",
  "avatar-10",
  "avatar-11",
  "avatar-12",
] as const;

export type AvatarId = (typeof AVATARS)[number];

export function avatarSrc(id: string | null | undefined): string | null {
  return id && (AVATARS as readonly string[]).includes(id) ? `/avatars/${id}.svg` : null;
}
