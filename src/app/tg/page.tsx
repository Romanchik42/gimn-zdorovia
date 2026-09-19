import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TelegramWebAppEntry } from "@/components/auth/telegram-webapp-entry";
import { getSessionUser } from "@/lib/supabase/server";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";

export const metadata: Metadata = {
  title: "Гимн.здоровья",
  robots: { index: false, follow: false },
};

/** Только свои пути: «//evil.com» или полный URL увели бы человека с сайта. */
function safeNext(value: string | string[] | undefined): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/app";
}

/**
 * /tg — вход для всех кнопок бота (Telegram Web App).
 * Сессия уже есть — сразу на нужный экран; нет — входим по initData.
 */
export default async function TelegramEntryPage({ searchParams }: PageProps<"/tg">) {
  const query = await searchParams;
  const next = safeNext(query.next);

  const user = await getSessionUser();
  if (user) redirect(next);

  const rawRef = typeof query.ref === "string" ? normalizeReferralCode(query.ref) : "";
  const referralCode = isValidReferralCode(rawRef) ? rawRef : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <TelegramWebAppEntry next={next} referralCode={referralCode} />
    </main>
  );
}
