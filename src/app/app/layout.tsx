import Script from "next/script";

import { BottomNav } from "@/components/layout/bottom-nav";
import { SoundProvider } from "@/components/layout/sound-provider";
import { ThemeSync } from "@/components/layout/theme-sync";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SOUND_PACK, type SoundPackId } from "@/lib/sound/sound-packs";

/**
 * Каркас приложения (SPEC 4.1). ThemeProvider живёт в корневом layout — он
 * нужен и лендингу, и онбордингу; здесь — звук, синхронизация темы с
 * профилем и нижняя навигация. Туры запускаются на своих страницах: им нужны
 * конкретные элементы экрана.
 */
export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("users")
        .select("theme, auto_theme, sounds_enabled, sound_pack, sound_volume, custom_theme, info_card_tint")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };

  const sound = {
    enabled: profile?.sounds_enabled ?? true,
    pack: (profile?.sound_pack ?? DEFAULT_SOUND_PACK) as SoundPackId,
    volume: profile?.sound_volume ?? 70,
  };

  return (
    <SoundProvider initial={sound}>
      <ThemeSync
        dbTheme={profile?.theme ?? null}
        autoTheme={profile?.auto_theme ?? false}
        customTheme={profile?.custom_theme ?? null}
        infoTint={profile?.info_card_tint ?? "neutral"}
      />
      {/* Внутри Telegram даёт «Отправить» через выбор чата; в браузере ничего не делает. */}
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="lazyOnload" />
      <div className="flex min-h-full flex-1 flex-col">
        <div className="flex flex-1 flex-col">{children}</div>
        <BottomNav />
      </div>
    </SoundProvider>
  );
}
