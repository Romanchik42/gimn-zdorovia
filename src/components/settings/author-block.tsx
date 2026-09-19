"use client";

import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { ExternalLinkIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export const APP_VERSION = "1.0";

/** Сторона QR: текст справа вписывается ровно в эту высоту (GIMN-011). */
const QR_SIZE = 104;

/**
 * «О приложении» и визитка автора (SPEC 4.7, US-14; раскладка — GIMN-011).
 * Строго: только сайт автора. Никаких прямых Telegram-ссылок, телефонов и почты —
 * человек знакомится с проектом на сайте и дальше решает сам.
 *
 * Раскладка: ярлык сверху; ниже QR слева и два блока текста справа, вписанные
 * в высоту кода; ссылка — крупная, по центру, под всем блоком.
 */
export function AuthorBlock({ siteUrl }: { siteUrl: string }) {
  const siteLabel = siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <section className="space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10" aria-label="О приложении">
      {/* Ярлык приложения — тот же, что на домашнем экране телефона. */}
      <div className="flex items-center gap-3">
        <Image src="/icons/icon-192.png" alt="" width={48} height={48} className="rounded-xl" />
        <div className="min-w-0">
          <p className="font-medium">Гимн.здоровья</p>
          <p className="text-xs text-muted-foreground">Гимнастика для здоровья · Версия {APP_VERSION}</p>
        </div>
      </div>

      <Separator />

      <div className="flex items-stretch gap-3">
        <div className="shrink-0 rounded-lg bg-white p-1.5 ring-1 ring-foreground/10">
          <QRCodeSVG value={siteUrl} size={QR_SIZE} level="M" marginSize={1} title="QR-код сайта ai-arhitektor.ru" />
        </div>
        {/* Высота колонки равна высоте кода; блоки разнесены с равными отступами. */}
        <div
          className="flex min-w-0 flex-1 flex-col justify-evenly py-1"
          style={{ minHeight: QR_SIZE + 12 }}
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Разработчик</p>
            <p className="truncate font-semibold">Роман Лифанов</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Для бизнеса</p>
            <p className="truncate text-sm font-medium">AI-Архитектор</p>
            <p className="text-xs leading-tight text-muted-foreground">Автоматизация и AI-решения</p>
          </div>
        </div>
      </div>

      <Button asChild size="lg" className="h-12 w-full text-base">
        <a href={siteUrl} target="_blank" rel="noopener noreferrer">
          {siteLabel}
          <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
      </Button>
    </section>
  );
}
