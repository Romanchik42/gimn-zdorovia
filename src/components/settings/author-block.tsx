"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLinkIcon } from "lucide-react";

import { Separator } from "@/components/ui/separator";

export const APP_VERSION = "1.0";

/**
 * «О приложении» и визитка автора (SPEC 4.7, US-14; раскладка — GIMN-010).
 * Строго: только сайт автора. Никаких прямых Telegram-ссылок, телефонов и почты —
 * человек знакомится с проектом на сайте и дальше решает сам.
 */
export function AuthorBlock({ siteUrl }: { siteUrl: string }) {
  const siteLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-label="О приложении">
      {/* Ярлык приложения — тот же, что на домашнем экране телефона. */}
      <div className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="rounded-xl" />
        <div>
          <p className="font-medium">Гимн.здоровья</p>
          <p className="text-xs text-muted-foreground">Гимнастика для здоровья · Версия {APP_VERSION}</p>
        </div>
      </div>

      <Separator />

      {/* Визитка: [QR] Роман Лифанов / AI-Архитектор / ссылка */}
      <div className="flex items-center gap-4">
        <div className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-foreground/10">
          <QRCodeSVG value={siteUrl} size={96} level="M" marginSize={1} title="QR-код сайта ai-arhitektor.ru" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">Разработчик</p>
          <p className="font-semibold leading-tight">Роман Лифанов</p>
          <p className="text-sm leading-tight">AI-Архитектор</p>
          <p className="text-xs text-muted-foreground">Автоматизация и AI-решения для бизнеса</p>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {siteLabel}
            <ExternalLinkIcon className="size-3.5" aria-hidden />
          </a>
        </div>
      </div>
    </section>
  );
}
