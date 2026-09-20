import { GeneralForm } from "@/components/onboarding/general-form";
import { safeNext } from "@/lib/navigation/safe-next";

export const metadata = { title: "Анкета — Гимн.здоровья" };

export default async function GeneralPage({ searchParams }: PageProps<"/onboarding/general">) {
  const { keep_mode, next } = await searchParams;
  return <GeneralForm keepMode={keep_mode === "1"} next={safeNext(next, "/onboarding/theme")} />;
}
