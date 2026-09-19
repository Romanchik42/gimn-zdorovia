"use client";

import { useState } from "react";
import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * «Сбросить мой аккаунт» (GIMN-010) — только на /admin/stats, права проверяет сервер.
 * Стирает данные самого админа, закрывает сессию; следующий вход — как новый.
 */
export function ResetAccountButton() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function reset() {
    setPending(true);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не удалось сбросить аккаунт");
        setPending(false);
        return;
      }
      // Полная перезагрузка: сессия уже закрыта, клиентский кеш не нужен.
      window.location.assign(json.data.next);
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !pending && setOpen(v)}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="h-11 w-full">
          <RotateCcwIcon className="size-4" aria-hidden />
          Сбросить мой аккаунт
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Сбросить ваш аккаунт?</DialogTitle>
          <DialogDescription>
            Удалятся ТОЛЬКО ваши данные: диагностика, план, тренировки, отметки, меню, прогресс.
            Вы выйдете из приложения, а следующий вход пройдёт как у нового пользователя.
            Других пользователей это не касается. Отменить нельзя.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" className="h-11" onClick={() => setOpen(false)} disabled={pending}>
            Отмена
          </Button>
          <Button variant="destructive" className="h-11" onClick={() => void reset()} disabled={pending}>
            {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
            Да, сбросить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
