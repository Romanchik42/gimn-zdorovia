import { redirect } from "next/navigation";

import { NutritionView } from "@/components/nutrition/nutrition-view";
import { AppTour } from "@/components/tour/app-tour";
import { createClient } from "@/lib/supabase/server";
import { ensureWeekMenu, type WeekMenu } from "@/lib/nutrition-engine/service";
import { todayIso, weekStartOf } from "@/lib/dates";

export const metadata = { title: "Питание — Гимн.здоровья" };

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const today = todayIso();
  const weekStart = weekStartOf(today);

  // Меню обновляется понедельно: заходя в новую неделю, пользователь получает
  // свежее меню автоматически (US-07). Сборка идемпотентна.
  let menu: WeekMenu | null = null;
  try {
    menu = await ensureWeekMenu(supabase, user.id, weekStart);
  } catch (e) {
    console.error("nutrition page: menu failed", e);
  }

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        {/* Тур заходит на этот экран своим шагом (GIMN-029). */}
        <AppTour />

        <header className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Питание</h1>
          <p className="text-sm text-muted-foreground">
            Простые блюда из доступных продуктов, до 30 минут готовки
          </p>
        </header>

        {menu ? (
          <NutritionView
            today={today}
            weekStart={menu.weekStart}
            targetKcal={menu.targetKcal}
            isDefaultTarget={menu.isDefaultTarget}
            entries={menu.entries}
            shopping={menu.shopping}
          />
        ) : (
          <p className="rounded-xl bg-muted/50 p-6 text-center text-sm text-muted-foreground">
            Не получилось собрать меню. Попробуйте обновить страницу чуть позже.
          </p>
        )}
      </div>
    </main>
  );
}
