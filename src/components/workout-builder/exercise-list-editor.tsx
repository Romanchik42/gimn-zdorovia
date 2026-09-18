"use client";

import { useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, MinusIcon, PlusIcon, TriangleAlertIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exerciseMeta, formatSeconds } from "@/lib/exercise-labels";
import type { ExerciseType, TargetJoint } from "@/lib/supabase/types";
import { cn } from "cn";

export type BuilderItem = {
  /** Ключ строки для dnd-kit. */
  key: string;
  exercise_id: string;
  name: string;
  type: ExerciseType;
  target_joint: TargetJoint;
  duration_sec: number | null;
  repetitions: number | null;
  rest_sec: number | null;
  warning: string | null;
};

const DURATION_STEP = 15;
const REPS_STEP = 2;

/**
 * Список упражнений с перетаскиванием (US-05).
 * Тянуть можно только за ручку ⠿ — иначе на телефоне список нельзя было бы
 * прокрутить пальцем: любое касание начинало бы перетаскивание.
 */
export function ExerciseListEditor({
  items,
  onChange,
}: {
  items: BuilderItem[];
  onChange: (items: BuilderItem[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Задержка на таче отличает «потащить» от «прокрутить».
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.key === active.id);
    const to = items.findIndex((i) => i.key === over.id);
    if (from < 0 || to < 0) return;
    onChange(arrayMove(items, from, to));
  }

  function update(key: string, patch: Partial<BuilderItem>) {
    onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function remove(key: string) {
    onChange(items.filter((i) => i.key !== key));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {items.map((item, index) => (
            <SortableRow
              key={item.key}
              item={item}
              index={index}
              onUpdate={(patch) => update(item.key, patch)}
              onRemove={() => remove(item.key)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  item,
  index,
  onUpdate,
  onRemove,
}: {
  item: BuilderItem;
  index: number;
  onUpdate: (patch: Partial<BuilderItem>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.key });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const byTime = item.duration_sec !== null;

  function step(direction: 1 | -1) {
    if (byTime) {
      const next = Math.max(15, Math.min(1800, (item.duration_sec ?? 30) + direction * DURATION_STEP));
      onUpdate({ duration_sec: next });
    } else {
      const next = Math.max(1, Math.min(200, (item.repetitions ?? 10) + direction * REPS_STEP));
      onUpdate({ repetitions: next });
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-xl bg-card ring-1 ring-foreground/10",
        isDragging && "z-10 shadow-lg ring-primary/40",
        item.warning && "bg-muted/60",
      )}
    >
      <div className="flex items-center gap-1 p-2">
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Перетащить: ${item.name}`}
          className="flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-5" />
        </button>

        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          aria-expanded={editing}
          className="flex min-h-11 flex-1 flex-col justify-center text-left"
        >
          <span className={cn("flex items-center gap-1.5 text-sm font-medium", item.warning && "text-muted-foreground")}>
            <span className="font-mono text-xs text-muted-foreground">{index + 1}.</span>
            {item.name}
            {item.warning ? (
              <TriangleAlertIcon className="size-3.5 shrink-0 text-accent" aria-label={item.warning} />
            ) : null}
          </span>
          <span className="text-xs text-muted-foreground">{exerciseMeta(item)}</span>
        </button>

        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0"
          onClick={onRemove}
          aria-label={`Убрать: ${item.name}`}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      {editing ? (
        <div className="space-y-2 border-t border-border p-3">
          {item.warning ? <p className="text-xs text-accent">{item.warning}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">
              {byTime ? "Длительность" : "Повторения"}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => step(-1)}
                aria-label="Меньше"
              >
                <MinusIcon className="size-4" />
              </Button>
              <span className="min-w-20 text-center font-mono text-sm">
                {byTime ? formatSeconds(item.duration_sec ?? 0) : `${item.repetitions} раз`}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-10"
                onClick={() => step(1)}
                aria-label="Больше"
              >
                <PlusIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
