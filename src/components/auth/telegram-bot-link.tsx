"use client";

import { useSyncExternalStore } from "react";

import { readReferralCode } from "@/lib/referral/storage";

// Код приглашения живёт в localStorage и не меняется, пока открыта страница.
const subscribe = () => () => {};

/**
 * Запасной вход: открыть бота в Telegram. Если человек пришёл по
 * приглашению, код уходит боту в /start — приглашение не теряется.
 */
export function TelegramBotLink({ botUsername }: { botUsername: string }) {
  const code = useSyncExternalStore(subscribe, readReferralCode, () => null);
  const href = `https://t.me/${botUsername}${code ? `?start=${code}` : ""}`;

  return (
    <p className="text-center text-sm text-muted-foreground">
      Кнопка не появилась?{" "}
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
