"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, TrophyIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DIFFICULTY_LABELS } from "@/lib/schemas/diagnostics";
import type { LevelUpOffer } from "@/lib/progression/offer";

/**
 * Предложение перейти на следующий уровень (GIMN-028, блок F).
 *
 * Обе кнопки — равноправный ответ, поэтому «Остаться» выглядит как выбор,
 * а не как отказ от подарка. Уровень поднимается только по нажатию: программа
 * видит цифры, но не видит, как человек спал и что у него со спиной сегодня.
 */

const WHAT_CHANGES = [
  "Тренировки делятся на верх и низ — вместо одной на всё тело",
  "Подходов больше: четыре-пять вместо трёх",
  "Упражнений больше, и они разнообразнее",
  "Нагрузка идёт волнами: тяжёлые недели чередуются с лёгкими",
];

export function LevelUpDialog({
  offer,
  onClose,
}: {
  offer: LevelUpOffer | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function answer(accept: boolean) {
    setPending(true);
    try {
      const res = await fetch("/api/progression/level-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      const json = await res.json();

      if (!json.success) {
        toast.error(json.error ?? "Не удалось сохранить ответ");
        return;
      }

      if (accept) {
        toast.success("Уровень «Средний». Следующая тренировка будет по-новому.");
        router.refresh();
      } else {
        toast.info("Остаёмся на прежнем уровне. Вернёмся к этому позже.");
      }
      onClose();
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setPending(false);
    }
  }

  const grew =
    offer?.startWeightKg && offer.currentWeightKg
      ? `рабочий вес вырос с ${offer.startWeightKg} до ${offer.currentWeightKg} кг — это +${offer.growthPct}%`
      : `рабочий вес вырос на ${offer?.growthPct ?? 0}%`;

  return (
    <Dialog open={offer !== null} onOpenChange={(next) => !next && !pending && onClose()}>
      <DialogContent className="max-w-sm">
        {offer ? (
          <>
            <DialogHeader>
              <div className="mx-auto mb-1 flex size-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <TrophyIcon className="size-6" aria-hidden />
              </div>
              <DialogTitle className="text-center">{offer.name}, вы прошли уровень «Начальный»</DialogTitle>
              <DialogDescription className="text-center">
                За {offer.workouts} тренировок {grew}. Техника базовых движений освоена — можно идти дальше.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 rounded-xl bg-muted/50 p-3">
              <p className="text-sm font-medium">
                Что изменится на уровне «{DIFFICULTY_LABELS[offer.nextLevel]}»
              </p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {WHAT_CHANGES.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span aria-hidden>—</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <Button className="h-12" disabled={pending} onClick={() => void answer(true)}>
                {pending ? <Loader2Icon className="size-4 animate-spin" aria-hidden /> : null}
                Согласиться
              </Button>
              <Button variant="outline" className="h-12" disabled={pending} onClick={() => void answer(false)}>
                Остаться на начальном
              </Button>
            </div>

            <p className="text-center text-xs text-muted-foreground">
              Передумаете — уровень всегда можно поменять в настройках.
            </p>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
