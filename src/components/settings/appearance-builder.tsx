"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, PipetteIcon, RotateCcwIcon, SquareIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Section, saveSettings } from "@/components/settings/settings-sections";
import {
  INFO_TINTS,
  INFO_TINT_LABELS,
  INFO_TINT_SWATCHES,
  MIN_TEXT_CONTRAST,
  applyCustomTheme,
  applyInfoTint,
  contrastRatio,
  rememberAppearance,
} from "@/lib/appearance";
import type { CustomTheme, InfoCardTint } from "@/lib/supabase/types";
import { cn } from "cn";

/** Текущие цвета темы — стартовая точка «Своего выбора». */
function currentThemeColors(): Pick<CustomTheme, "bg" | "text" | "card"> {
  const css = getComputedStyle(document.documentElement);
  const toHex = (value: string, fallback: string) => {
    // Переменные темы заданы в hsl()/hex — переводим через canvas в #RRGGBB.
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) return fallback;
    ctx.fillStyle = fallback;
    ctx.fillStyle = value.trim() || fallback;
    const out = ctx.fillStyle;
    return /^#[0-9a-f]{6}$/i.test(out) ? out.toUpperCase() : fallback;
  };
  return {
    bg: toHex(css.getPropertyValue("--background"), "#FAFAF7"),
    text: toHex(css.getPropertyValue("--foreground"), "#2D3E33"),
    card: toHex(css.getPropertyValue("--card"), "#FFFFFF"),
  };
}

/**
 * «Свой выбор» оформления (GIMN-011): фон, текст, карточки и их свечение
 * поверх выбранной темы. Предпросмотр — сразу, сохранение — кнопкой.
 * Нечитаемое сочетание не запрещаем, но честно предупреждаем.
 */
export function CustomColorsSection({ initial }: { initial: CustomTheme | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState<CustomTheme | null>(initial);
  const [draft, setDraft] = useState<CustomTheme | null>(initial);
  const [pending, setPending] = useState(false);

  function edit(patch: Partial<CustomTheme>) {
    // Первое касание — стартуем от цветов текущей темы.
    const base: CustomTheme = draft ?? { ...currentThemeColors(), glow: false, glow_strength: 40 };
    const next = { ...base, ...patch };
    setDraft(next);
    applyCustomTheme(next); // живой предпросмотр
  }

  async function save() {
    if (!draft) return;
    setPending(true);
    if (await saveSettings({ custom_theme: draft })) {
      setSaved(draft);
      rememberAppearance(draft);
      toast.success("Оформление сохранено");
      router.refresh();
    }
    setPending(false);
  }

  async function resetToTheme() {
    setPending(true);
    applyCustomTheme(null);
    if (await saveSettings({ custom_theme: null })) {
      setSaved(null);
      setDraft(null);
      rememberAppearance(null);
      toast.success("Вернули цвета темы");
      router.refresh();
    } else {
      applyCustomTheme(saved);
    }
    setPending(false);
  }

  const textOnBg = draft ? contrastRatio(draft.text, draft.bg) : null;
  const textOnCard = draft ? contrastRatio(draft.text, draft.card) : null;
  const lowContrast =
    (textOnBg !== null && textOnBg < MIN_TEXT_CONTRAST) || (textOnCard !== null && textOnCard < MIN_TEXT_CONTRAST);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const colors: { key: "bg" | "text" | "card"; label: string }[] = [
    { key: "bg", label: "Фон приложения" },
    { key: "text", label: "Текст" },
    { key: "card", label: "Карточки" },
  ];

  return (
    <Section icon={<PipetteIcon className="size-4 text-primary" aria-hidden />} title="Свой выбор цветов">
      <p className="text-xs text-muted-foreground">
        Поверх выбранной темы: кнопки остаются в её цветах. Изменения видны сразу.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {colors.map(({ key, label }) => (
          <label key={key} className="flex flex-col items-center gap-1.5 text-center text-xs">
            <input
              type="color"
              value={draft?.[key] ?? "#FFFFFF"}
              onChange={(e) => edit({ [key]: e.target.value.toUpperCase() })}
              className="h-12 w-full cursor-pointer rounded-lg border border-border bg-card p-1"
              aria-label={label}
            />
            {label}
          </label>
        ))}
      </div>

      <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
        Свечение карточек
        <Switch checked={draft?.glow ?? false} onCheckedChange={(v) => edit({ glow: v })} aria-label="Свечение карточек" />
      </label>
      {draft?.glow ? (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <Label>Сила свечения</Label>
            <span className="font-mono text-muted-foreground">{draft.glow_strength}%</span>
          </div>
          <Slider
            value={[draft.glow_strength]}
            min={0}
            max={100}
            step={5}
            onValueChange={([v]) => edit({ glow_strength: v })}
            aria-label="Сила свечения"
          />
        </div>
      ) : null}

      {lowContrast ? (
        <p className="flex items-start gap-2 rounded-lg bg-accent/12 p-3 text-sm" role="status">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
          <span>
            Текст может читаться плохо: контраст {Math.min(textOnBg ?? 21, textOnCard ?? 21).toFixed(1)}:1, а нужно от{" "}
            {MIN_TEXT_CONTRAST}:1. Сохранить всё равно можно.
          </span>
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" onClick={() => void resetToTheme()} disabled={pending || (!saved && !draft)}>
          <RotateCcwIcon className="size-4" aria-hidden />
          Сбросить к теме
        </Button>
        <Button className="h-11" onClick={() => void save()} disabled={pending || !draft || !dirty}>
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <CheckIcon className="size-4" aria-hidden />}
          Сохранить
        </Button>
      </div>
    </Section>
  );
}

/** Тон инфо-табличек («Важно о здоровье» и т.п.) — один выбор для всех. */
export function InfoTintSection({ initial }: { initial: InfoCardTint }) {
  const [tint, setTint] = useState<InfoCardTint>(initial);

  async function pick(next: InfoCardTint) {
    const prev = tint;
    setTint(next);
    applyInfoTint(next);
    if (await saveSettings({ info_card_tint: next })) {
      try {
        localStorage.setItem("gz-info-tint", next);
      } catch {
        // без хранилища тон приедет с сервера при следующем открытии
      }
    } else {
      setTint(prev);
      applyInfoTint(prev);
    }
  }

  return (
    <Section icon={<SquareIcon className="size-4 text-primary" aria-hidden />} title="Цвет важных табличек">
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Цвет важных табличек">
        {INFO_TINTS.map((value) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={tint === value}
            onClick={() => void pick(value)}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs leading-tight font-medium transition-colors",
              tint === value ? "border-primary bg-primary/8" : "border-border hover:bg-muted",
            )}
          >
            <span aria-hidden className="size-5 rounded-full border border-black/10" style={{ background: INFO_TINT_SWATCHES[value] }} />
            {INFO_TINT_LABELS[value]}
          </button>
        ))}
      </div>
      <p className="rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground">
        Так выглядят таблички «Важно о здоровье» и другие важные подсказки.
      </p>
    </Section>
  );
}
