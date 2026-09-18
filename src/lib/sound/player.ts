import {
  SOUND_EVENTS,
  isPlayable,
  soundUrl,
  type PlayablePack,
  type SoundEvent,
  type SoundPackId,
} from "@/lib/sound/sound-packs";

/**
 * Проигрыватель на Web Audio API (SPEC 5.6).
 *
 * - AudioContext создаётся лениво, внутри жеста пользователя (так требуют браузеры).
 * - Файлы набора скачиваются заранее, декодируются при первом проигрывании.
 * - Любая ошибка — молча пропускаем звук, интерфейс не ломаем.
 * - audioSession «ambient» (Safari 16.4+): звук уважает беззвучный режим iPhone
 *   и не останавливает музыку, которую пользователь включил сам.
 */

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

class SoundPlayer {
  private ctx: AudioContext | null = null;
  private raw = new Map<string, Promise<ArrayBuffer | null>>();
  private decoded = new Map<string, AudioBuffer>();

  /** Скачать файлы набора заранее — без AudioContext, чтобы не требовать жеста. */
  preload(pack: SoundPackId): void {
    if (!isPlayable(pack) || typeof window === "undefined") return;
    for (const event of SOUND_EVENTS) this.fetchRaw(pack, event);
  }

  play(pack: SoundPackId, event: SoundEvent, volume: number): void {
    if (!isPlayable(pack) || volume <= 0 || typeof window === "undefined") return;
    void this.playAsync(pack, event, Math.min(1, Math.max(0, volume / 100)));
  }

  private fetchRaw(pack: PlayablePack, event: SoundEvent): Promise<ArrayBuffer | null> {
    const url = soundUrl(pack, event);
    let pending = this.raw.get(url);
    if (!pending) {
      pending = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : null))
        .catch(() => null);
      this.raw.set(url, pending);
    }
    return pending;
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const nav = navigator as AudioSessionNavigator;
      if (nav.audioSession) nav.audioSession.type = "ambient";
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private async playAsync(pack: PlayablePack, event: SoundEvent, gainValue: number) {
    try {
      const ctx = this.context();
      if (!ctx) return;
      if (ctx.state === "suspended") await ctx.resume();

      const url = soundUrl(pack, event);
      let buffer = this.decoded.get(url);
      if (!buffer) {
        const data = await this.fetchRaw(pack, event);
        if (!data) return;
        // decodeAudioData «съедает» ArrayBuffer — отдаём копию, оригинал храним.
        buffer = await ctx.decodeAudioData(data.slice(0));
        this.decoded.set(url, buffer);
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = gainValue;
      source.buffer = buffer;
      source.connect(gain).connect(ctx.destination);
      source.start();
    } catch {
      // звук — украшение: его сбой не должен мешать тренировке
    }
  }
}

export const soundPlayer = new SoundPlayer();
