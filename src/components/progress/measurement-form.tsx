"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { measurementSchema } from "@/lib/schemas/progress";
import { cn } from "cn";

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Быстрый замер: вес, тест Шобера, скованность. Любое поле необязательно. */
export function MeasurementForm({ showShober }: { showShober: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [weight, setWeight] = useState("");
  const [shober, setShober] = useState("");
  const [stiffness, setStiffness] = useState<number | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      weight_kg: toNumber(weight),
      shober_test_cm: showShober ? toNumber(shober) : null,
      stiffness_level: stiffness,
    };

    // Та же схема, что на сервере, — ошибку показываем до запроса.
    const check = measurementSchema.safeParse(payload);
    if (!check.success) {
      toast.error(check.error.issues[0]?.message ?? "Проверьте значения");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/progress/measure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить замер");
        return;
      }
      toast.success("Замер сохранён");
      setWeight("");
      setShober("");
      setStiffness(null);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="h-12 w-full" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" aria-hidden />
        Добавить замер
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-medium">Замер за сегодня</h2>

      <div className={cn("grid gap-3", showShober ? "grid-cols-2" : "grid-cols-1")}>
        <div className="space-y-2">
          <Label htmlFor="m-weight">Вес, кг</Label>
          <Input
            id="m-weight"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className="h-12"
            placeholder="72,5"
          />
        </div>
        {showShober ? (
          <div className="space-y-2">
            <Label htmlFor="m-shober">Тест Шобера, см</Label>
            <Input
              id="m-shober"
              inputMode="decimal"
              value={shober}
              onChange={(e) => setShober(e.target.value)}
              className="h-12"
              placeholder="4,5"
            />
          </div>
        ) : null}
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Скованность утром, 1-10</legend>
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={stiffness === n}
              onClick={() => setStiffness(stiffness === n ? null : n)}
              className={cn(
                "min-h-11 rounded-lg border text-sm font-medium transition-colors",
                stiffness === n
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">1 — почти нет, 10 — очень сильная</p>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="ghost" className="h-12" onClick={() => setOpen(false)}>
          Отмена
        </Button>
        <Button type="submit" className="h-12" disabled={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Сохранить
        </Button>
      </div>
    </form>
  );
}
