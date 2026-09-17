import { TriangleAlertIcon } from "lucide-react";

import { cn } from "cn";

/**
 * Медицинский дисклеймер (SPEC 5.9). Обязателен в трёх местах:
 * лендинг (footer), /onboarding/welcome (до диагностики), /app/settings.
 * Текст живёт только здесь — чтобы формулировка не разъезжалась по страницам.
 */
export const MEDICAL_DISCLAIMER_TEXT = [
  "«Гимн.здоровья» — вспомогательный инструмент, а не медицинский сервис.",
  "Все рекомендации основаны на общедоступных источниках (ASAS/EULAR).",
  "Перед началом занятий проконсультируйтесь с врачом-ревматологом.",
  "При острой боли, повышении давления или ухудшении самочувствия — прекратите занятия и обратитесь к специалисту.",
] as const;

export function MedicalDisclaimer({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <aside
      className={cn(
        "rounded-lg border border-border bg-muted/50 p-4 text-left text-muted-foreground",
        compact ? "text-xs" : "text-sm",
        className,
      )}
    >
      <p className="mb-1 flex items-center gap-2 font-medium text-foreground">
        <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
        Важно о здоровье
      </p>
      <p className="leading-relaxed text-balance">
        {MEDICAL_DISCLAIMER_TEXT.join(" ")}
      </p>
    </aside>
  );
}
