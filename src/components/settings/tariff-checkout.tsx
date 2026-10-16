"use client";

import { useEffect, useState } from "react";

import { MAX_POINTS_PERCENT, pointsWorthRub } from "@/lib/points/pricing";
import { pointsWord } from "@/lib/points/format";
import type { PaymentPeriod, PaymentTariff } from "@/lib/payments/provider";
import { PERIOD_LABELS, checkoutAmount, tariffPriceRub } from "@/lib/payments/rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Оплата тарифа: период, частичная оплата баллами (GIMN-030), почта для чека.
 *
 * Сумму считает тот же checkoutAmount, что и сервер, — но серверу её не
 * передаём: он пересчитает сам по тарифу, периоду и баллам.
 *
 * Пока ключей ЮKassa нет, `enabled` ложно и кнопка неактивна с объяснением:
 * серая кнопка без причины читается как поломка.
 *
 * Баланс спрашиваем сами: раздел тарифов — серверный компонент, а лишний
 * запрос в него ради блока, который не у всех и есть, того не стоит.
 */
export function TariffCheckout({
  tariff,
  title,
  enabled,
  defaultEmail,
}: {
  tariff: PaymentTariff;
  title: string;
  enabled: boolean;
  defaultEmail: string;
}) {
  const [balance, setBalance] = useState(0);
  const [period, setPeriod] = useState<PaymentPeriod>("month");
  const [requested, setRequested] = useState<number | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/points")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        setBalance(json.data.points ?? 0);
      })
      .catch(() => {
        // Не узнали остаток — платим без баллов.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // По умолчанию применяем всё, что можно: человек копил баллы затем,
  // чтобы ими заплатить, а не чтобы искать, где их включить.
  const amount = checkoutAmount(tariff, period, balance, requested ?? balance);
  const maxPoints = checkoutAmount(tariff, period, balance, balance).points;
  const id = `pay-${tariff}`;

  async function pay() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tariff, period, points: amount.points, email }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.details?.[0]?.message ?? json.error ?? "Не удалось начать оплату");
        setBusy(false);
        return;
      }
      // Кнопку не размораживаем: страница уходит на оплату ЮKassa.
      window.location.href = json.data.confirmationUrl;
    } catch {
      setError("Нет связи. Проверьте интернет и попробуйте ещё раз.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg bg-muted/60 p-3">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label={`Период оплаты «${title}»`}>
        {(["month", "year"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={period === p}
            onClick={() => setPeriod(p)}
            className={
              period === p
                ? "h-11 rounded-lg bg-primary text-sm font-medium text-primary-foreground"
                : "h-11 rounded-lg bg-background text-sm ring-1 ring-foreground/10"
            }
          >
            {PERIOD_LABELS[p]} — {tariffPriceRub(tariff, p)} ₽
          </button>
        ))}
      </div>

      {/* Баллы — только тем, у кого они есть: пустой слайдер ничего не объясняет. */}
      {balance > 0 && maxPoints > 0 ? (
        <div className="space-y-2">
          <p className="text-sm">
            У вас {balance} {pointsWord(balance)} = {pointsWorthRub(balance)} ₽
          </p>
          <label htmlFor={`${id}-points`} className="block text-sm font-medium">
            Применить баллов: {amount.points}
          </label>
          <input
            id={`${id}-points`}
            type="range"
            min={0}
            max={maxPoints}
            step={1}
            value={amount.points}
            onChange={(e) => setRequested(Number(e.target.value))}
            className="h-11 w-full accent-[var(--primary)]"
            aria-describedby={`${id}-summary`}
          />
          <p className="text-xs text-muted-foreground">Максимум баллами: до {MAX_POINTS_PERCENT}% от суммы</p>
        </div>
      ) : null}

      <div id={`${id}-summary`} className="space-y-0.5 text-sm">
        <p className="font-medium">
          К оплате картой: {amount.payRub} ₽{" "}
          {amount.discountRub > 0 ? (
            <span className="font-normal text-muted-foreground">(было {amount.priceRub} ₽)</span>
          ) : null}
        </p>
        {amount.discountRub > 0 ? (
          <p className="text-muted-foreground">Скидка баллами: {amount.discountRub} ₽</p>
        ) : null}
      </div>

      {enabled ? (
        <div className="space-y-1">
          <Label htmlFor={`${id}-email`}>Почта для чека</Label>
          <Input
            id={`${id}-email`}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11"
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button
        className="h-11 w-full"
        disabled={!enabled || busy || !email.trim()}
        onClick={pay}
        title={enabled ? undefined : "Приём платежей ещё не подключён — пользование пока бесплатное"}
      >
        {busy ? "Переходим к оплате…" : `Оплатить ${amount.payRub} ₽`}
      </Button>
    </div>
  );
}
