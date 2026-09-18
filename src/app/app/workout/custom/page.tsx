import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { WorkoutBuilder } from "@/components/workout-builder/workout-builder";
import { createClient } from "@/lib/supabase/server";
import { loadCatalog } from "@/lib/workout-engine/catalog";

export const metadata = { title: "Своя тренировка — Гимн.здоровья" };

export default async function CustomWorkoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { exercises } = await loadCatalog(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-6">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="Назад">
            <Link href="/app">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">Своя тренировка</h1>
        </header>

        <WorkoutBuilder catalog={exercises} />
      </div>
    </main>
  );
}
