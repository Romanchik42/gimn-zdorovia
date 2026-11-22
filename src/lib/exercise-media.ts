import installed from "@/lib/exercise-media/installed.json" with { type: "json" };
import readable from "@/lib/exercise-media/readable-guides.json" with { type: "json" };
import type { ExerciseType } from "@/lib/supabase/types";

export type ExerciseMediaInput = {
  slug: string;
  name: string;
  type: ExerciseType;
  gif_url?: string | null;
  image_url?: string | null;
  image_credit?: string | null;
};

type MediaFile = { src: string; thumb: string; sha256?: string };
const catalog: Record<string, { title: string; files: MediaFile[] }> = installed;
const guides: Record<string, { tip: string; phases: string[] }> = readable;

export function exerciseReadableGuide(src: string) {
  const filename = src.split("?")[0].split("/").at(-1) ?? "";
  return guides[filename];
}

export function hasInstalledExerciseMedia(slug: string): boolean {
  return Object.hasOwn(catalog, slug);
}

/** Slug takes precedence over links frozen in previously saved workouts. */
export function exerciseMediaFiles(exercise: ExerciseMediaInput): MediaFile[] {
  if (hasInstalledExerciseMedia(exercise.slug)) return catalog[exercise.slug].files;
  const src = exercise.gif_url ?? exercise.image_url;
  return src ? [{ src, thumb: exerciseThumbUrl(src) }] : [];
}

export function exerciseThumbUrl(src: string): string {
  const [pathname, ...query] = src.split("?");
  return pathname.replace(/\.(gif|webp|png|jpe?g)$/i, "-thumb.webp") +
    (query.length ? `?${query.join("?")}` : "");
}
