"use client";

import { useEffect, useState } from "react";

import { MAX_POINTS_PERCENT, applyPoints, pointsWorthRub } from "@/lib/points/pricing";
import { pointsWord } from "@/lib/points/format";
import { Button } from "@/components/ui/button";

/**
 * Частичная оплата баллами (GIMN-030).
 *
 * До этого баллы можно было обменять только целым пакетом — день, неделя,
 * месяц. Человек с 350 баллами не мог сделать с ними ничего: на день не
 * хватает четверти, а копить до месяца — полгода. Слайдер снимает это
 * условие: применяется любое число баллов, остальное платится картой.
 *
 * Кнопка оплаты неактивна намеренно: приёма платежей нет. Показываем
 * расчёт заранее, чтобы к запуску человек уже знал, во что превратятся
 * его баллы, и не встретил цену сюрпризом.
 *
 * Баланс спрашиваем сами: раздел тарифов — серверный компонент, а лишний
 * запрос в него ради блока, который не у всех и есть, того не стоит.
 */
export function PointsSlider({ priceRub, title }: { priceRub: number; title: string }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [requested, setRequested] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/points")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setBalance(json.data.points ?? 0);
      })
      .catch(() => {
        // Не узнали остаток — блока просто не будет.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (balance === null || balance === 0) return null;

  // По умолчанию применяем всё, что можно: человек копил баллы затем,
  // чтобы ими заплатить, а не чтобы искать, где их включить.
  const state = applyPoints(priceRub, balance, requested ?? balance);
  if (state.maxPoints === 0) return null;

  const sliderId = `points-${title}`;

  return (
    <div className="space-y-2 rounded-lg bg-muted/60 p-3">
      <p className="text-sm">
        У вас {balance} {pointsWord(balance)} = {pointsWorthRub(balance)} ₽
      </p>

      <label htmlFor={sliderId} className="block text-sm font-medium">
        Применить баллов: {state.points}
      </label>
      <input
        id={sliderId}
        type="range"
        min={0}
        max={state.maxPoints}
        step={1}
        value={state.points}
        onChange={(e) => setRequested(Number(e.target.value))}
        className="h-11 w-full accent-[var(--primary)]"
        aria-describedby={`${sliderId}-summary`}
      />

      <div id={`${sliderId}-summary`} className="space-y-0.5 text-sm">
        <p className="font-medium">
          К оплате картой: {state.payRub} ₽{" "}
          {state.discountRub > 0 ? (
            <span className="font-normal text-muted-foreground">(было {priceRub} ₽)</span>
          ) : null}
        </p>
        {state.discountRub > 0 ? (
          <p className="text-muted-foreground">Скидка баллами: {state.discountRub} ₽</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Максимум баллами: до {MAX_POINTS_PERCENT}% от суммы
        </p>
      </div>

      {/* Неактивна, пока нет приёма платежей. Заголовок объясняет, почему:
          серая кнопка без причины читается как поломка. */}
      <Button
        className="h-11 w-full"
        disabled
        title="Приём платежей ещё не подключён — пользование пока бесплатное"
      >
        Оплатить {state.payRub} ₽
      </Button>
    </div>
  );
}
