/**
 * Схема БД ещё не применена (таблиц нет). Отдельный тип ошибки нужен, чтобы
 * крон отвечал понятным 503, а не безликим 500: по истории запусков в
 * cron-job.org сразу видно, что дело в неприменённых миграциях, а не в коде.
 */
export class SchemaMissingError extends Error {
  constructor() {
    super("database schema not applied: run supabase/migrations/*.sql and supabase/seed.sql");
  }
}

/** PGRST205 — PostgREST не видит таблицу; 42P01 — Postgres: relation does not exist. */
export function isSchemaMissing(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST205" || error?.code === "42P01";
}
