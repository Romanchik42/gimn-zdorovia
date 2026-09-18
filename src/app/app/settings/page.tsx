import { redirect } from "next/navigation";

import { ReminderSettings } from "@/components/settings/reminder-settings";
import {
  AppearanceSection,
  ProfileSection,
  SoundSection,
  TourResetButton,
} from "@/components/settings/settings-sections";
import { AuthorBlock } from "@/components/settings/author-block";
import { ShareButton } from "@/components/share/share-button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { linkUrl } from "@/lib/telegram/link";

export const metadata = { title: "Настройки — Гимн.здоровья" };

const MODE_LABELS: Record<string, string> = {
  behtereva: "Реабилитация Бехтерева",
  general: "Общая форма",
};

function safeLinkUrl(userId: string): string | null {
  try {
    return linkUrl(userId);
  } catch {
    // Бот ещё не настроен в окружении — кнопку привязки просто не показываем.
    return null;
  }
}

/** Настройки (SPEC 0.4): профиль, оформление, звук, напоминания, поделиться, об авторе. */
export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, email, mode, auto_theme, referral_code, reminders_enabled, morning_reminder_time, evening_reminder_time, telegram_id",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/welcome");

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

        <ProfileSection
          name={profile.name}
          email={profile.email ?? user.email ?? null}
          modeLabel={MODE_LABELS[profile.mode] ?? profile.mode}
        />

        <AppearanceSection autoTheme={profile.auto_theme} />

        <SoundSection />

        <ReminderSettings
          enabled={profile.reminders_enabled}
          morning={profile.morning_reminder_time}
          evening={profile.evening_reminder_time}
          telegramConnected={Boolean(profile.telegram_id)}
          telegramLinkUrl={profile.telegram_id ? null : safeLinkUrl(user.id)}
        />

        <div className="space-y-2">
          <ShareButton referralCode={profile.referral_code} appUrl={publicEnv.appUrl} variant="full" />
          <TourResetButton />
        </div>

        <AuthorBlock siteUrl={publicEnv.authorSiteUrl} />

        {/* Дисклеймер — сразу под блоком автора (SPEC 5.9, US-14). */}
        <MedicalDisclaimer />
      </div>
    </main>
  );
}
