"use client";

import * as React from "react";

import { soundPlayer } from "@/lib/sound/player";
import type { SoundEvent, SoundPackId } from "@/lib/sound/sound-packs";

type SoundSettings = { enabled: boolean; pack: SoundPackId; volume: number };

type SoundContextValue = SoundSettings & {
  play: (event: SoundEvent) => void;
  /** Для «▶ Послушать»: играет любой набор, даже не сохранённый (US-10). */
  preview: (pack: SoundPackId, volume?: number) => void;
  update: (patch: Partial<SoundSettings>) => void;
};

const SoundContext = React.createContext<SoundContextValue | null>(null);

/**
 * Настройки звука живут в БД; провайдер получает их с сервера и держит
 * локальную копию, чтобы правка на странице настроек звучала сразу.
 */
export function SoundProvider({
  initial,
  children,
}: {
  initial: SoundSettings;
  children: React.ReactNode;
}) {
  const [settings, setSettings] = React.useState(initial);

  React.useEffect(() => {
    if (settings.enabled) soundPlayer.preload(settings.pack);
  }, [settings.enabled, settings.pack]);

  const value = React.useMemo<SoundContextValue>(
    () => ({
      ...settings,
      play: (event) => {
        if (settings.enabled) soundPlayer.play(settings.pack, event, settings.volume);
      },
      preview: (pack, volume) => soundPlayer.play(pack, "done", volume ?? settings.volume),
      update: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    }),
    [settings],
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

/** Вне провайдера (например, на лендинге) звук просто молчит. */
export function useSound(): SoundContextValue {
  const ctx = React.useContext(SoundContext);
  return (
    ctx ?? {
      enabled: false,
      pack: "none",
      volume: 0,
      play: () => {},
      preview: () => {},
      update: () => {},
    }
  );
}
