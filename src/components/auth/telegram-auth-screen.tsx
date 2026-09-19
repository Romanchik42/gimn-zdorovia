import Image from "next/image";

import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { TelegramBotLink } from "@/components/auth/telegram-bot-link";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

/**
 * Экран входа. Вход — только через Telegram (GIMN-010): ни почты, ни пароля.
 * Почту и телефон человек при желании оставляет в профиле — для связи.
 *
 * Официальный виджет работает в браузере; если он не загрузился (блокировка
 * telegram.org, встроенный браузер) — запасной путь через бота: там кнопка
 * «Открыть приложение», и вход происходит сам.
 */
export function TelegramAuthScreen({ title, subtitle }: { title: string; subtitle: string }) {
  // Имя бота читаем на сервере, чтобы не заводить лишнюю NEXT_PUBLIC-переменную.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gimn_zdorovia_bot";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo/logo-mark.svg" alt="" width={56} height={56} className="rounded-2xl" priority />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </header>

        <div className="space-y-3">
          <TelegramLoginButton botUsername={botUsername} />
          <TelegramBotLink botUsername={botUsername} />
        </div>

        <section className="space-y-2 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10" aria-label="О приложении">
          <p className="font-medium">
            Гимн.здоровья — гимнастика для здоровья при болезни Бехтерева и для формы.
          </p>
          <p className="text-muted-foreground">
            Персональная программа на каждый день: упражнения с понятной техникой, меню и
            прогресс. Программа подстраивается под самочувствие — около 30 минут в день.
          </p>
        </section>

        <MedicalDisclaimer compact />
      </div>
    </main>
  );
}
