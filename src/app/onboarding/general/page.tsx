import { GeneralForm } from "@/components/onboarding/general-form";

export const metadata = { title: "Анкета — Гимн.здоровья" };

export default async function GeneralPage({ searchParams }: PageProps<"/onboarding/general">) {
  const { keep_mode } = await searchParams;
  return <GeneralForm keepMode={keep_mode === "1"} />;
}
