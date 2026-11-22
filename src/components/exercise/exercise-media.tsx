"use client";

import Image from "next/image";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ExercisePlaceholder } from "@/components/exercise/exercise-placeholder";
import { ExerciseSchemeCard, hasScheme } from "@/components/exercise/exercise-scheme";
import { exerciseMediaFiles, exerciseReadableGuide, hasInstalledExerciseMedia, type ExerciseMediaInput } from "@/lib/exercise-media";
import { cn } from "cn";

/** One media view for the catalog and workouts, including saved snapshots. */
export function ExerciseMedia({ exercise }: { exercise: ExerciseMediaInput }) {
  const files = exerciseMediaFiles(exercise);
  const [side, setSide] = useState(0);
  const current = files[side] ?? files[0];
  const installed = hasInstalledExerciseMedia(exercise.slug);
  const guide = current ? exerciseReadableGuide(current.src) : undefined;

  if (!current) return hasScheme(exercise.slug)
    ? <ExerciseSchemeCard slug={exercise.slug} />
    : <ExercisePlaceholder type={exercise.type} />;

  return (
    <figure className="space-y-2">
      {files.length > 1 ? (
        <div className="flex gap-2" role="group" aria-label="Сторона упражнения">
          {files.map((file, index) => (
            <button key={file.src} type="button" aria-pressed={side === index}
              onClick={() => setSide(index)}
              className={cn("min-h-12 flex-1 rounded-lg border px-3 text-lg", side === index
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground")}>
              Сторона {index + 1}
            </button>
          ))}
        </div>
      ) : null}
      <MediaImage key={current.src} src={current.src} thumb={current.thumb} name={exercise.name} />
      {guide ? (
        <figcaption className="space-y-3 rounded-xl bg-primary/5 p-4 text-[22px] leading-[1.45]" aria-label="Крупные подписи к движению">
          {guide.tip ? <p className="font-semibold">{guide.tip}</p> : null}
          <ol className="list-decimal space-y-2 pl-6">
            {guide.phases.map((phase, index) => <li key={index}>{phase}</li>)}
          </ol>
        </figcaption>
      ) : null}
      {!installed && exercise.image_credit && !exercise.gif_url ? (
        <figcaption className="text-right text-[11px] text-muted-foreground">изображение: {exercise.image_credit}</figcaption>
      ) : null}
    </figure>
  );
}

function MediaImage({ src, thumb, name }: { src: string; thumb: string; name: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      {!loaded && !thumbFailed ? <Skeleton className="absolute inset-0 size-full" /> : null}
      {thumbFailed ? <p className="flex size-full items-center justify-center p-4 text-sm text-muted-foreground">Не удалось загрузить демонстрацию</p> : (
        <Image src={failed ? thumb : src} alt={name} fill unoptimized loading="lazy"
          sizes="(max-width: 640px) 100vw, 480px"
          className={cn("object-contain p-2 transition-opacity", loaded ? "opacity-100" : "opacity-0")}
          onLoad={() => setLoaded(true)}
          onError={() => { if (failed) setThumbFailed(true); else { setFailed(true); setLoaded(false); } }} />
      )}
    </div>
  );
}
