import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PlanEditor, type PlanDay } from "@/components/plan/plan-editor";
import { createClient } from "@/lib/supabase/server";
import { currentMode } from "@/lib/modes/server";
import { DEFAULT_WEEK_PLAN } from "@/lib/workout-engine/weekly-cycle";

export const metadata = { title: "Недельный план — Гимн.здоровья" };

export default async function PlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const mode = await currentMode(supabase, user.id);

  const { data: rows } = await supabase
    .from("user_week_plan")
    .select("day_of_week, focus, duration_min, intensity, is_rest_day, is_custom")
    .eq("user_id", user.id)
    .eq("mode", mode)
    .order("day_of_week");

  // Плана ещё нет (онбординг прерван) — показываем рекомендуемый; сохранение его создаст.
  const byDay = new Map((rows ?? []).map((r) => [r.day_of_week, r]));
  const days: PlanDay[] = DEFAULT_WEEK_PLAN[mode].map((def) => {
    const row = byDay.get(def.day_of_week);
    return row
      ? {
          day_of_week: row.day_of_week,
          focus: row.focus,
          duration_min: row.duration_min,
          intensity: row.intensity,
          is_rest_day: row.is_rest_day,
          is_custom: row.is_custom,
        }
      : { ...def, is_custom: false };
  });

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Назад">
            <Link href="/app">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Недельный план</h1>
            <p className="text-sm text-muted-foreground">Какая группа мышц в какой день</p>
          </div>
        </header>

        <PlanEditor mode={mode} initial={days} />
      </div>
    </main>
  );
}
