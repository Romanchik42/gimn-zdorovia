import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TelegramWebAppEntry } from "@/components/auth/telegram-webapp-entry";
import { createClient } from "@/lib/supabase/server";
import { clearWorkoutMessages } from "@/lib/telegram/chat";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";
import { safeNext } from "@/lib/navigation/safe-next";

export const metadata: Metadata = {
  title: "Гимн.здоровья",
  robots: { index: false, follow: false },
};

/**
 * /tg — вход для всех кнопок бота (Telegram Web App).
 * Сессия уже есть — сразу на нужный экран; нет — входим по initData.
 */
export default async function TelegramEntryPage({ searchParams }: PageProps<"/tg">) {
  const query = await searchParams;
  const next = safeNext(query.next);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    // Пришёл из бота с уже открытой сессией — убираем напоминания о тренировке.
    const { data: profile } = await supabase.from("users").select("telegram_id").eq("id", user.id).maybeSingle();
    if (profile?.telegram_id) {
      await clearWorkoutMessages(Number(profile.telegram_id)).catch((e) =>
        console.error("workout messages cleanup failed:", e),
      );
    }
    redirect(next);
  }

  const rawRef = typeof query.ref === "string" ? normalizeReferralCode(query.ref) : "";
  const referralCode = isValidReferralCode(rawRef) ? rawRef : undefined;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <TelegramWebAppEntry next={next} referralCode={referralCode} />
    </main>
  );
}
