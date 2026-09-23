import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

/**
 * Лендинг-заглушка (Этап 1). Знак теперь готов, поэтому на месте прежнего
 * плейсхолдера с буквой «Г» стоит сам логотип (GIMN-026).
 *
 * Вход с главной (GIMN-023): до этого на `/` не было ни одной ссылки, и войти
 * можно было только из бота или по приглашению `/i/КОД`. Кто набирал адрес
 * руками, упирался в заглушку. Кнопки — той же формы, что на странице
 * приглашения: вход и регистрация здесь одно действие, аккаунт заводится
 * при первом входе через Telegram.
 */
export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-between gap-10 px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        {/* next/image не отдаёт SVG без dangerouslyAllowSVG — просим не оптимизировать. */}
        <Image
          src="/logo/logo-mark.svg"
          alt=""
          width={64}
          height={64}
          unoptimized
          priority
          className="rounded-2xl"
        />

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

        <div className="flex w-full flex-col items-center gap-3 pt-2">
          <Button asChild size="lg" className="h-14 w-full max-w-xs text-base">
            <Link href="/auth/register">Начать</Link>
          </Button>
          <Link
            href="/auth/login"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Уже есть аккаунт? Войти
          </Link>
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
