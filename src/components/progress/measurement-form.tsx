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

/** Подробные замеры: обхваты, состав тела, пульс покоя. Все необязательные. */
const DETAIL_FIELDS = [
  { name: "chest_cm", label: "Грудь, см", placeholder: "98" },
  { name: "waist_cm", label: "Талия, см", placeholder: "84" },
  { name: "hips_cm", label: "Бёдра, см", placeholder: "96" },
  { name: "bicep_cm", label: "Бицепс, см", placeholder: "34" },
  { name: "thigh_cm", label: "Бедро, см", placeholder: "56" },
  { name: "body_fat_pct", label: "Жир, %", placeholder: "18" },
  { name: "resting_hr", label: "Пульс покоя", placeholder: "62" },
] as const;

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
  // Обхваты и пульс свёрнуты: взвешиваются почти все, сантиметром себя
  // меряют немногие, и разворачивать это каждому — лишние семь полей.
  const [details, setDetails] = useState(false);
  const [girths, setGirths] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      weight_kg: toNumber(weight),
      shober_test_cm: showShober ? toNumber(shober) : null,
      stiffness_level: stiffness,
      ...Object.fromEntries(DETAIL_FIELDS.map(({ name }) => [name, toNumber(girths[name] ?? "")])),
      notes: note.trim() || null,
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
      // Предупреждение о скачке веса показываем отдельно: замер сохранён,
      // но значение стоит перепроверить.
      if (json.data?.warning) toast.warning(json.data.warning, { duration: 8000 });
      else toast.success("Замер сохранён");

      setWeight("");
      setShober("");
      setStiffness(null);
      setGirths({});
      setNote("");
      setDetails(false);
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

      <details open={details} onToggle={(e) => setDetails(e.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-medium select-none">
          Обхваты, процент жира и пульс
        </summary>
        <div className="gz-reveal space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            {DETAIL_FIELDS.map(({ name, label, placeholder }) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={`m-${name}`}>{label}</Label>
                <Input
                  id={`m-${name}`}
                  inputMode="decimal"
                  value={girths[name] ?? ""}
                  onChange={(e) => setGirths((g) => ({ ...g, [name]: e.target.value }))}
                  className="h-12"
                  placeholder={placeholder}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="m-notes">Заметка</Label>
            <Input
              id="m-notes"
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              className="h-12"
              placeholder="Мерил утром натощак"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Меряйте в одно и то же время — лучше утром, до еды. Иначе цифры скачут от воды и
            еды, а не от изменений в теле.
          </p>
        </div>
      </details>

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
