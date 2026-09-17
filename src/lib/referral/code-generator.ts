/**
 * Генерация реферального кода (SPEC 2.4).
 * Алфавит без похожих символов: нет 0/O, 1/I/L — код диктуют голосом
 * и переписывают с QR, поэтому путаница символов дороже, чем размер алфавита.
 * Пространство: 31^6 ≈ 887 млн комбинаций.
 */

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export const REFERRAL_CODE_LENGTH = CODE_LENGTH;
export const REFERRAL_CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

export function generateReferralCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export function isValidReferralCode(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(code);
}

/**
 * Нормализация кода, введённого руками или пришедшего из ссылки.
 * Символы 0/O/1/I/L в алфавит не входят вовсе, поэтому «приводить» их
 * не к чему — просто отбрасываем всё, чего в алфавите нет.
 */
export function normalizeReferralCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .split("")
    .filter((ch) => ALPHABET.includes(ch))
    .join("")
    .slice(0, CODE_LENGTH);
}

export const MAX_CODE_ATTEMPTS = 5;

/**
 * Подбирает свободный код. `insert` должен вернуть true при успехе и
 * false при конфликте уникальности (код занят) — тогда пробуем ещё раз.
 */
export async function withUniqueReferralCode<T>(
  insert: (code: string) => Promise<T | null>,
): Promise<{ code: string; result: T }> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = generateReferralCode();
    const result = await insert(code);
    if (result !== null) return { code, result };
  }
  throw new Error(
    `Не удалось подобрать свободный реферальный код за ${MAX_CODE_ATTEMPTS} попыток`,
  );
}
