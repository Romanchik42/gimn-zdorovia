import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EyeIcon, ChevronLeftIcon, UtensilsCrossedIcon, DumbbellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { buildModePreview } from "@/lib/modes/preview";
import { loadModes } from "@/lib/modes/server";
import { MODE_DESCRIPTIONS, MODE_LABELS, MODE_ONBOARDING_PATH, isMode } from "@/lib/modes";
import { MEAL_TYPE_LABELS } from "@/lib/schemas/nutrition";
import { focusLabel } from "@/lib/workout-engine/weekly-cycle";
import type { MealType } from "@/lib/supabase/types";

export const metadata = { title: "Режим просмотра — Гимн.здоровья" };

/**
 * Просмотр другого режима (GIMN-012, блок A2).
 *
 * Страница только читает справочники: показательная тренировка и меню
 * считаются на лету по усреднённому профилю. В БД не пишется ничего —
 * ни тренировки, ни меню, ни отметок.
 */
export default async function ModePreviewPage({ params }: PageProps<"/app/preview/[mode]">) {
  const { mode } = await params;
  if (!isMode(mode)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const modes = await loadModes(supabase, user.id);

  // Свой активный режим смотреть незачем — он и так открыт в приложении.
  if (modes.active.includes(mode)) redirect("/app");

  const preview = await buildModePreview(supabase, mode);
  if (!preview) notFound();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Назад">
            <Link href="/app/settings">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{MODE_LABELS[mode]}</h1>
            <p className="text-sm text-muted-foreground">Как это выглядит</p>
          </div>
        </header>

        <p
          className="flex items-start gap-2 rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground"
          role="status"
        >
          <EyeIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Режим просмотра — данные не сохраняются. Ваша программа не меняется.</span>
        </p>

        <p className="text-sm text-muted-foreground">{MODE_DESCRIPTIONS[mode]}</p>

        <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="flex items-center gap-2 font-medium">
            <DumbbellIcon className="size-4 text-primary" aria-hidden />
            Занятие на сегодня: {focusLabel(preview.focus)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {preview.exercises.length} упражнений, около {preview.durationMin} минут
          </p>
          <ol className="space-y-1.5 text-sm">
            {preview.exercises.map((e, i) => (
              <li key={e.exercise_id} className="flex gap-2">
                <span className="w-5 shrink-0 text-muted-foreground">{i + 1}.</span>
                <span>{e.name}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="flex items-center gap-2 font-medium">
            <UtensilsCrossedIcon className="size-4 text-primary" aria-hidden />
            Меню на день
          </h2>
          <ul className="space-y-1.5 text-sm">
            {preview.meals.map((m) => (
              <li key={m.meal_type} className="flex justify-between gap-3">
                <span className="text-muted-foreground">
                  {MEAL_TYPE_LABELS[m.meal_type as MealType]}
                </span>
                <span className="text-right">
                  {m.name} — {m.kcal} ккал
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Показано для средней нормы {preview.targetKcal} ккал. В своём режиме норма считается
            по вашей анкете.
          </p>
        </section>

        <Button asChild className="h-12 w-full">
          <Link href={`${MODE_ONBOARDING_PATH[mode]}?next=/app`}>Начать заниматься этим режимом</Link>
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Мы зададим несколько вопросов об этом режиме. Данные прежнего режима останутся на месте.
        </p>
      </div>
    </main>
  );
}
