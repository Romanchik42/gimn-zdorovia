import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

/**
 * Лендинг-заглушка (Этап 1). Логотип намеренно не рисуем —
 * на его месте нейтральный плейсхолдер до готовности знака (БЛОК 7).
 */
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-between gap-10 px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        {/* плейсхолдер логотипа */}
        <div
          aria-hidden
          className="flex size-16 items-center justify-center rounded-2xl bg-primary/15 text-2xl font-semibold text-primary"
        >
          Г
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Гимн.здоровья
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            гимнастика для здоровья
          </p>
        </div>

        <p className="text-pretty text-muted-foreground">
          Реабилитация при болезни Бехтерева и поддержание формы. Скоро открытие.
        </p>

        <div className="w-full space-y-3 pt-2">
          <p className="text-sm font-medium text-muted-foreground">
            Выберите оформление
          </p>
          <ThemeSwitcher />
        </div>
      </div>

      <footer className="w-full max-w-md space-y-4">
        <MedicalDisclaimer compact />
        <p className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Гимн.здоровья
        </p>
      </footer>
    </main>
  );
}
