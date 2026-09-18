"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BellIcon, CheckCircle2Icon, Loader2Icon, SendIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/** Слоты по 15 минут (US-08): крон срабатывает с тем же шагом. */
function slots(fromHour: number, toHour: number): string[] {
  const out: string[] = [];
  for (let h = fromHour; h <= toHour; h++) {
    for (const m of ["00", "15", "30", "45"]) {
      if (h === toHour && m !== "00") break;
      out.push(`${String(h).padStart(2, "0")}:${m}`);
    }
  }
  return out;
}

// Окна совпадают с расписанием кронов в cron-job.org (SPEC 5.10).
const MORNING = slots(5, 12);
const EVENING = slots(15, 23);

async function save(patch: Record<string, unknown>): Promise<boolean> {
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

/** «07:00:00» из Postgres → «07:00»; время не на сетке 15 минут подтягиваем вниз. */
function toSlot(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(Math.floor(m / 15) * 15).padStart(2, "0")}`;
}

export function ReminderSettings({
  enabled,
  morning,
  evening,
  telegramConnected,
  telegramLinkUrl,
}: {
  enabled: boolean;
  morning: string;
  evening: string;
  telegramConnected: boolean;
  telegramLinkUrl: string | null;
}) {
  const [on, setOn] = useState(enabled);
  const [am, setAm] = useState(toSlot(morning));
  const [pm, setPm] = useState(toSlot(evening));
  const [busy, setBusy] = useState(false);

  async function update(patch: Record<string, unknown>, rollback: () => void) {
    setBusy(true);
    const okSaved = await save(patch);
    setBusy(false);
    if (okSaved) toast.success("Сохранено");
    else rollback();
  }

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" data-tour="reminders">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-medium">
          <BellIcon className="size-4 text-primary" aria-hidden />
          Напоминания
        </h2>
        <Switch
          checked={on}
          disabled={busy}
          aria-label="Напоминания в Telegram"
          onCheckedChange={(v) => {
            setOn(v);
            void update({ reminders_enabled: v }, () => setOn(!v));
          }}
        />
      </div>

      {telegramConnected ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-success" aria-hidden />
          Приходят в Telegram
        </p>
      ) : telegramLinkUrl ? (
        <div className="space-y-2 rounded-lg bg-accent/12 p-3 text-sm">
          <p>Напоминания и отчёты приходят в Telegram. Подключите его в одно касание.</p>
          <Button asChild variant="outline" className="h-11 w-full">
            <a href={telegramLinkUrl} target="_blank" rel="noopener noreferrer">
              <SendIcon className="size-4" aria-hidden />
              Подключить Telegram
            </a>
          </Button>
        </div>
      ) : null}

      <div className={on ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 opacity-50"}>
        <TimeSelect
          label="Утром"
          value={am}
          options={MORNING}
          disabled={!on || busy}
          onChange={(v) => {
            const prev = am;
            setAm(v);
            void update({ morning_reminder_time: v }, () => setAm(prev));
          }}
        />
        <TimeSelect
          label="Вечером"
          value={pm}
          options={EVENING}
          disabled={!on || busy}
          onChange={(v) => {
            const prev = pm;
            setPm(v);
            void update({ evening_reminder_time: v }, () => setPm(prev));
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Подсказка: по медицинским источникам оптимальное время для ЛФК — 11:00-14:00 и
        17:00-20:00. Выбирайте то, что удобно вам.
      </p>

      {busy ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2Icon className="size-3 animate-spin" /> Сохраняем…
        </p>
      ) : null}
    </section>
  );
}

function TimeSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <select
        value={options.includes(value) ? value : options[0]}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono text-sm"
      >
        {options.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </label>
  );
}
