import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Сегодня — Гимн.здоровья" };

/**
 * Главный экран. На Этапе 3 — минимальная версия: показывает, что онбординг
 * дошёл до конца. Полноценный экран с карточкой «Сегодня» собирается на Этапе 4.
 */
export default async function AppHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, mode")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-10">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Здравствуйте{profile?.name ? `, ${profile.name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Настройка завершена. Программа тренировок появится здесь.
        </p>
      </div>
    </main>
  );
}
