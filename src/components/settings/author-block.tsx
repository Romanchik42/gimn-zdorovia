"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const APP_VERSION = "1.0";

/**
 * «О приложении» (SPEC 4.7, US-14).
 * Строго: только сайт автора. Никаких прямых Telegram-ссылок, телефонов и почты —
 * человек знакомится с проектом на сайте и дальше решает сам.
 */
export function AuthorBlock({ siteUrl }: { siteUrl: string }) {
  const siteLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-label="О приложении">
      <div className="flex items-center gap-3">
        <Image src="/logo/logo-mark.svg" alt="" width={40} height={40} className="rounded-lg" />
        <div>
          <p className="font-medium">Гимн.здоровья</p>
          <p className="text-xs text-muted-foreground">Гимнастика для здоровья · Версия {APP_VERSION}</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <p className="text-sm">
          <span className="text-muted-foreground">Разработано</span>
          <br />
          Романом Лифановым
        </p>
        <div className="flex items-center gap-4">
          <div className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-foreground/10">
            <QRCodeSVG value={siteUrl} size={88} level="M" marginSize={1} title="QR-код сайта ai-arhitektor.ru" />
          </div>
          <div className="text-sm">
            <p className="font-medium">AI-Архитектор</p>
            <p className="text-muted-foreground">Автоматизация и AI-решения для бизнеса</p>
          </div>
        </div>
        <Button asChild variant="outline" className="h-11 w-full">
          <a href={siteUrl} target="_blank" rel="noopener noreferrer">
            {siteLabel}
            <ExternalLinkIcon className="size-4" aria-hidden />
          </a>
        </Button>
      </div>
    </section>
  );
}
