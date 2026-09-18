"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDaysIcon, Loader2Icon, PlayIcon, Trash2Icon, WrenchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CustomExerciseItem } from "@/lib/supabase/types";

export type TemplateSummary = {
  id: string;
  name: string;
  duration_min: number;
  exercises_order: CustomExerciseItem[];
};

/**
 * «Мои тренировки» на главном экране (US-05): сохранённые шаблоны
 * запускаются в одно касание. Плюс входы в конструктор и редактор плана.
 */
export function MyWorkouts({ templates }: { templates: TemplateSummary[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function start(t: TemplateSummary) {
    setBusy(t.id);
    try {
      const res = await fetch("/api/workout/custom/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercises_order: t.exercises_order, custom_workout_id: t.id }),
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
      setBusy(null);
    }
  }

  async function remove(t: TemplateSummary) {
    if (!window.confirm(`Удалить шаблон «${t.name}»?`)) return;
    setBusy(t.id);
    try {
      const res = await fetch(`/api/workout/custom/${t.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось удалить");
        return;
      }
      toast.success("Шаблон удалён");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-3" data-tour="my-workouts">
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="outline" className="h-12">
          <Link href="/app/workout/custom" data-tour="custom-workout">
            <WrenchIcon className="size-4" aria-hidden />
            Собрать свою
          </Link>
        </Button>
        <Button asChild variant="outline" className="h-12">
          <Link href="/app/plan" data-tour="plan-link">
            <CalendarDaysIcon className="size-4" aria-hidden />
            План недели
          </Link>
        </Button>
      </div>

      {templates.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">Мои тренировки</h2>
          <ul className="space-y-2">
            {templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-2 rounded-xl bg-card p-2 pl-4 ring-1 ring-foreground/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    ~{t.duration_min} мин · {t.exercises_order.length} упражнений
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  onClick={() => remove(t)}
                  disabled={busy !== null}
                  aria-label={`Удалить шаблон ${t.name}`}
                >
                  <Trash2Icon className="size-4" />
                </Button>
                <Button
                  size="icon"
                  className="size-11 shrink-0"
                  onClick={() => start(t)}
                  disabled={busy !== null}
                  aria-label={`Начать: ${t.name}`}
                >
                  {busy === t.id ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <PlayIcon className="size-4" />
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
