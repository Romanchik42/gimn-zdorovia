import { redirect } from "next/navigation";

import { ExtendedWizard } from "@/components/onboarding/extended-wizard";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/navigation/safe-next";
import type { ExtendedAnswers } from "@/lib/diagnostics/extended";

export const metadata = { title: "Уточнить подбор — Гимн.здоровья" };

/**
 * Углублённая диагностика (GIMN-011). Приходят сюда из онбординга после
 * базовой диагностики и из настроек — поэтому куда вернуться, задаёт next.
 */
export default async function ExtendedDiagnosticsPage({ searchParams }: PageProps<"/onboarding/extended">) {
  const next = safeNext((await searchParams).next, "/onboarding/theme");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("extended_answers")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Без базовой диагностики уточнять нечего.
  if (!diagnostics) redirect("/onboarding/behtereva");

  return <ExtendedWizard next={next} initial={(diagnostics.extended_answers as ExtendedAnswers | null) ?? null} />;
}
