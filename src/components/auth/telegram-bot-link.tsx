"use client";

import { useSyncExternalStore } from "react";

import { readReferralCode } from "@/lib/referral/storage";

/**
 * Страховка под кнопкой входа (GIMN-027).
 *
 * Кнопка — ссылка на бота, и обычно её хватает. Но открыть t.me умеет не
 * всякое окружение: встроенный браузер внутри другого приложения, режим без
 * JS, корпоративный фильтр. Текстовая ссылка рядом стоит дёшево и остаётся
 * кликабельной там, где кнопка не сработала.
 *
 * Если человек пришёл по приглашению, код уходит боту в /start — иначе
 * запасной путь терял бы того, кто позвал.
 */

// Код приглашения лежит в localStorage и не меняется, пока открыта страница.
const subscribe = () => () => {};

export function TelegramBotLink({ botUsername }: { botUsername: string }) {
  const code = useSyncExternalStore(subscribe, readReferralCode, () => null);
  const href = `https://t.me/${botUsername}${code ? `?start=${code}` : ""}`;

  return (
    <p className="text-center text-sm text-muted-foreground">
      Кнопка не открылась?{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        Откройте бота в Telegram
      </a>
    </p>
  );
}
