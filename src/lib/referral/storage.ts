/**
 * Реферальный код живёт в localStorage между переходом по ссылке /i/CODE
 * и регистрацией. Серверу он передаётся как подсказка и всё равно
 * перепроверяется по БД (SPEC 5.8 — подделке referred_by не верим).
 */

export const REFERRAL_STORAGE_KEY = "gz-referral-code";

export function rememberReferralCode(code: string): void {
  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // приватный режим — реферал просто не зачтётся
  }
}

export function readReferralCode(): string | null {
  try {
    return window.localStorage.getItem(REFERRAL_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearReferralCode(): void {
  try {
    window.localStorage.removeItem(REFERRAL_STORAGE_KEY);
  } catch {
    // ничего не делаем
  }
}
