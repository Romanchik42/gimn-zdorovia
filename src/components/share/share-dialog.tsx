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
  // Картинка кода для ручного сохранения и сама ссылка — оба запасных
  // выхода показываются только тогда, когда основной путь не сработал.
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [showLink, setShowLink] = useState(false);

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
      // Буфер закрыт политикой браузера — показываем ссылку, чтобы её
      // можно было выделить пальцем. Совет «выделите вручную» без самой
      // ссылки на экране был бы издевательством.
      setShowLink(true);
      toast.error("Не получилось скопировать — ссылка ниже, выделите её");
    }
  }

  /**
   * Сохранение картинки (GIMN-029, порядок исправлен в GIMN-030).
   *
   * Было в GIMN-029: сначала системный лист «Поделиться», и только если
   * его нет — скачивание. Лист есть почти везде, поэтому «Сохранить
   * картинку» на всех платформах предлагала отправить картинку кому-то.
   * Кнопка называется «сохранить» — значит по умолчанию она сохраняет.
   *
   * Стало: сначала обычное скачивание, а лист — там, где скачивание не
   * работает. Таких мест ровно два, и оба определяются заранее: iOS, где
   * Safari игнорирует атрибут download, и мобильный Telegram с тем же
   * поведением. Настольный Telegram скачивает нормально, поэтому по имени
   * приложения его отсекать нельзя — смотрим на платформу.
   */
  function supportsDirectDownload(): boolean {
    if (typeof document.createElement("a").download === "undefined") return false;

    const ua = navigator.userAgent;
    // iPadOS представляется Macintosh — отличаем по наличию касаний.
    const isApple = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isApple) return false;

    const platform = window.Telegram?.WebApp?.platform;
    return platform !== "ios" && platform !== "android";
  }

  function download(blob: Blob, name: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function savePng() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) {
      toast.error("Не удалось подготовить картинку");
      return;
    }

    const name = `gimn-zdorovia-${referralCode}.png`;

    if (supportsDirectDownload()) {
      download(blob, name);
      return;
    }

    // iOS и мобильный Telegram: в системном листе есть «Сохранить в Фото»
    // — это и есть сохранение там, где скачивание запрещено.
    const file = new File([blob], name, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        // Закрыл лист сам — это не ошибка и не повод что-то скачивать.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }

    // Ни скачивания, ни листа. Пробуем всё равно: хуже уже не будет, а
    // рядом есть кнопка «Не сохранилось?» с картинкой для долгого нажатия.
    download(blob, name);
  }

  /** Показать код картинкой — её сохраняют долгим нажатием. */
  async function showAsImage() {
    const canvas = canvasRef.current;
    if (!canvas || pngUrl) return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) setPngUrl(URL.createObjectURL(blob));
  }

  // Объект-ссылка живёт, пока открыт диалог: пока картинка на экране,
  // освобождать её нельзя — иначе она пропадёт прямо под пальцем.
  useEffect(() => {
    return () => {
      if (pngUrl) URL.revokeObjectURL(pngUrl);
    };
  }, [pngUrl]);

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
          <Button variant="outline" className="h-11 w-full" onClick={() => void savePng()}>
            <DownloadIcon className="size-4" aria-hidden />
            Сохранить картинку
          </Button>

          {pngUrl ? (
            <figure className="space-y-2">
              {/* Обычный img вместо next/image: это blob из холста, оптимизировать нечего. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pngUrl}
                alt="QR-код приглашения"
                className="w-48 rounded-xl ring-1 ring-foreground/10"
              />
              <figcaption className="text-center text-xs text-muted-foreground">
                Нажмите на код и удерживайте — «Сохранить в Фото».
              </figcaption>
            </figure>
          ) : (
            <button
              type="button"
              onClick={() => void showAsImage()}
              className="text-xs text-muted-foreground underline underline-offset-2"
            >
              Не сохранилось?
            </button>
          )}
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

        <div className="space-y-2">
          <Button variant="outline" className="h-11 w-full" onClick={() => void copy()}>
            <CopyIcon className="size-4" aria-hidden />
            Копировать ссылку
          </Button>
          {/* Ссылка текстом — только когда копирование не сработало. */}
          {showLink ? (
            <p className="rounded-lg bg-muted px-3 py-2 text-center font-mono text-sm break-all select-all">
              {displayLink}
            </p>
          ) : null}
        </div>

        <p className="flex items-center justify-center gap-2 pt-1 text-sm text-muted-foreground">
          <UsersIcon className="size-4" aria-hidden />
          По вашей ссылке пришло: {invited ?? "…"}
        </p>
      </DialogContent>
    </Dialog>
  );
}

