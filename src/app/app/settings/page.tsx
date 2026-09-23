import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ClipboardListIcon, DumbbellIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ReminderSettings } from "@/components/settings/reminder-settings";
import {
  AppearanceSection,
  Section,
  AvatarPicker,
  ProfileSection,
  SoundSection,
  TourResetButton,
  WorkoutLengthSection,
} from "@/components/settings/settings-sections";
import { AuthorBlock } from "@/components/settings/author-block";
import { CustomColorsSection, InfoTintSection } from "@/components/settings/appearance-builder";
import { FeedbackSection } from "@/components/settings/feedback-section";
import { ModesSection } from "@/components/settings/modes-section";
import { ShareButton } from "@/components/share/share-button";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { linkUrl } from "@/lib/telegram/link";
import { resolveWorkoutLength } from "@/lib/workout-engine/length";
import { loadModes } from "@/lib/modes/server";
import { MODE_LABELS } from "@/lib/modes";
import { HAS_TURNIK_LABELS } from "@/lib/workout-engine/equipment";
import type { HasTurnik } from "@/lib/supabase/types";

export const metadata = { title: "Настройки — Гимн.здоровья" };

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

  const modes = await loadModes(supabase, user.id);

  const { data: profile } = await supabase
    .from("users")
    .select(
      "name, email, phone, mode, auto_theme, referral_code, reminders_enabled, morning_reminder_time, evening_reminder_time, telegram_id, workout_length, avatar, avatar_url, custom_theme, info_card_tint",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding/welcome");

  // Длина по умолчанию зависит от диагностики: тяжёлая — короткое занятие.
  const { data: diagnostics } = await supabase
    .from("user_diagnostics")
    .select("calculated_intensity, extended_completed_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const workoutLength = resolveWorkoutLength(profile.workout_length, modes.current, diagnostics?.calculated_intensity);

  // Анкета общего режима: её открывают повторно, чтобы сменить цель, уровень
  // или ответ про турник. Показываем только тем, кто этим режимом занимается.
  const { data: generalProfile } = modes.active.includes("general")
    ? await supabase
        .from("user_profiles_general")
        .select("has_turnik")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

        {/* Только почта, которую человек указал сам: у Telegram-аккаунтов в auth лежит служебный адрес. */}
        <ProfileSection
          name={profile.name}
          email={profile.email}
          phone={profile.phone}
          modeLabel={MODE_LABELS[modes.current]}
        >
          <AvatarPicker value={profile.avatar} name={profile.name} photoUrl={profile.avatar_url} />
        </ProfileSection>

        <ModesSection current={modes.current} active={modes.active} />

        <WorkoutLengthSection value={workoutLength} isDefault={profile.workout_length === null} />

        {diagnostics ? (
          <Section
            icon={<ClipboardListIcon className="size-4 text-primary" aria-hidden />}
            title="Углублённая диагностика"
          >
            <p className="text-sm text-muted-foreground">
              {diagnostics.extended_completed_at
                ? `Пройдена ${format(new Date(diagnostics.extended_completed_at), "d MMMM", { locale: ru })}. Если самочувствие изменилось — пройдите заново.`
                : "Несколько вопросов о положениях тела и подвижности — подбор станет точнее."}
            </p>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href="/onboarding/extended?next=/app/settings">
                {diagnostics.extended_completed_at ? "Пройти заново" : "Пройти"}
              </Link>
            </Button>
          </Section>
        ) : null}

        {generalProfile ? (
          <Section
            icon={<DumbbellIcon className="size-4 text-primary" aria-hidden />}
            title="Анкета общего режима"
          >
            <p className="text-sm text-muted-foreground">
              Цель, уровень подготовки, дни занятий и турник. Турник сейчас:{" "}
              {HAS_TURNIK_LABELS[(generalProfile.has_turnik as HasTurnik) ?? "no"].toLowerCase()}.
            </p>
            <Button asChild variant="outline" className="h-11 w-full">
              <Link href="/onboarding/general?next=/app/settings">Изменить ответы</Link>
            </Button>
          </Section>
        ) : null}

        <AppearanceSection autoTheme={profile.auto_theme} />
        <CustomColorsSection initial={profile.custom_theme} />
        <InfoTintSection initial={profile.info_card_tint} />

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

        <FeedbackSection />

        <AuthorBlock siteUrl={publicEnv.authorSiteUrl} />

        {/* Дисклеймер — сразу под блоком автора (SPEC 5.9, US-14). */}
        <MedicalDisclaimer />
      </div>
    </main>
  );
}
