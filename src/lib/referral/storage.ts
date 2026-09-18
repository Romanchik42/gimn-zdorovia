/**
 * Реферальный код живёт в localStorage между переходом по ссылке /i/CODE
 * и регистрацией (SPEC 5.7: 30 дней). Серверу он передаётся как подсказка
 * и всё равно перепроверяется по БД — подделке referred_by не верим (SPEC 5.8).
 */

export const REFERRAL_STORAGE_KEY = "gz-referral-code";

export const REFERRAL_SOURCES = ["link", "qr", "telegram", "share"] as const;
export type StoredReferralSource = (typeof REFERRAL_SOURCES)[number];

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

type Stored = { code: string; source: StoredReferralSource; savedAt: number };

export function rememberReferralCode(code: string, source: StoredReferralSource = "link"): void {
  try {
    const value: Stored = { code, source, savedAt: Date.now() };
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // приватный режим — реферал просто не зачтётся
  }
}

function readStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(REFERRAL_STORAGE_KEY);
    if (!raw) return null;
    // Старый формат (просто строка кода) тоже понимаем.
    const parsed = raw.startsWith("{") ? (JSON.parse(raw) as Stored) : { code: raw, source: "link" as const, savedAt: Date.now() };
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readReferralCode(): string | null {
  return readStored()?.code ?? null;
}

export function readReferralSource(): StoredReferralSource | null {
  return readStored()?.source ?? null;
}

export function clearReferralCode(): void {
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ничего не делаем
  }
}
