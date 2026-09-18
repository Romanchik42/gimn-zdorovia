import Link from "next/link";
import { redirect } from "next/navigation";
import { WrenchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExerciseBrowser } from "@/components/exercise/exercise-browser";
import { createClient } from "@/lib/supabase/server";
import { loadCatalog } from "@/lib/workout-engine/catalog";

export const metadata = { title: "Каталог упражнений — Гимн.здоровья" };

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { exercises } = await loadCatalog(supabase, user.id);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Каталог</h1>
            <p className="text-sm text-muted-foreground">Все упражнения вашего режима</p>
          </div>
          <Button asChild variant="outline" className="h-11 shrink-0">
            <Link href="/app/workout/custom">
              <WrenchIcon className="size-4" aria-hidden />
              Собрать
            </Link>
          </Button>
        </header>

        <ExerciseBrowser exercises={exercises} />
      </div>
    </main>
  );
}
