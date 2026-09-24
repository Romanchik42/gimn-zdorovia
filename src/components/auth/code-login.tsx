"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, MailIcon, SmartphoneIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { clearReferralCode, readReferralCode } from "@/lib/referral/storage";

/**
 * Вход по одноразовому коду — SMS или почта (GIMN-029).
 *
 * Один компонент на оба канала: отличаются они клавиатурой, подписями и
 * адресом ручки. Два почти одинаковых компонента разъехались бы уже на
 * второй правке, и дыра осталась бы в том, про который забыли.
 *
 * Два экрана: ввод номера (адреса) и ввод кода. Возврат к первому —
 * отдельной кнопкой: ошибиться в номере проще всего, и человек, который
 * не может исправить опечатку, ждёт код, который придёт не ему.
 */

type Channel = "sms" | "email";

const TEXTS = {
  sms: {
    label: "Номер телефона",
    placeholder: "+7 999 123-45-67",
    icon: SmartphoneIcon,
    send: "Получить код в SMS",
    sentTo: "Код отправлен на",
    noCode: "Не пришёл код? Проверьте, верно ли указан номер.",
    autoComplete: "tel",
    inputMode: "tel" as const,
    type: "tel",
  },
  email: {
    label: "Адрес почты",
    placeholder: "you@example.com",
    icon: MailIcon,
    send: "Получить код на почту",
    sentTo: "Код отправлен на",
    noCode: "Не пришло письмо? Загляните в папку «Спам».",
    autoComplete: "email",
    inputMode: "email" as const,
    type: "email",
  },
} satisfies Record<Channel, unknown>;

export function CodeLogin({ channel }: { channel: Channel }) {
  const router = useRouter();
  const t = TEXTS[channel];
  const Icon = t.icon;

  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  // Обратный отсчёт до повторной отправки. Кнопка «ещё раз» без него
  // выглядит рабочей и на каждое нажатие отвечает отказом.
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait((n) => (n > 0 ? n - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  useEffect(() => {
    if (sentTo) codeRef.current?.focus();
  }, [sentTo]);

  async function request() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${channel}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, referral_code: readReferralCode() ?? undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Не удалось отправить код");
        return;
      }
      setSentTo(json.data.sent_to);
      setWait(json.data.resend_after_sec ?? 60);
    } catch {
      setError("Нет связи. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${channel}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, code, referral_code: readReferralCode() ?? undefined }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Неверный код");
        return;
      }
      clearReferralCode();
      router.replace(json.data.next_step === "onboarding_mode" ? "/onboarding/mode" : "/app");
      router.refresh();
    } catch {
      setError("Нет связи. Проверьте интернет и попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  if (!sentTo) {
    return (
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && identifier.trim()) void request();
        }}
      >
        <Label htmlFor={`${channel}-id`} className="text-sm">
          {t.label}
        </Label>
        <Input
          id={`${channel}-id`}
          className="h-12"
          type={t.type}
          inputMode={t.inputMode}
          autoComplete={t.autoComplete}
          placeholder={t.placeholder}
          value={identifier}
          disabled={pending}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="submit" className="h-12 w-full" disabled={pending || !identifier.trim()}>
          {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
          {t.send}
        </Button>
      </form>
    );
  }

  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!pending && code.length === 6) void verify();
      }}
    >
      <p className="text-sm text-muted-foreground">
        {t.sentTo} {sentTo}
      </p>
      <Label htmlFor={`${channel}-code`} className="text-sm">
        Код из шести цифр
      </Label>
      <Input
        id={`${channel}-code`}
        ref={codeRef}
        className="h-12 text-center font-mono text-lg tracking-[0.3em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        value={code}
        disabled={pending}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" className="h-12 w-full" disabled={pending || code.length !== 6}>
        {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
        Войти
      </Button>

      <div className="space-y-1 pt-1 text-center text-xs text-muted-foreground">
        <p>{t.noCode}</p>
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            className="underline underline-offset-2 disabled:no-underline disabled:opacity-60"
            disabled={pending || wait > 0}
            onClick={() => void request()}
          >
            {wait > 0 ? `Отправить ещё раз через ${wait} сек` : "Отправить ещё раз"}
          </button>
          <button
            type="button"
            className="underline underline-offset-2"
            onClick={() => {
              setSentTo(null);
              setCode("");
              setError(null);
            }}
          >
            Изменить {channel === "sms" ? "номер" : "адрес"}
          </button>
        </div>
      </div>
    </form>
  );
}
