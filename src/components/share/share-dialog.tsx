"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CopyIcon, DownloadIcon, Share2Icon, UsersIcon } from "lucide-react";

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
const FALLBACK_COLOR = "#2D3E33";

/**
 * Цвет модулей QR — тёмный тон текущей темы (--foreground).
 *
 * SPEC 4.6 предлагает брендовый --logo-primary, но это светлые цвета, и QR
 * в них читается хуже: проверка декодером на экране, в 1024px и в «распечатке»
 * с шумом дала 22/27 для брендовых цветов против 27/27 для --foreground.
 * Критерий US-12 — «читается с экрана и с распечатки», поэтому берём тёмный
 * тон темы, а брендовый цвет остаётся у логотипа в центре.
 */
function themeQrColor(): string {
  if (typeof window === "undefined") return FALLBACK_COLOR;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim();
  return value || FALLBACK_COLOR;
}

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

  // Содержимое диалога монтируется только на клиенте после открытия, поэтому
  // читать цвет темы и возможности браузера можно прямо при рендере.
  const color = open ? themeQrColor() : FALLBACK_COLOR;
  const canShare = open && typeof navigator !== "undefined" && typeof navigator.share === "function";
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

  async function systemShare() {
    try {
      await navigator.share({
        title: "Гимн.здоровья",
        text: "Гимнастика для здоровья — попробуй вместе со мной",
        url: shareLink,
      });
    } catch {
      // пользователь закрыл системное меню — это не ошибка
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
              fgColor={color}
              bgColor="#FFFFFF"
              marginSize={2}
              imageSettings={logo(44)}
              title="QR-код приглашения"
            />
          </div>
          <Button variant="outline" className="h-11" onClick={downloadPng}>
            <DownloadIcon className="size-4" aria-hidden />
            Сохранить картинку
          </Button>
          {/* Скрытый холст 1024×1024 для PNG — с полем тишины, чтобы читался с распечатки. */}
          <QRCodeCanvas
            ref={canvasRef}
            value={qrLink}
            size={1024}
            level="H"
            fgColor={color}
            bgColor="#FFFFFF"
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

        {canShare ? (
          <>
            <Or />
            <Button className="h-12 w-full" onClick={systemShare}>
              <Share2Icon className="size-4" aria-hidden />
              Поделиться…
            </Button>
          </>
        ) : null}

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
