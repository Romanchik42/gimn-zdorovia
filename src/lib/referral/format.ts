/** Показываем только имя, без фамилии: приглашённому этого достаточно. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? full;
}
