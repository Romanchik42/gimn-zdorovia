import { DOC as USER_AGREEMENT } from "@/legal/user-agreement";
import { DOC as PRIVACY_POLICY } from "@/legal/privacy-policy";
import { DOC as DATA_CONSENT } from "@/legal/data-consent";
import type { LegalDoc } from "@/legal/document";

/**
 * Перечень юридических документов (GIMN-029).
 *
 * Одно место, где документ связан со своим адресом и именем файла. Экран
 * настроек и печатная версия берут список отсюда, поэтому добавить
 * четвёртый документ — значит дописать сюда одну строку, а не вспоминать,
 * в скольких местах он должен появиться.
 */

export const LEGAL_SLUGS = ["user-agreement", "privacy-policy", "data-consent"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

export type LegalEntry = {
  doc: LegalDoc;
  /** Имя скачиваемого файла — человеку в папку «Загрузки». */
  fileName: string;
  /** Значок в списке настроек. */
  emoji: string;
};

export const LEGAL_DOCS: Record<LegalSlug, LegalEntry> = {
  "user-agreement": {
    doc: USER_AGREEMENT,
    fileName: "Пользовательское соглашение — Гимн.здоровья.pdf",
    emoji: "📜",
  },
  "privacy-policy": {
    doc: PRIVACY_POLICY,
    fileName: "Политика конфиденциальности — Гимн.здоровья.pdf",
    emoji: "🔒",
  },
  "data-consent": {
    doc: DATA_CONSENT,
    fileName: "Согласие на обработку персональных данных — Гимн.здоровья.pdf",
    emoji: "✅",
  },
};

export function isLegalSlug(value: string): value is LegalSlug {
  return (LEGAL_SLUGS as readonly string[]).includes(value);
}
