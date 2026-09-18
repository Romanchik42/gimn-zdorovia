import { redirect } from "next/navigation";

import { ReminderSettings } from "@/components/settings/reminder-settings";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { createClient } from "@/lib/supabase/server";
import { linkUrl } from "@/lib/telegram/link";

export const metadata = { title: "Настройки — Гимн.здоровья" };

function safeLinkUrl(userId: string): string | null {
  try {
    return linkUrl(userId);
  } catch {
    // Бот ещё не настроен в окружении — кнопку привязки просто не показываем.
    return null;
  }
}

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("users")
    .select("reminders_enabled, morning_reminder_time, evening_reminder_time, telegram_id")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

        <ReminderSettings
          enabled={profile?.reminders_enabled ?? true}
          morning={profile?.morning_reminder_time ?? "07:00"}
          evening={profile?.evening_reminder_time ?? "18:00"}
          telegramConnected={Boolean(profile?.telegram_id)}
          telegramLinkUrl={profile?.telegram_id ? null : safeLinkUrl(user.id)}
        />

        <MedicalDisclaimer />
      </div>
    </main>
  );
}
