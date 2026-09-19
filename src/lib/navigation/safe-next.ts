/** Только свои пути: «//evil.com», «/\evil» или полный URL увели бы человека с сайта. */
export function safeNext(value: string | string[] | undefined | null, fallback = "/app"): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
