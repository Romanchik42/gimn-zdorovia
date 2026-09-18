import Link from "next/link";

import { Button } from "@/components/ui/button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

export const metadata = { title: "Знакомство — Гимн.здоровья" };

/** Первый экран онбординга: расшифровка названия + дисклеймер до диагностики (SPEC 5.9). */
export default function WelcomePage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Гимн.здоровья</h1>
        <p className="text-muted-foreground">
          Это сокращение от <span className="text-foreground">«гимнастика для здоровья»</span>.
        </p>
      </header>

      <div className="space-y-3 rounded-xl bg-card p-5 text-sm leading-relaxed ring-1 ring-foreground/10">
        <p>
          Приложение собирает вам ежедневную программу: упражнения на подвижность,
          меню на день и отслеживание прогресса.
        </p>
        <p>
          Программа подстраивается: вы отмечаете, как прошло упражнение, а система
          меняет нагрузку. Раз в 30 дней — персональный отчёт.
        </p>
        <p className="text-muted-foreground">
          Сейчас зададим несколько вопросов, чтобы понять, с чего начать. Любой вопрос
          можно пропустить.
        </p>
      </div>

      <MedicalDisclaimer />

      <Button asChild size="lg" className="h-12 w-full">
        <Link href="/onboarding/mode">Понятно</Link>
      </Button>
    </div>
  );
}
