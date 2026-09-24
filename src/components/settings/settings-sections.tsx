"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckIcon,
  ChevronDownIcon,
  Loader2Icon,
  PaletteIcon,
  PlayIcon,
  RotateCcwIcon,
  TimerIcon,
  UploadIcon,
  UserIcon,
  Volume2Icon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "@/components/layout/theme-provider";
import { useSound } from "@/components/layout/sound-provider";
import { themeForHour } from "@/components/layout/theme-sync";
import { THEMES, THEME_DESCRIPTIONS, THEME_LABELS, THEME_SWATCHES } from "@/lib/themes";
import { profileContactsSchema } from "@/lib/schemas/user";
import { WORKOUT_LENGTHS, WORKOUT_LENGTH_HINTS, WORKOUT_LENGTH_LABELS } from "@/lib/schemas/workout";
import type { WorkoutLength } from "@/lib/supabase/types";
import { AVATARS, avatarSrc, type AvatarId } from "@/lib/avatars";
import {
  PLAYABLE_PACKS,
  SOUND_PACK_DESCRIPTIONS,
  SOUND_PACK_LABELS,
  type SoundPackId,
} from "@/lib/sound/sound-packs";
import { cn } from "cn";

/** Частичное сохранение настроек; возвращает true при успехе. */
export async function saveSettings(patch: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error ?? "Не удалось сохранить");
      return false;
    }
    return true;
  } catch {
    toast.error("Сеть недоступна. Попробуйте ещё раз.");
    return false;
  }
}

/**
 * Секция настроек — сворачиваемая (GIMN-027).
 *
 * Настроек набралось на полтора экрана прокрутки, и нужное тонуло. Теперь
 * каждая свёрнута до заголовка, раскрытая по умолчанию — одна.
 *
 * Сделано на нативных details/summary, а не на библиотечном аккордеоне:
 * раскрытие работает без JS, состояние держит сам браузер, поиск по странице
 * (Ctrl+F) находит текст внутри закрытых секций и раскрывает их. Для списка
 * настроек этого достаточно, а лишней зависимости не появляется.
 */
export function Section({
  icon,
  title,
  defaultOpen = false,
  dataTour,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  /** Раскрыта при загрузке. Стоит ровно у одной секции — «Оформление». */
  defaultOpen?: boolean;
  /** Якорь ознакомительного тура — остаётся на внешнем элементе секции. */
  dataTour?: string;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      data-tour={dataTour}
      className="group rounded-xl bg-card ring-1 ring-foreground/10 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 p-4 font-medium select-none">
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDownIcon
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <div className="gz-reveal space-y-4 px-4 pb-4">{children}</div>
    </details>
  );
}

/* ------------------------------ профиль ------------------------------- */

type ProfileProps = {
  name: string;
  email: string | null;
  phone: string | null;
  modeLabel: string;
  children?: React.ReactNode;
};

export function ProfileSection({ name, email, phone, modeLabel, children }: ProfileProps) {
  const router = useRouter();
  const [values, setValues] = useState({ name, email: email ?? "", phone: phone ?? "" });
  const [pending, setPending] = useState(false);

  const nameOk = values.name.trim().length >= 2;
  const emailOk = values.email.trim() === "" || profileContactsSchema.shape.email.safeParse(values.email.trim()).success;
  const phoneOk = values.phone.trim() === "" || profileContactsSchema.shape.phone.safeParse(values.phone.trim()).success;
  const dirty =
    values.name.trim() !== name || values.email.trim() !== (email ?? "") || values.phone.trim() !== (phone ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dirty || !nameOk || !emailOk || !phoneOk) return;
    setPending(true);
    if (await saveSettings({ name: values.name.trim(), email: values.email.trim(), phone: values.phone.trim() })) {
      toast.success("Профиль сохранён");
      router.refresh();
    }
    setPending(false);
  }

  const field = (key: keyof typeof values) => ({
    value: values[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [key]: e.target.value })),
  });

  return (
    <Section icon={<UserIcon className="size-4 text-primary" aria-hidden />} title="Профиль">
      {children}
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="profile-name">Имя</Label>
          <Input id="profile-name" maxLength={100} className="h-11" autoComplete="name" {...field("name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-email">Почта — по желанию</Label>
          <Input
            id="profile-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            maxLength={254}
            className="h-11"
            aria-invalid={!emailOk}
            {...field("email")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="profile-phone">Телефон — по желанию</Label>
          <Input
            id="profile-phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+7 900 000-00-00"
            maxLength={32}
            className="h-11"
            aria-invalid={!phoneOk}
            {...field("phone")}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Вход — только через Telegram. Почта и телефон нужны лишь для связи, если захотите.
        </p>
        <Button
          type="submit"
          className="h-11 w-full"
          disabled={!dirty || !nameOk || !emailOk || !phoneOk || pending}
        >
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : "Сохранить"}
        </Button>
      </form>
      <dl className="text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Режим</dt>
          <dd>{modeLabel}</dd>
        </div>
      </dl>
    </Section>
  );
}

/* ----------------------------- оформление ------------------------------ */

export function AppearanceSection({ autoTheme }: { autoTheme: boolean }) {
  const { theme, setTheme } = useTheme();
  const [auto, setAuto] = useState(autoTheme);

  async function pick(name: (typeof THEMES)[number]) {
    // Перекрашиваем сразу, без перезагрузки (US-10); в БД — для других устройств.
    setTheme(name);
    const patch: Record<string, unknown> = { theme: name };
    if (auto) {
      patch.auto_theme = false;
      setAuto(false);
    }
    await saveSettings(patch);
  }

  async function toggleAuto(next: boolean) {
    setAuto(next);
    if (next) setTheme(themeForHour(new Date().getHours()));
    if (!(await saveSettings({ auto_theme: next }))) setAuto(!next);
  }

  return (
    <Section icon={<PaletteIcon className="size-4 text-primary" aria-hidden />} title="Оформление" defaultOpen>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Тема оформления">
        {THEMES.map((name) => {
          const active = theme === name;
          const s = THEME_SWATCHES[name];
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              title={THEME_DESCRIPTIONS[name]}
              onClick={() => void pick(name)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
              )}
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-lg border border-black/10"
                style={{ background: s.background }}
              >
                <span
                  className="size-6 rounded-md"
                  style={{ background: `linear-gradient(135deg, ${s.primary} 50%, ${s.accent} 50%)` }}
                />
              </span>
              <span className="flex items-center gap-1">
                {active ? <CheckIcon className="size-3" aria-hidden /> : null}
                {THEME_LABELS[name]}
              </span>
            </button>
          );
        })}
      </div>
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        <span>
          Авто-смена по времени
          <span className="block text-xs text-muted-foreground">Днём Шалфей, вечером Терракота</span>
        </span>
        <Switch checked={auto} onCheckedChange={(v) => void toggleAuto(v)} aria-label="Авто-смена темы" />
      </label>
    </Section>
  );
}

/* -------------------------------- звук --------------------------------- */

export function SoundSection() {
  const sound = useSound();
  const [volume, setVolume] = useState(sound.volume);

  async function setEnabled(v: boolean) {
    sound.update({ enabled: v });
    if (!(await saveSettings({ sounds_enabled: v }))) sound.update({ enabled: !v });
  }

  async function setPack(pack: SoundPackId) {
    const prev = sound.pack;
    sound.update({ pack });
    if (pack !== "none") sound.preview(pack, volume);
    if (!(await saveSettings({ sound_pack: pack }))) sound.update({ pack: prev });
  }

  async function commitVolume(v: number) {
    sound.update({ volume: v });
    await saveSettings({ sound_volume: v });
  }

  const packs: SoundPackId[] = [...PLAYABLE_PACKS, "none"];

  return (
    <Section icon={<Volume2Icon className="size-4 text-primary" aria-hidden />} title="Звук" dataTour="sounds">
      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Звуки при отметках
        <Switch checked={sound.enabled} onCheckedChange={(v) => void setEnabled(v)} aria-label="Звуки" />
      </label>

      <div className={cn("space-y-2", !sound.enabled && "pointer-events-none opacity-50")}>
        <div className="space-y-2" role="radiogroup" aria-label="Набор звуков">
          {packs.map((pack) => {
            const active = sound.pack === pack;
            return (
              <div
                key={pack}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-1 pl-3",
                  active ? "border-primary bg-primary/8" : "border-border",
                )}
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void setPack(pack)}
                  className="flex min-h-11 flex-1 flex-col justify-center text-left"
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    {active ? <CheckIcon className="size-3.5 text-primary" aria-hidden /> : null}
                    {SOUND_PACK_LABELS[pack]}
                  </span>
                  <span className="text-xs text-muted-foreground">{SOUND_PACK_DESCRIPTIONS[pack]}</span>
                </button>
                {pack !== "none" ? (
                  // Предпрослушивание работает до сохранения (US-10).
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0"
                    onClick={() => sound.preview(pack, volume)}
                    aria-label={`Послушать: ${SOUND_PACK_LABELS[pack]}`}
                  >
                    <PlayIcon className="size-4" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-sm">
            <span>Громкость</span>
            <span className="font-mono text-muted-foreground">{volume}%</span>
          </div>
          <Slider
            value={[volume]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => setVolume(v)}
            onValueCommit={([v]) => void commitVolume(v)}
            aria-label="Громкость"
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        В беззвучном режиме телефона звуки не играют.
      </p>
    </Section>
  );
}

/* --------------------------------- тур --------------------------------- */

export function TourResetButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function reset() {
    setPending(true);
    try {
      await fetch("/api/tour/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tour_type: "app", reset: true }),
      });
      router.push("/app");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <Button variant="outline" className="h-12 w-full" onClick={reset} disabled={pending}>
      {pending ? <Loader2Icon className="size-4 animate-spin" /> : <RotateCcwIcon className="size-4" aria-hidden />}
      Показать тур заново
    </Button>
  );
}

/* ---------------------------- длина занятия ---------------------------- */

export function WorkoutLengthSection({ value, isDefault }: { value: WorkoutLength; isDefault: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState(value);

  async function pick(next: WorkoutLength) {
    const prev = current;
    setCurrent(next);
    if (await saveSettings({ workout_length: next })) {
      toast.success("Длина занятия сохранена — со следующей тренировки");
      router.refresh();
    } else {
      setCurrent(prev);
    }
  }

  return (
    <Section icon={<TimerIcon className="size-4 text-primary" aria-hidden />} title="Длина занятия">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Длина занятия">
        {WORKOUT_LENGTHS.map((length) => {
          const active = current === length;
          return (
            <button
              key={length}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => void pick(length)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center rounded-xl border p-2 text-sm font-medium transition-colors",
                active ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
              )}
            >
              {WORKOUT_LENGTH_LABELS[length]}
              <span className="text-xs font-normal text-muted-foreground">{WORKOUT_LENGTH_HINTS[length]}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {isDefault
          ? "Подобрано автоматически (при тяжёлой диагностике — короткое). Структура занятия сохраняется в любой длине: дыхание, разминка, основное, растяжка."
          : "Структура занятия сохраняется в любой длине: дыхание, разминка, основное, растяжка."}
      </p>
    </Section>
  );
}

/* -------------------------------- аватар -------------------------------- */

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const PHOTO_SIDE = 512;

/** Квадратная обрезка по центру и сжатие до 512×512 WebP — чтобы не грузить мегабайты. */
async function squareWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = PHOTO_SIDE;
  canvas.height = PHOTO_SIDE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas недоступен");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, PHOTO_SIDE, PHOTO_SIDE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("не удалось сжать"))), "image/webp", 0.9),
  );
}

export function AvatarPicker({
  value,
  name,
  photoUrl,
}: {
  value: string | null;
  name: string;
  photoUrl: string | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<AvatarId | null>(
    value && (AVATARS as readonly string[]).includes(value) ? (value as AvatarId) : null,
  );
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState<string | null>(photoUrl);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [uploading, setUploading] = useState(false);

  // Тот же адрес освобождаем при уходе со страницы: зависимость — сам адрес,
  // поэтому старый снимается ровно тогда, когда его сменил новый.
  const previewSrc = preview?.url ?? null;
  useEffect(() => {
    if (!previewSrc) return;
    return () => URL.revokeObjectURL(previewSrc);
  }, [previewSrc]);

  async function choosePhoto(file: File) {
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Файл больше 5 МБ — выберите поменьше");
      return;
    }
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      toast.error("Подойдёт JPG, PNG или WebP");
      return;
    }
    try {
      const blob = await squareWebp(file);
      // Адрес превью держит картинку в памяти, пока вкладка жива; освобождает
      // его эффект выше — по одному месту на все пути (заменили, загрузили,
      // отменили, ушли со страницы).
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch {
      toast.error("Не удалось обработать картинку");
    }
  }

  async function uploadPhoto() {
    if (!preview) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", new File([preview.blob], "avatar.webp", { type: "image/webp" }));
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось загрузить фото");
        return;
      }
      setPhoto(json.data.avatar_url);
      setPreview(null);
      toast.success("Фото сохранено");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось убрать фото");
        return;
      }
      setPhoto(null);
      toast.success("Фото убрано — остался выбранный аватар");
      router.refresh();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setUploading(false);
    }
  }

  async function pick(next: AvatarId | null) {
    const prev = current;
    setCurrent(next);
    setOpen(false);
    if (await saveSettings({ avatar: next })) router.refresh();
    else setCurrent(prev);
  }

  // Фото важнее готового аватара: человек выбрал своё.
  const src = photo ?? avatarSrc(current);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- маленький SVG или фото из хранилища
          <img src={src} alt="" width={56} height={56} className="size-14 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden
            className="flex size-14 items-center justify-center rounded-full bg-primary/12 text-xl font-semibold text-primary"
          >
            {initial}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? "Скрыть" : "Выбрать аватар"}
          </Button>
          <Button variant="outline" className="h-11" asChild>
            <label className="cursor-pointer">
              <UploadIcon className="size-4" aria-hidden />
              Загрузить фото
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void choosePhoto(file);
                }}
              />
            </label>
          </Button>
          {photo ? (
            <Button variant="ghost" className="h-11" onClick={() => void removePhoto()} disabled={uploading}>
              Убрать фото
            </Button>
          ) : null}
        </div>
      </div>

      {preview ? (
        <div className="flex items-center gap-3 rounded-xl border border-border p-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- превью из памяти браузера */}
          <img src={preview.url} alt="Предпросмотр фото" width={72} height={72} className="size-18 rounded-full object-cover" />
          <div className="flex flex-1 flex-wrap gap-2">
            <Button className="h-11 flex-1" onClick={() => void uploadPhoto()} disabled={uploading}>
              {uploading ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
              Сохранить фото
            </Button>
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => {
                setPreview(null);
              }}
              disabled={uploading}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
      {open ? (
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Аватар">
          {AVATARS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={current === id}
              aria-label={`Аватар ${id.slice(-2)}`}
              onClick={() => void pick(id)}
              className={cn(
                "rounded-full p-0.5 ring-2 transition-shadow",
                current === id ? "ring-primary" : "ring-transparent hover:ring-border",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- см. выше */}
              <img src={`/avatars/${id}.svg`} alt="" width={64} height={64} className="aspect-square w-full rounded-full" loading="lazy" />
            </button>
          ))}
          <button
            type="button"
            role="radio"
            aria-checked={current === null}
            onClick={() => void pick(null)}
            className={cn(
              "flex aspect-square items-center justify-center rounded-full border text-xs text-muted-foreground ring-2",
              current === null ? "ring-primary" : "ring-transparent hover:ring-border",
            )}
          >
            Без фото
          </button>
        </div>
      ) : null}
    </div>
  );
}
