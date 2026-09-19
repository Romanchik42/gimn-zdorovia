"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { clearReferralCode, readReferralCode, readReferralSource } from "@/lib/referral/storage";

/**
 * Telegram Login Widget. Скрипт виджета грузится с telegram.org и вызывает
 * глобальный колбэк — поэтому он вешается на window, а не передаётся внутрь.
 *
 * Если telegram.org недоступен или виджет не отрисовался за WIDGET_TIMEOUT_MS,
 * вместо пустого места показываем кнопку «Войти через Telegram» — она
 * открывает бота, а там кнопка приложения входит сама (GIMN-010).
 */
declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

const WIDGET_TIMEOUT_MS = 5000;

export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [widgetFailed, setWidgetFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.onTelegramAuth = async (user) => {
      setPending(true);
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...user,
            referral_code: readReferralCode() ?? undefined,
            referral_source: readReferralSource() ?? undefined,
          }),
        });
        const json = await res.json();

        if (!json.success) {
          toast.error(json.error ?? "Не удалось войти через Telegram");
          return;
        }

        if (json.data.is_new_user) clearReferralCode();
        router.replace(json.data.next_step === "app" ? "/app" : "/onboarding/welcome");
        router.refresh();
      } catch {
        toast.error("Сеть недоступна. Попробуйте ещё раз.");
      } finally {
        setPending(false);
      }
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-radius", "12");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.onerror = () => setWidgetFailed(true);
    container.appendChild(script);

    // Виджет — это iframe; не появился вовремя — считаем, что telegram.org недоступен.
    const timer = setTimeout(() => {
      if (!container.querySelector("iframe")) setWidgetFailed(true);
    }, WIDGET_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      container.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botUsername, router]);

  if (widgetFailed) {
    const code = readReferralCode();
    return (
      <Button asChild size="lg" className="h-12 w-full">
        <a href={`https://t.me/${botUsername}${code ? `?start=${code}` : ""}`} target="_blank" rel="noopener noreferrer">
          <SendIcon className="size-4" aria-hidden />
          Войти через Telegram
        </a>
      </Button>
    );
  }

  return (
    <div className="flex min-h-[48px] items-center justify-center">
      {pending ? <Skeleton className="h-12 w-56 rounded-xl" /> : null}
      <div ref={containerRef} className={pending ? "hidden" : undefined} />
    </div>
  );
}
