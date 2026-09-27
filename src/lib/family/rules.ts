/**
 * Правила семейного тарифа (GIMN-030).
 *
 * Модуль чистый — ни базы, ни сети. Всё, что здесь описано, проверяется
 * без живой базы в check:family: ограничение «четыре профиля» и срок
 * приглашения — это про деньги, и ошибка в них видна только по счёту.
 *
 * Почему ограничение живёт в коде, а не констрейнтом в базе: количество
 * считается по строкам другой таблицы, и констрейнт пришлось бы делать
 * триггером. Триггер ломал бы наполнение тестовыми данными и молчал бы
 * там, где нужно человеческое объяснение, почему приглашать больше нельзя.
 */

/** Всего профилей в семье: владелец плюс приглашённые. */
export const FAMILY_MAX_PROFILES = 4;

/** Сколько человек владелец может привести. */
export const FAMILY_MAX_MEMBERS = FAMILY_MAX_PROFILES - 1;

/** Сколько живёт ссылка-приглашение. */
export const INVITE_TTL_DAYS = 7;

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";
const CODE_LENGTH = 8;

export const INVITE_CODE_LENGTH = CODE_LENGTH;
export const INVITE_CODE_PATTERN = new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`);

/**
 * Код приглашения. В отличие от реферального его не диктуют голосом —
 * ссылку присылают целиком, — поэтому алфавит шире и регистр значим:
 * 55^8 против 31^6 у реферального. Приглашение открывает доступ к чужой
 * оплате, и подобрать его перебором не должно получаться.
 */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
  return code;
}

export function isValidInviteCode(code: string): boolean {
  return INVITE_CODE_PATTERN.test(code);
}

/** Когда ссылка перестанет работать. */
export function inviteExpiresAt(from: Date = new Date()): string {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 86_400_000).toISOString();
}

export type InviteState = "active" | "used" | "expired";

/**
 * Состояние приглашения. «Использовано» важнее «просрочено»: по ссылке,
 * которой уже воспользовались, человек должен получить понятный ответ, а
 * не рассказ про срок.
 */
export function inviteState(
  invite: { expiresAt: string; usedBy: string | null },
  now: Date = new Date(),
): InviteState {
  if (invite.usedBy) return "used";
  return new Date(invite.expiresAt).getTime() <= now.getTime() ? "expired" : "active";
}

export const INVITE_STATE_MESSAGES: Record<Exclude<InviteState, "active">, string> = {
  used: "По этой ссылке уже присоединились. Попросите владельца создать новую.",
  expired: `Срок ссылки истёк — она действует ${INVITE_TTL_DAYS} дней. Попросите новую.`,
};

/** Можно ли позвать ещё одного при таком числе уже присоединившихся. */
export function canInvite(memberCount: number): boolean {
  return memberCount < FAMILY_MAX_MEMBERS;
}

/** «Моя семья (2 из 4)» — владелец в счёт входит. */
export function familySize(memberCount: number): number {
  return memberCount + 1;
}

/** Почему присоединиться нельзя. null — можно. */
export function joinRefusal(input: {
  ownerId: string;
  joinerId: string;
  memberCount: number;
  /** Джойнер уже состоит в какой-нибудь семье. */
  joinerHasFamily: boolean;
}): string | null {
  if (input.ownerId === input.joinerId) {
    return "Это ваше собственное приглашение — вы уже глава этой семьи.";
  }
  if (input.joinerHasFamily) {
    return "Вы уже состоите в семье. Сначала выйдите из неё.";
  }
  if (!canInvite(input.memberCount)) {
    return `В семье уже ${FAMILY_MAX_PROFILES} профиля — больше подключить нельзя.`;
  }
  return null;
}
