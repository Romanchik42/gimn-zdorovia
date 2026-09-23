"use client";

import { useSyncExternalStore } from "react";
import { SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readReferralCode } from "@/lib/referral/storage";

/**
 * Кнопка входа через Telegram (GIMN-026).
 *
 * Было: официальный виджет telegram.org, который вставляет на страницу свой
 * iframe. Там, где telegram.org недоступен, iframe всё равно создаётся —
 * пустой, и на его месте оставался чёрный прямоугольник. Запасной путь при
 * этом не срабатывал: он проверял, появился ли iframe, а iframe появлялся
 * всегда, просто без содержимого.
 *
 * Стало: обычная ссылка на бота — она не зависит от доступности telegram.org
 * и не может отрисоваться пустым местом. В боте кнопка «Открыть приложение»
 * впускает сама (GIMN-010), так что для человека путь короче, чем был.
 *
 * Код приглашения уходит боту в /start, чтобы не терять, кто кого позвал.
 */

// Код приглашения лежит в localStorage и не меняется, пока открыта страница.
const subscribe = () => () => {};

export function TelegramLoginButton({ botUsername }: { botUsername: string }) {
  const code = useSyncExternalStore(subscribe, readReferralCode, () => null);
  const href = `https://t.me/${botUsername}${code ? `?start=${code}` : ""}`;

  return (
    <Button
      asChild
      size="lg"
      className="h-14 w-full bg-white text-base font-medium text-neutral-900 shadow-sm ring-1 ring-foreground/10 hover:bg-white hover:shadow-md"
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        <SendIcon className="size-5" aria-hidden />
        Войти через Telegram
      </a>
    </Button>
  );
}
