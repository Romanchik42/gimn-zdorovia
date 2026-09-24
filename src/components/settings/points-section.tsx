"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { GiftIcon, Loader2Icon } from "lucide-react";

import { Section } from "@/components/settings/settings-sections";
import { ContextHint } from "@/components/tour/context-hint";
import type { PointHistoryRow } from "@/lib/points/service";

/**
 * Баллы за вклад в тестовый период (GIMN-027).
 *
 * Обмен на дни подписки здесь не показываем: пока платного тарифа нет,
 * менять баллы не на что. Копятся они уже сейчас, чтобы к запуску у людей
 * было на что их применить.
 */

const EARN_RULES = [
  ["🐛", "Баг подтверждён", 50],
  ["💡", "Идея принята в план", 100],
  ["👍", "Просто хорошая идея", 20],
  ["📝", "Отзыв", 5],
  ["👤", "Приглашённый друг зарегистрировался", 30],
  ["💳", "Приглашённый друг оплатил подписку", 200],
  ["🔥", "30 дней занятий подряд", 100],
  ["🏆", "100 тренировок всего", 500],
] as const;

export function PointsSection() {
  const [points, setPoints] = useState<number | null>(null);
  const [history, setHistory] = useState<PointHistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/points").then((r) => r.json()),
      fetch("/api/points/history").then((r) => r.json()),
    ])
      .then(([p, h]) => {
        if (cancelled) return;
        if (!p.success || !h.success) {
          setFailed(true);
          return;
        }
        setPoints(p.data.points ?? 0);
        setHistory(h.data.history ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Section icon={<GiftIcon className="size-4 text-primary" aria-hidden />} title="Мои баллы">
      {/* Подсказка про баллы (GIMN-029): показывается при первом открытии
          раздела — раньше рассказывать о них негде и незачем. */}
      <ContextHint id="points" />

      {failed ? (
        <p className="text-sm text-muted-foreground">
          Не удалось загрузить баллы. Откройте раздел заново — счёт не потеряется.
        </p>
      ) : points === null ? (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden /> Загружаем…
        </p>
      ) : (
        <>
          <p className="text-2xl font-semibold">
            {points} <span className="text-base font-normal text-muted-foreground">{pointsWord(points)}</span>
          </p>

          <details className="rounded-lg bg-background p-3 ring-1 ring-foreground/5">
            <summary className="cursor-pointer text-sm text-muted-foreground select-none">
              За что начисляем
            </summary>
            <ul className="gz-reveal mt-2 space-y-1 text-sm">
              {EARN_RULES.map(([emoji, label, amount]) => (
                <li key={label} className="flex justify-between gap-3">
                  <span>
                    <span aria-hidden>{emoji}</span> {label}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">+{amount}</span>
                </li>
              ))}
            </ul>
          </details>

          <p className="rounded-lg border border-info-border bg-info p-3 text-sm text-info-foreground">
            Баллы начисляем к моменту запуска платного режима, чтобы вы могли сразу применить их
            при выборе тарифа.
          </p>

          <div className="space-y-2">
            <h3 className="text-sm font-medium">История</h3>
            {history && history.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {history.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className={row.amount > 0 ? "font-mono text-success" : "font-mono text-muted-foreground"}>
                        {row.amount > 0 ? "+" : ""}
                        {row.amount}
                      </span>{" "}
                      {row.reason}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{shortDate(row.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Пока пусто. Отправьте отзыв или сообщите о баге — начислим после проверки.
              </p>
            )}
          </div>
        </>
      )}
    </Section>
  );
}

/** «1 балл», «2 балла», «5 баллов» — иначе счётчик выглядит машинным. */
function pointsWord(n: number): string {
  const mod100 = Math.abs(n) % 100;
  const mod10 = mod100 % 10;
  if (mod100 >= 11 && mod100 <= 14) return "баллов";
  if (mod10 === 1) return "балл";
  if (mod10 >= 2 && mod10 <= 4) return "балла";
  return "баллов";
}

function shortDate(iso: string): string {
  return format(new Date(iso), "d MMM", { locale: ru });
}
