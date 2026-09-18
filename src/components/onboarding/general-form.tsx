"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  ACTIVITY_LABELS,
  ACTIVITY_LEVELS,
  DIFFICULTIES,
  DIFFICULTY_LABELS,
  GOALS,
  GOAL_LABELS,
  generalProfileSchema,
  type GeneralProfileInput,
} from "@/lib/schemas/diagnostics";
import { DAY_NAMES } from "@/lib/workout-engine/weekly-cycle";
import { cn } from "cn";

export function GeneralForm({ keepMode = false }: { keepMode?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const form = useForm<GeneralProfileInput>({
    resolver: zodResolver(generalProfileSchema),
    defaultValues: {
      gender: "male",
      age_years: 30,
      weight_kg: 70,
      height_cm: 175,
      goal: "maintain",
      activity_level: "medium",
      difficulty: "beginner",
      training_days: [1, 3, 5],
    },
  });

  async function onSubmit(values: GeneralProfileInput) {
    setPending(true);
    try {
      const res = await fetch("/api/onboarding/general", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, keep_mode: keepMode }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить анкету");
        return;
      }

      toast.success(`Ваша норма: ${json.data.target_calories} ккал в день`);
      // Пришли из «Питания» — возвращаем туда: меню пересоберётся под новую норму.
      router.push(keepMode ? "/app/nutrition" : "/onboarding/theme");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">Немного о вас</h1>
          <p className="text-sm text-muted-foreground">
            Нужно, чтобы посчитать норму калорий и подобрать нагрузку.
          </p>
        </header>

        <FormField
          control={form.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пол</FormLabel>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["male", "Мужской"],
                    ["female", "Женский"],
                  ] as const
                ).map(([value, label]) => (
                  <ChoiceButton
                    key={value}
                    active={field.value === value}
                    onClick={() => field.onChange(value)}
                  >
                    {label}
                  </ChoiceButton>
                ))}
              </div>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-3 gap-3">
          <NumField control={form.control} name="age_years" label="Возраст" />
          <NumField control={form.control} name="weight_kg" label="Вес, кг" step="0.1" />
          <NumField control={form.control} name="height_cm" label="Рост, см" step="0.1" />
        </div>

        <FormField
          control={form.control}
          name="goal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Цель</FormLabel>
              <div className="space-y-2">
                {GOALS.map((value) => (
                  <ChoiceButton
                    key={value}
                    active={field.value === value}
                    onClick={() => field.onChange(value)}
                    full
                  >
                    {GOAL_LABELS[value]}
                  </ChoiceButton>
                ))}
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="activity_level"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Активность в быту</FormLabel>
              <div className="space-y-2">
                {ACTIVITY_LEVELS.map((value) => (
                  <ChoiceButton
                    key={value}
                    active={field.value === value}
                    onClick={() => field.onChange(value)}
                    full
                  >
                    {ACTIVITY_LABELS[value]}
                  </ChoiceButton>
                ))}
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="difficulty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Уровень подготовки</FormLabel>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTIES.map((value) => (
                  <ChoiceButton
                    key={value}
                    active={field.value === value}
                    onClick={() => field.onChange(value)}
                  >
                    {DIFFICULTY_LABELS[value]}
                  </ChoiceButton>
                ))}
              </div>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="training_days"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дни для тренировок</FormLabel>
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_NAMES.map((label, index) => {
                  const day = index + 1;
                  const active = field.value.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        field.onChange(
                          active
                            ? field.value.filter((d) => d !== day)
                            : [...field.value, day].sort((a, b) => a - b),
                        )
                      }
                      className={cn(
                        "min-h-12 rounded-lg border text-sm font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:bg-muted",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="lg" className="h-12 w-full" disabled={pending}>
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
          Продолжить
        </Button>
      </form>
    </Form>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
  full,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        full ? "w-full text-left" : "",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function NumField({
  control,
  name,
  label,
  step,
}: {
  control: ReturnType<typeof useForm<GeneralProfileInput>>["control"];
  name: "age_years" | "weight_kg" | "height_cm";
  label: string;
  step?: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              inputMode="decimal"
              step={step}
              className="h-12"
              {...field}
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
