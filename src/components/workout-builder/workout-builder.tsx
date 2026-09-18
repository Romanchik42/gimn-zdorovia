"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlayIcon, PlusIcon, RotateCcwIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ExerciseBrowser, type CatalogExercise } from "@/components/exercise/exercise-browser";
import { BuilderForm } from "@/components/workout-builder/builder-form";
import {
  ExerciseListEditor,
  type BuilderItem,
} from "@/components/workout-builder/exercise-list-editor";
import { SaveTemplateDialog } from "@/components/workout-builder/save-template-dialog";
import { BUILDER_FOCUS_LABELS, type CustomBuildInput } from "@/lib/schemas/workout";
import { estimateMinutes } from "@/lib/workout-engine/duration";
import type { ExerciseSnapshot } from "@/lib/supabase/types";

let rowSeq = 0;
function rowKey(exerciseId: string): string {
  rowSeq += 1;
  return `${exerciseId}-${rowSeq}`;
}

function fromSnapshot(e: ExerciseSnapshot): BuilderItem {
  return {
    key: rowKey(e.exercise_id),
    exercise_id: e.exercise_id,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    duration_sec: e.duration_sec,
    repetitions: e.repetitions,
    rest_sec: e.rest_sec ?? null,
    warning: e.warning ?? null,
  };
}

function fromCatalog(e: CatalogExercise): BuilderItem {
  return {
    key: rowKey(e.id),
    exercise_id: e.id,
    name: e.name,
    type: e.type,
    target_joint: e.target_joint,
    duration_sec: e.duration_sec,
    repetitions: e.duration_sec ? null : e.repetitions,
    rest_sec: null,
    warning: e.warning,
  };
}

function toOrder(items: BuilderItem[]) {
  return items.map((i, index) => ({
    exercise_id: i.exercise_id,
    order: index + 1,
    duration_sec: i.duration_sec,
    repetitions: i.duration_sec ? null : i.repetitions,
    rest_sec: i.rest_sec,
  }));
}

/** Конструктор своей тренировки (US-05, SPEC 4.4). */
export function WorkoutBuilder({ catalog }: { catalog: CatalogExercise[] }) {
  const router = useRouter();
  const [params, setParams] = useState<CustomBuildInput>({
    focus: "full_body",
    duration_min: 30,
    intensity: "medium",
  });
  const [items, setItems] = useState<BuilderItem[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  async function build() {
    setBuilding(true);
    try {
      const res = await fetch("/api/workout/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось собрать тренировку");
        return;
      }
      setItems((json.data.exercises as ExerciseSnapshot[]).map(fromSnapshot));
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBuilding(false);
    }
  }

  async function start() {
    if (!items?.length) return;
    setStarting(true);
    try {
      const res = await fetch("/api/workout/custom/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises_order: toOrder(items) }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось начать тренировку");
        return;
      }
      router.push(`/app/workout/${json.data.workout_id}`);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setStarting(false);
    }
  }

  async function saveTemplate(name: string): Promise<boolean> {
    if (!items?.length) return false;
    try {
      const res = await fetch("/api/workout/custom/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          focus: params.focus,
          duration_min: params.duration_min,
          intensity: params.intensity,
          exercises_order: toOrder(items),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить шаблон");
        return false;
      }
      toast.success("Шаблон сохранён — он на главном экране");
      return true;
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      return false;
    }
  }

  if (items === null) {
    return <BuilderForm value={params} onChange={setParams} onSubmit={build} pending={building} />;
  }

  const minutes = items.length ? estimateMinutes(items) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Ваша тренировка · {minutes} мин</h2>
          <p className="text-sm text-muted-foreground">
            {BUILDER_FOCUS_LABELS[params.focus]} · {items.length} упражнений. Потяните за ⠿,
            чтобы поменять порядок.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={() => setItems(null)}
          aria-label="Собрать заново"
        >
          <RotateCcwIcon className="size-4" />
        </Button>
      </div>

      {items.length > 0 ? (
        <ExerciseListEditor items={items} onChange={setItems} />
      ) : (
        <p className="rounded-xl bg-muted/50 p-4 text-center text-sm text-muted-foreground">
          Список пуст — добавьте упражнения из каталога.
        </p>
      )}

      <Button variant="outline" className="h-12 w-full" onClick={() => setPickerOpen(true)}>
        <PlusIcon className="size-4" aria-hidden />
        Добавить упражнение
      </Button>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="h-14"
          onClick={() => setSaveOpen(true)}
          disabled={items.length === 0}
        >
          <SaveIcon className="size-4" aria-hidden />
          Сохранить
        </Button>
        <Button className="h-14" onClick={start} disabled={starting || items.length === 0}>
          {starting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlayIcon className="size-4" aria-hidden />
          )}
          Начать сейчас
        </Button>
      </div>

      <Sheet open={pickerOpen} onOpenChange={setPickerOpen}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-2xl px-4 pb-8">
          <SheetHeader className="px-0">
            <SheetTitle>Добавить упражнение</SheetTitle>
            <SheetDescription>Нажмите «+», чтобы добавить в конец тренировки.</SheetDescription>
          </SheetHeader>
          <ExerciseBrowser
            exercises={catalog}
            pickedIds={items.map((i) => i.exercise_id)}
            onPick={(e) => {
              if (items.some((i) => i.exercise_id === e.id)) {
                toast.info("Это упражнение уже в тренировке");
                return;
              }
              setItems((prev) => [...(prev ?? []), fromCatalog(e)]);
              toast.success(`Добавлено: ${e.name}`);
            }}
          />
        </SheetContent>
      </Sheet>

      <SaveTemplateDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultName={`Моя тренировка: ${BUILDER_FOCUS_LABELS[params.focus].toLowerCase()}`}
        onSave={saveTemplate}
      />
    </div>
  );
}
