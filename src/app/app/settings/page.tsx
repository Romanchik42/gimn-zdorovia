import { redirect } from "next/navigation";

import { ReminderSettings } from "@/components/settings/reminder-settings";
import {
  AppearanceSection,
  AvatarPicker,
  ProfileSection,
  SoundSection,
  TourResetButton,
  WorkoutLengthSection,
} from "@/components/settings/settings-sections";
import { AuthorBlock } from "@/components/settings/author-block";
import { ShareButton } from "@/components/share/share-button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { linkUrl } from "@/lib/telegram/link";
import { resolveWorkoutLength } from "@/lib/workout-engine/length";

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
      "name, email, phone, mode, auto_theme, referral_code, reminders_enabled, morning_reminder_time, evening_reminder_time, telegram_id, workout_length, avatar",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/welcome");

  // Длина по умолчанию зависит от диагностики: тяжёлая — короткое занятие.
  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("calculated_intensity")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const workoutLength = resolveWorkoutLength(profile.workout_length, profile.mode, diagnostics?.calculated_intensity);

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

        {/* Только почта, которую человек указал сам: у Telegram-аккаунтов в auth лежит служебный адрес. */}
        <ProfileSection
          name={profile.name}
          email={profile.email}
          phone={profile.phone}
          modeLabel={MODE_LABELS[profile.mode] ?? profile.mode}
        >
          <AvatarPicker value={profile.avatar} name={profile.name} />
        </ProfileSection>

        <WorkoutLengthSection value={workoutLength} isDefault={profile.workout_length === null} />

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
