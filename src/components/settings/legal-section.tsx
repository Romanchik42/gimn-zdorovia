import { FileTextIcon } from "lucide-react";

import { Section } from "@/components/settings/settings-sections";
import { UserAgreement } from "@/legal/user-agreement";
import { PrivacyPolicy } from "@/legal/privacy-policy";
import { DataConsent } from "@/legal/data-consent";

/**
 * Условия и документы (GIMN-027).
 *
 * Тексты лежат прямо в приложении, а не ссылкой на сторонний сайт: человек
 * должен иметь возможность прочитать их там же, где принимает. Каждый
 * свёрнут — целиком это несколько экранов, и разворачивать их по умолчанию
 * значит похоронить остальные настройки.
 *
 * Скачивание PDF отложено до GIMN-029 — там по плану вся печатная часть.
 */

const DOCUMENTS = [
  { emoji: "📜", title: "Пользовательское соглашение", Body: UserAgreement },
  { emoji: "🔒", title: "Политика конфиденциальности", Body: PrivacyPolicy },
  { emoji: "✅", title: "Согласие на обработку персональных данных", Body: DataConsent },
];

export function LegalSection() {
  return (
    <Section icon={<FileTextIcon className="size-4 text-primary" aria-hidden />} title="Условия и документы">
      <div className="space-y-2">
        {DOCUMENTS.map(({ emoji, title, Body }) => (
          <details key={title} className="rounded-lg bg-background p-3 ring-1 ring-foreground/5">
            <summary className="cursor-pointer text-sm font-medium select-none">
              <span aria-hidden>{emoji}</span> {title}
            </summary>
            <div className="gz-reveal pt-3">
              <Body />
            </div>
          </details>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Согласие с этими документами будет запрашиваться при оформлении подписки. Пока идёт
        тестовый период, они опубликованы для ознакомления.
      </p>
    </Section>
  );
}
