import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { RulerIcon } from "lucide-react";

import type { UserProgressRow } from "@/lib/supabase/types";

/**
 * Обхваты и состав тела (GIMN-028).
 *
 * Показываем последний замер и разницу с предыдущим — само по себе число
 * «талия 84» человеку мало что говорит, а «−2 см с прошлого раза» говорит
 * всё. Поэтому сравнение с прошлым замером здесь важнее самой цифры.
 *
 * Отдельного графика нет намеренно: обхваты меряют нерегулярно, и линия
 * по трём точкам за полгода выглядела бы как динамика, которой нет.
 */

type Row = Pick<
  UserProgressRow,
  "date" | "chest_cm" | "waist_cm" | "hips_cm" | "bicep_cm" | "thigh_cm" | "body_fat_pct" | "resting_hr" | "notes"
>;

const FIELDS = [
  { key: "chest_cm", label: "Грудь", unit: "см" },
  { key: "waist_cm", label: "Талия", unit: "см" },
  { key: "hips_cm", label: "Бёдра", unit: "см" },
  { key: "bicep_cm", label: "Бицепс", unit: "см" },
  { key: "thigh_cm", label: "Бедро", unit: "см" },
  { key: "body_fat_pct", label: "Жир", unit: "%" },
  { key: "resting_hr", label: "Пульс покоя", unit: "" },
] as const;

export function BodyMeasurements({ rows }: { rows: Row[] }) {
  // Страница отдаёт замеры по возрастанию — так их ждут графики. Здесь
  // нужен обратный порядок, поэтому сортируем свою копию, а не запрос.
  const filled = rows
    .filter((r) => FIELDS.some(({ key }) => r[key] != null))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  if (filled.length === 0) return null;

  const [latest, ...older] = filled;

  // Прошлое значение ищем по каждому полю отдельно: обхваты меряют
  // вразнобой — в один раз только талию, в другой только бицепс. Брать
  // предыдущую строку целиком значило бы терять сравнение там, где оно есть.
  const previousOf = (key: (typeof FIELDS)[number]["key"]): number | null =>
    older.find((r) => r[key] != null)?.[key] ?? null;

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-medium">
          <RulerIcon className="size-4 text-primary" aria-hidden />
          Замеры тела
        </h2>
        <p className="text-xs text-muted-foreground">{shortDate(latest.date)}</p>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        {FIELDS.map(({ key, label, unit }) => {
          const value = latest[key];
          if (value == null) return null;
          return (
            <div key={key} className="flex items-baseline justify-between gap-2 border-b border-foreground/5 pb-1">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="font-mono text-sm">
                {value}
                {unit ? ` ${unit}` : ""}
                <Delta current={value} before={previousOf(key)} />
              </dd>
            </div>
          );
        })}
      </dl>

      {latest.notes ? <p className="text-sm text-muted-foreground">{latest.notes}</p> : null}

      <p className="text-xs text-muted-foreground">
        {older.length > 0
          ? "Рядом с цифрой — разница с прошлым замером этого же обхвата."
          : "Следующий замер покажет разницу. Меряйте в одно и то же время — лучше утром, до еды."}
      </p>
    </section>
  );
}

/** Разница с прошлым замером. Без оценки «хорошо» или «плохо»: для талии и бицепса она разная. */
function Delta({ current, before }: { current: number; before: number | null | undefined }) {
  if (before == null) return null;
  const diff = Number((current - before).toFixed(1));
  if (diff === 0) return <span className="pl-1.5 text-xs text-muted-foreground">без изменений</span>;
  return (
    <span className="pl-1.5 text-xs text-muted-foreground">
      {diff > 0 ? "+" : ""}
      {diff}
    </span>
  );
}

function shortDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00Z`), "d MMMM", { locale: ru });
}
