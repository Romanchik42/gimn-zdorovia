"use client";

import { useEffect } from "react";

import { rememberReferralCode, type StoredReferralSource } from "@/lib/referral/storage";

/**
 * Запоминает код приглашения и фиксирует переход (SPEC 5.7).
 * Один переход — одна запись: обновление страницы клик не удваивает.
 */
export function InviteTracker({ code, source }: { code: string; source: StoredReferralSource }) {
  useEffect(() => {
    rememberReferralCode(code, source);

    const onceKey = `gz-ref-tracked:${code}`;
    try {
      if (window.sessionStorage.getItem(onceKey)) return;
      window.sessionStorage.setItem(onceKey, "1");
    } catch {
      // без sessionStorage просто посчитаем ещё раз — не страшно
    }

    void fetch("/api/referral/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, source }),
    }).catch(() => {
      // статистика не должна мешать приглашённому открыть приложение
    });
  }, [code, source]);

  return null;
}
