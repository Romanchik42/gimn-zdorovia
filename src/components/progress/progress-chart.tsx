"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * График прогресса: одна серия, поэтому без легенды — ряд называет заголовок.
 * Цвет данных — токен темы --chart-1 (проверен валидатором палитры), весь
 * текст — текстовыми токенами, сетка — волосяная сплошная линия --border.
 */

export type ChartPoint = { label: string; value: number };

const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 11 };

function formatValue(value: number, unit: string): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
  return unit ? `${text} ${unit}` : text;
}

/** Берём из пропсов Recharts только то, что читаем, — его дженерики не сужаются до number. */
type TooltipBits = {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
};

function ChartTooltip({ active, payload, label, unit }: TooltipBits & { unit: string }) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  if (typeof value !== "number") return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{String(label ?? "")}</p>
      <p className="font-medium text-popover-foreground">{formatValue(value, unit)}</p>
    </div>
  );
}

export function ProgressChart({
  title,
  subtitle,
  data,
  unit,
  kind = "line",
  domain,
  emptyText = "Пока нет данных.",
}: {
  title: string;
  subtitle?: string;
  data: ChartPoint[];
  unit: string;
  kind?: "line" | "bar";
  domain?: [number | "auto", number | "auto"];
  emptyText?: string;
}) {
  const last = data.at(-1);

  return (
    <section className="space-y-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <header className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {last ? (
          // Последнее значение — единственная подпись ряда: на самом графике её не дублируем.
          <p className="shrink-0 text-sm font-semibold whitespace-nowrap text-foreground">
            {formatValue(last.value, unit)}
          </p>
        ) : null}
      </header>

      {data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <>
          {/* Высота контейнера включает полосу оси X — подписи не обрезаются. */}
          <div className="h-44 w-full" role="img" aria-label={`${title}: график`}>
            <ResponsiveContainer width="100%" height="100%">
              {kind === "line" ? (
                <LineChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    domain={domain ?? ["auto", "auto"]}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1 }}
                    content={(props) => <ChartTooltip {...props} unit={unit} />}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    dot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "var(--chart-1)", stroke: "var(--card)", strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              ) : (
                <BarChart data={data} margin={{ top: 16, right: 4, bottom: 0, left: -12 }}>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
                  <XAxis
                    dataKey="label"
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={16}
                  />
                  <YAxis
                    tick={AXIS_TICK}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                    allowDecimals={false}
                    domain={domain ?? [0, "auto"]}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                    content={(props) => <ChartTooltip {...props} unit={unit} />}
                  />
                  <Bar
                    dataKey="value"
                    fill="var(--chart-1)"
                    maxBarSize={24}
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={false}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Табличный вид: значение не должно быть доступно только через наведение. */}
          <details className="text-sm">
            <summary className="min-h-11 cursor-pointer py-2 text-muted-foreground">Показать таблицей</summary>
            <table className="w-full text-left">
              <tbody>
                {data.map((p, i) => (
                  <tr key={`${p.label}-${i}`} className="border-t border-border">
                    <td className="py-1.5 text-muted-foreground">{p.label}</td>
                    <td className="py-1.5 text-right tabular-nums">{formatValue(p.value, unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </section>
  );
}
