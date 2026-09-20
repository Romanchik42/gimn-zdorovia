import { BehterevaWizard } from "@/components/onboarding/behtereva-wizard";
import { safeNext } from "@/lib/navigation/safe-next";

export const metadata = { title: "Диагностика — Гимн.здоровья" };

export default async function BehterevaPage({ searchParams }: PageProps<"/onboarding/behtereva">) {
  const { next } = await searchParams;
  return <BehterevaWizard afterDone={safeNext(next, "/onboarding/theme")} />;
}
