"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { INTENSITIES, INTENSITY_LABELS } from "@/lib/schemas/workout";
import {
  PLAN_FOCUSES,
  dayName,
  focusLabel,
  validateWeekPlan,
  type WeekPlanDay,
} from "@/lib/workout-engine/weekly-cycle";
import type { Mode } from "@/lib/supabase/types";
import { cn } from "cn";

export type PlanDay = WeekPlanDay & { is_custom: boolean };

const PLAN_DURATIONS = [10, 15, 20, 30, 35, 40, 45, 60] as const;

/**
 * Редактор недельного плана (US-06).
 * Предупреждения считаются на лету той же функцией, что и на сервере, —
 * но ничего не блокируют: план принадлежит пользователю.
 */
export function PlanEditor({ mode, initial }: { mode: Mode; initial: PlanDay[] }) {
  const router = useRouter();
  const [days, setDays] = useState<PlanDay[]>(initial);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const warnings = useMemo(() => validateWeekPlan(days), [days]);
  const dirty = useMemo(() => JSON.stringify(days) !== JSON.stringify(initial), [days, initial]);

  function patch(day: number, next: Partial<PlanDay>) {
    setDays((prev) => prev.map((d) => (d.day_of_week === day ? { ...d, ...next } : d)));
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/plan/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          days: days.map(({ day_of_week, focus, duration_min, intensity, is_rest_day }) => ({
            day_of_week,
            focus,
            duration_min,
            intensity,
            is_rest_day,
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить план");
        return;
      }
      toast.success("План сохранён. Изменения применятся со следующей тренировки.");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setResetting(true);
    try {
      const res = await fetch("/api/plan/reset", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось вернуть план");
        return;
      }
      setDays((json.data.days as WeekPlanDay[]).map((d) => ({ ...d, is_custom: false })));
      toast.success("Вернули рекомендуемый план");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="space-y-4">
      {warnings.length > 0 ? (
        <div className="space-y-1.5 rounded-xl bg-accent/12 p-3" role="status">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-sm">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
              {w}
            </p>
          ))}
          <p className="pl-6 text-xs text-muted-foreground">Это подсказка — сохранить можно и так.</p>
        </div>
      ) : null}

      <ul className="space-y-2">
        {days.map((d) => (
          <li
            key={d.day_of_week}
            className={cn(
              "space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10",
              d.is_rest_day && "bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{dayName(d.day_of_week, true)}</span>
                {!d.is_custom && mode === "behtereva" ? (
                  <Badge variant="secondary">Рекомендовано</Badge>
                ) : null}
              </div>
              <label className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground">
                Отдых
                <Switch
                  checked={d.is_rest_day}
                  onCheckedChange={(checked) => patch(d.day_of_week, { is_rest_day: checked })}
                  aria-label={`${dayName(d.day_of_week, true)}: день отдыха`}
                />
              </label>
            </div>

            {d.is_rest_day ? (
              <p className="text-sm text-muted-foreground">
                Только дыхание и лёгкая растяжка.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Field label="Фокус">
                  <select
                    value={d.focus}
                    onChange={(e) => patch(d.day_of_week, { focus: e.target.value })}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {/* Фокус из старого плана мог выпасть из списка режима — не теряем его. */}
                    {[...new Set([d.focus, ...PLAN_FOCUSES[mode]])].map((f) => (
                      <option key={f} value={f}>
                        {focusLabel(f)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Длительность">
                  <select
                    value={d.duration_min}
                    onChange={(e) => patch(d.day_of_week, { duration_min: Number(e.target.value) })}
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {[...new Set([d.duration_min, ...PLAN_DURATIONS])]
                      .sort((a, b) => a - b)
                      .map((m) => (
                        <option key={m} value={m}>
                          {m} мин
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Нагрузка">
                  <select
                    value={d.intensity}
                    onChange={(e) =>
                      patch(d.day_of_week, { intensity: e.target.value as PlanDay["intensity"] })
                    }
                    className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {INTENSITIES.map((i) => (
                      <option key={i} value={i}>
                        {INTENSITY_LABELS[i]}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="sticky bottom-16 space-y-2 bg-background/90 py-2 backdrop-blur">
        <Button size="lg" className="h-12 w-full" onClick={save} disabled={saving || !dirty}>
          {saving ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Сохранить план
        </Button>
        <Button variant="ghost" className="h-11 w-full" onClick={reset} disabled={resetting}>
          {resetting ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-4" aria-hidden />
          )}
          Вернуть рекомендуемый план
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
