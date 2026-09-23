import Image from "next/image";

import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { TelegramBotLink } from "@/components/auth/telegram-bot-link";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

/**
 * Лендинг-заглушка (Этап 1). Знак теперь готов, поэтому на месте прежнего
 * плейсхолдера с буквой «Г» стоит сам логотип (GIMN-026).
 *
 * Вход с главной (GIMN-023, GIMN-027): до этого на `/` не было ни одной
 * ссылки, и войти можно было только из бота или по приглашению `/i/КОД`.
 * Кто набирал адрес руками, упирался в заглушку.
 *
 * Кнопка ведёт прямо к боту, а не на `/auth/register`: регистрация и вход
 * здесь одно действие, и промежуточный экран только добавлял шаг. Под
 * кнопкой текстовая ссылка-страховка — на случай окружения, где t.me не
 * открывается по кнопке.
 */
export default function LandingPage() {
  // Имя бота читаем на сервере, чтобы не заводить лишнюю NEXT_PUBLIC-переменную.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gimn_zdorovia_bot";

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
          Реабилитация при болезни Бехтерева и поддержание формы.
        </p>

        <div className="w-full space-y-2 rounded-xl border border-info-border bg-info p-4 text-left text-sm text-info-foreground">
          <p className="font-medium">🎁 Идёт тестовый режим — приложение бесплатно для всех участников.</p>
          <p>
            За найденные баги и полезные идеи начисляем баллы: они продлят подписку после запуска
            платного тарифа.
          </p>
          <p className="text-muted-foreground">О запуске платного режима предупредим за 2 недели.</p>
        </div>

        <div className="w-full space-y-3 pt-2">
          <p className="text-sm font-medium text-muted-foreground">
            Выберите оформление
          </p>
          <ThemeSwitcher />
        </div>

        <div className="w-full space-y-3 pt-2">
          <TelegramLoginButton botUsername={botUsername} />
          <TelegramBotLink botUsername={botUsername} />
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
