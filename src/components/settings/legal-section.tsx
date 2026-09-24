import { DownloadIcon, FileTextIcon } from "lucide-react";

import { Section } from "@/components/settings/settings-sections";
import { LegalDocument } from "@/legal/document-view";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/legal/registry";

/**
 * Условия и документы (GIMN-027, печать — GIMN-029).
 *
 * Тексты лежат прямо в приложении, а не ссылкой на сторонний сайт: человек
 * должен иметь возможность прочитать их там же, где принимает. Каждый
 * свёрнут — целиком это несколько экранов, и разворачивать их по умолчанию
 * значит похоронить остальные настройки.
 *
 * Список берётся из общего перечня, а не переписывается здесь: тот же
 * перечень отдаёт документы в PDF, и разойтись они не могут.
 */
export function LegalSection() {
  return (
    <Section icon={<FileTextIcon className="size-4 text-primary" aria-hidden />} title="Условия и документы">
      <div className="space-y-2">
        {LEGAL_SLUGS.map((slug) => {
          const { doc, emoji } = LEGAL_DOCS[slug];
          return (
            <details key={slug} className="rounded-lg bg-background p-3 ring-1 ring-foreground/5">
              <summary className="cursor-pointer text-sm font-medium select-none">
                <span aria-hidden>{emoji}</span> {doc.title}
              </summary>
              <div className="gz-reveal space-y-3 pt-3">
                <LegalDocument doc={doc} />
                {/* Ссылка, а не кнопка: браузер скачивает файл сам, без нашего
                    кода, и это работает даже там, где скрипты отвалились. */}
                <a
                  href={`/api/legal/${slug}.pdf`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
                >
                  <DownloadIcon className="size-4" aria-hidden />
                  Скачать PDF для распечатки
                </a>
              </div>
            </details>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Согласие с этими документами будет запрашиваться при оформлении подписки. Пока идёт
        тестовый период, они опубликованы для ознакомления.
      </p>
    </Section>
  );
}
