"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CopyIcon, DownloadIcon, SendIcon, UsersIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const LOGO_SRC = "/logo/logo-mark.svg";

/**
 * Цвет модулей QR — чистый чёрный на белом, как на визитке (GIMN-026).
 *
 * Раньше брали тёмный тон темы (--foreground). На светлых палитрах это
 * работало, но в «Графите» --foreground равен #E9ECEF — почти белый, и QR
 * выходил светло-серым на белом поле: на экране бледный, с распечатки не
 * читался вовсе. Тема не должна решать, отсканируется код или нет, поэтому
 * цвет зафиксирован. Брендовый цвет остаётся у логотипа в центре.
 */
const QR_FG = "#000000";
const QR_BG = "#FFFFFF";

/**
 * «Поделиться приложением» (US-12, SPEC 4.6): QR с логотипом в цветах темы,
 * PNG 1024×1024, ссылка с копированием, системный share, счётчик приглашённых.
 * У каждого способа свой src — чтобы в статистике были видны каналы (SPEC 5.7).
 */
export function ShareDialog({
  open,
  onOpenChange,
  referralCode,
  appUrl,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referralCode: string;
  appUrl: string;
}) {
  const [invited, setInvited] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const link = `${appUrl}/i/${referralCode}`;
  const qrLink = `${link}?src=qr`;
  const shareLink = `${link}?src=share`;
  const displayLink = link.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    fetch("/api/referral/stats")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setInvited(json.data.invited ?? 0);
      })
      .catch(() => {
        // счётчик — приятная мелочь, без него диалог работает
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Скопировано");
    } catch {
      toast.error("Не получилось скопировать — выделите ссылку вручную");
    }
  }

  function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `gimn-zdorovia-${referralCode}.png`;
      a.click();
    } catch {
      toast.error("Не удалось сохранить картинку");
    }
  }

  /**
   * «Отправить» — выбор, кому: системное меню (мессенджеры, контакты); внутри
   * Telegram, где его нет, — выбор чата Telegram; на десктопе без того и
   * другого — копируем ссылку.
   */
  async function send() {
    const text = "Гимнастика для здоровья — попробуй вместе со мной";
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Гимн.здоровья", text, url: shareLink });
      } catch {
        // пользователь закрыл системное меню — это не ошибка
      }
      return;
    }
    const telegram = window.Telegram?.WebApp;
    if (telegram?.openTelegramLink) {
      const query = new URLSearchParams({ url: shareLink, text });
      telegram.openTelegramLink(`https://t.me/share/url?${query}`);
      return;
    }
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("Ссылка скопирована — вставьте её в чат");
    } catch {
      toast.error("Не получилось скопировать — выделите ссылку вручную");
    }
  }

  const logo = (size: number) => ({ src: LOGO_SRC, height: size, width: size, excavate: true });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-sm overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Поделиться приложением</DialogTitle>
          <DialogDescription>Друг откроет ссылку или отсканирует код камерой.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-3 ring-1 ring-foreground/10">
            {/* level H: высокая коррекция ошибок, чтобы логотип в центре не мешал считыванию */}
            <QRCodeSVG
              value={qrLink}
              size={220}
              level="H"
              fgColor={QR_FG}
              bgColor={QR_BG}
              marginSize={2}
              imageSettings={logo(44)}
              title="QR-код приглашения"
            />
          </div>
          <Button className="h-12 w-full" onClick={() => void send()}>
            <SendIcon className="size-4" aria-hidden />
            Отправить
          </Button>
          <Button variant="outline" className="h-11 w-full" onClick={downloadPng}>
            <DownloadIcon className="size-4" aria-hidden />
            Сохранить картинку
          </Button>
          {/* Скрытый холст 1024×1024 для PNG — с полем тишины, чтобы читался с распечатки. */}
          <QRCodeCanvas
            ref={canvasRef}
            value={qrLink}
            size={1024}
            level="H"
            fgColor={QR_FG}
            bgColor={QR_BG}
            marginSize={4}
            imageSettings={logo(200)}
            className="hidden"
            aria-hidden
          />
        </div>

        <Or />

        <div className="space-y-2">
          <p className="rounded-lg bg-muted px-3 py-2 text-center font-mono text-sm break-all select-all">
            {displayLink}
          </p>
          <Button variant="outline" className="h-11 w-full" onClick={copy}>
            <CopyIcon className="size-4" aria-hidden />
            Копировать ссылку
          </Button>
        </div>

        <p className="flex items-center justify-center gap-2 pt-1 text-sm text-muted-foreground">
          <UsersIcon className="size-4" aria-hidden />
          По вашей ссылке пришло: {invited ?? "…"}
        </p>
      </DialogContent>
    </Dialog>
  );
}

function Or() {
  return (
    <div className="flex items-center gap-3">
      <Separator className="flex-1" />
      <span className="text-xs text-muted-foreground">или</span>
      <Separator className="flex-1" />
    </div>
  );
}
