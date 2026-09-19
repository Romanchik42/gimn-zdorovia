"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearReferralCode, readReferralCode, readReferralSource } from "@/lib/referral/storage";

/**
 * Вход в приложение, открытое кнопкой бота (Telegram Web App).
 *
 * Скрипт telegram-web-app.js отдаёт initData — строку, подписанную токеном
 * бота. Сервер проверяет подпись и открывает сессию, человек сразу попадает
 * на нужный экран. Если страницу открыли не из Telegram, initData пустой —
 * тогда предлагаем обычный вход.
 */

type TelegramWebApp = { initData: string; ready(): void; expand(): void };

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type State = { kind: "loading" } | { kind: "outside" } | { kind: "error"; message: string };

export function TelegramWebAppEntry({ next, referralCode }: { next: string; referralCode?: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const started = useRef(false);

  async function login() {
    if (started.current) return;
    started.current = true;

    const webApp = window.Telegram?.WebApp;
    if (!webApp?.initData) {
      setState({ kind: "outside" });
      return;
    }
    // Сразу говорим Telegram, что страница готова, и разворачиваем на весь экран.
    webApp.ready();
    webApp.expand();
    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/auth/telegram-webapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          init_data: webApp.initData,
          referral_code: referralCode ?? readReferralCode() ?? undefined,
          referral_source: referralCode ? "telegram" : (readReferralSource() ?? undefined),
        }),
      });
      const json = await res.json();

      if (!json.success) {
        started.current = false;
        setState({ kind: "error", message: json.error ?? "Не удалось войти через Telegram" });
        return;
      }

      if (json.data.is_new_user) clearReferralCode();
      router.replace(json.data.next_step === "app" ? next : "/onboarding/welcome");
      router.refresh();
    } catch {
      started.current = false;
      setState({ kind: "error", message: "Сеть недоступна. Попробуйте ещё раз." });
    }
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(next)}`;

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => void login()}
        onError={() => setState({ kind: "outside" })}
      />

      <div className="w-full max-w-sm space-y-4 text-center" aria-live="polite">
        {state.kind === "loading" ? (
          <p className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2Icon className="size-5 animate-spin" aria-hidden />
            Входим через Telegram…
          </p>
        ) : null}

        {state.kind === "error" ? (
          <>
            <p className="text-sm text-destructive">{state.message}</p>
            <Button className="h-12 w-full" onClick={() => void login()}>
              Попробовать ещё раз
            </Button>
            <Link href={loginHref} className="block text-sm text-muted-foreground underline-offset-4 hover:underline">
              Войти другим способом
            </Link>
          </>
        ) : null}

        {state.kind === "outside" ? (
          <>
            <p className="text-muted-foreground">
              Эта ссылка открывается из Telegram-бота. В браузере войдите обычным способом.
            </p>
            <Button asChild className="h-12 w-full">
              <Link href={loginHref}>Войти</Link>
            </Button>
          </>
        ) : null}
      </div>
    </>
  );
}
