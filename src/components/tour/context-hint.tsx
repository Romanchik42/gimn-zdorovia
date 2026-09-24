"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { HINTS, type HintId } from "@/lib/tour/hints";

/**
 * Контекстная подсказка (GIMN-029).
 *
 * Не затемнение с вырезом, как в туре, а карточка в потоке страницы.
 * Разница намеренная: тур ведёт за руку и вправе перехватить экран,
 * подсказка лишь объясняет то, что человек открыл сам, — и перекрывать
 * ему это собой не должна.
 *
 * Своё состояние компонент спрашивает сам, а не получает пропсом: колонка
 * с отметками появляется миграцией 0028, и страница, которая брала бы её
 * своим запросом, падала бы целиком до применения миграции.
 */
export function ContextHint({ id, active = true }: { id: HintId; active?: boolean }) {
  const [show, setShow] = useState(false);
  const hint = HINTS[id];

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    fetch("/api/tour/hint")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.success) return;
        if (!(json.data.seen as string[]).includes(id)) setShow(true);
      })
      .catch(() => {
        // Не узнали — не показываем. Лишняя подсказка раздражает сильнее,
        // чем её отсутствие.
      });

    return () => {
      cancelled = true;
    };
  }, [id, active]);

  if (!show) return null;

  function dismiss() {
    setShow(false);
    void fetch("/api/tour/hint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hint: id }),
    }).catch(() => {
      // Не сохранилось — покажется ещё раз, это переживаемо.
    });
  }

  return (
    <aside
      className="gz-reveal space-y-3 rounded-xl border border-info-border bg-info p-4 text-info-foreground"
      role="note"
      aria-label={hint.title}
    >
      <h2 className="font-medium">{hint.title}</h2>
      {/* Переносы строк в тексте значимы: там списки. */}
      <p className="text-sm whitespace-pre-line">{hint.description}</p>
      <Button variant="outline" className="h-11 w-full" onClick={dismiss}>
        Понятно
      </Button>
    </aside>
  );
}
