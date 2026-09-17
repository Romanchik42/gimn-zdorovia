"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { REFERRAL_STORAGE_KEY } from "@/lib/referral/storage";

/**
 * Telegram Login Widget. Скрипт виджета грузится с telegram.org и вызывает
 * глобальный колбэк — поэтому он вешается на window, а не передаётся внутрь.
 */
declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.onTelegramAuth = async (user) => {
      setPending(true);
      try {
        let referralCode: string | null = null;
        try {
          referralCode = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
        } catch {
          // хранилище заблокировано — просто войдём без реферала
        }

        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...user, referral_code: referralCode ?? undefined }),
        });
        const json = await res.json();

        if (!json.success) {
          toast.error(json.error ?? "Не удалось войти через Telegram");
          return;
        }

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
    container.appendChild(script);

    return () => {
      container.replaceChildren();
      delete window.onTelegramAuth;
    };
  }, [botUsername, router]);

  return (
    <div className="flex min-h-[48px] items-center justify-center">
      {pending ? <Skeleton className="h-12 w-56 rounded-xl" /> : null}
      <div ref={containerRef} className={pending ? "hidden" : undefined} />
    </div>
  );
}
