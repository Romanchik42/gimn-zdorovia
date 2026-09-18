"use client";

import { useState } from "react";
import { Share2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ShareDialog } from "@/components/share/share-dialog";

/** Кнопка «Поделиться» — иконкой в шапке или полноразмерной в настройках (US-12). */
export function ShareButton({
  referralCode,
  appUrl,
  variant = "icon",
}: {
  referralCode: string;
  appUrl: string;
  variant?: "icon" | "full";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "icon" ? (
        <Button
          variant="ghost"
          size="icon"
          className="size-11"
          onClick={() => setOpen(true)}
          aria-label="Поделиться приложением"
          data-tour="share"
        >
          <Share2Icon className="size-5" />
        </Button>
      ) : (
        <Button variant="outline" className="h-12 w-full" onClick={() => setOpen(true)} data-tour="share">
          <Share2Icon className="size-4" aria-hidden />
          Поделиться приложением
        </Button>
      )}
      <ShareDialog open={open} onOpenChange={setOpen} referralCode={referralCode} appUrl={appUrl} />
    </>
  );
}
