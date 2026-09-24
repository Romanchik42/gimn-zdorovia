import Image from "next/image";

import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { TelegramBotLink } from "@/components/auth/telegram-bot-link";
import { OtherLogins } from "@/components/auth/other-logins";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { isEmailConfigured } from "@/lib/auth/email-code";
import { isSmsConfigured } from "@/lib/auth/sms";
import { OAUTH_LABELS, OAUTH_PROVIDERS, isOAuthConfigured } from "@/lib/auth/oauth";

/**
 * Экран входа.
 *
 * Telegram — основной путь и единственный на виду (GIMN-026): одной
 * кнопкой в бота, где «Открыть приложение» впускает само. Виджета
 * telegram.org здесь нет — он вставлял пустой iframe там, где домен
 * недоступен, и вместо кнопки человек видел чёрный прямоугольник.
 *
 * Остальные способы — под свёрткой (GIMN-029). Telegram есть не у всех, и
 * человек, которому дали ссылку, упирался в единственную кнопку от
 * мессенджера, который он ставить не собирается.
 *
 * Что подключено, считается здесь, на сервере: ключи провайдеров дальше
 * сервера не уходят, а интерфейсу достаётся только «да» или «нет».
 */
export function TelegramAuthScreen({ title, subtitle }: { title: string; subtitle: string }) {
  // Имя бота читаем на сервере, чтобы не заводить лишнюю NEXT_PUBLIC-переменную.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gimn_zdorovia_bot";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/logo/logo-mark.svg"
            alt=""
            width={56}
            height={56}
            unoptimized
            className="rounded-2xl"
            priority
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
        </header>

        <div className="space-y-3">
          <TelegramLoginButton botUsername={botUsername} />
          <TelegramBotLink botUsername={botUsername} />
        </div>

        <OtherLogins
          available={{
            sms: isSmsConfigured(),
            email: isEmailConfigured(),
            oauth: OAUTH_PROVIDERS.map((provider) => ({
              provider,
              label: OAUTH_LABELS[provider],
              ready: isOAuthConfigured(provider),
            })),
          }}
        />

        <section className="space-y-2 rounded-xl border border-info-border bg-info p-4 text-sm text-info-foreground" aria-label="О приложении">
          <p className="font-medium">
            Гимн.здоровья — гимнастика для здоровья при болезни Бехтерева и для формы.
          </p>
          <p>
            Персональная программа на каждый день: упражнения с понятной техникой, меню и
            прогресс. Программа подстраивается под самочувствие — около 30 минут в день.
          </p>
        </section>

        <MedicalDisclaimer compact />
      </div>
    </main>
  );
}
