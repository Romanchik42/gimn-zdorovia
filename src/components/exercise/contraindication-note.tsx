import { TriangleAlertIcon } from "lucide-react";

/**
 * Плашка противопоказания к упражнению (запрос Романа).
 *
 * Показывает, какие именно противопоказания задействованы — текст приходит из
 * `warningText()` в виде «Не рекомендуется при …», — и добавляет совет
 * обратиться к врачу.
 *
 * Поле `warning` у упражнения может нести и подсказку про снаряд («Нужен
 * турник»): это не медицинский риск, поэтому совет к врачу показываем только
 * когда в тексте есть медицинское противопоказание («Не рекомендуется при»).
 * Так совет не прилипает к чисто «снарядным» предупреждениям.
 */
export function ContraindicationNote({ warning }: { warning: string }) {
  const medical = warning.includes("Не рекомендуется при");
  return (
    <div className="rounded-lg bg-accent/12 p-3 text-sm text-foreground" role="note">
      <p className="flex items-start gap-2">
        <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
        <span>{warning}</span>
      </p>
      {medical ? (
        <p className="mt-1.5 pl-6 text-xs text-muted-foreground">
          Это не запрет — решать вам, но перед выполнением проконсультируйтесь с врачом-ревматологом.
        </p>
      ) : null}
    </div>
  );
}
