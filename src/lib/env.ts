import { z } from "zod";

/**
 * Валидация переменных окружения (SPEC 3.9).
 *
 * Важно: серверные переменные проверяются ЛЕНИВО, в момент реального
 * использования, а не на импорте. Часть значений (CRON_SECRET,
 * TELEGRAM_WEBHOOK_SECRET, ADMIN_USER_ID) появится в Vercel позже —
 * жёсткая проверка на импорте роняла бы сборку всего приложения
 * из-за неготовности одной второстепенной фичи.
 */

/* ---------------------------------------------------------------------------
   Публичные переменные.
   Next подставляет NEXT_PUBLIC_* только при СТАТИЧЕСКОМ обращении к
   process.env.NEXT_PUBLIC_X — поэтому здесь они перечислены буквально,
   без динамических ключей.
   --------------------------------------------------------------------------- */
/**
 * Приводит URL Supabase к API-хосту.
 *
 * В Vercel в NEXT_PUBLIC_SUPABASE_URL лежит ссылка на дашборд
 * (https://supabase.com/dashboard/project/<ref>), а SDK нужен API-хост
 * (https://<ref>.supabase.co). Ref в обеих ссылках один и тот же, поэтому
 * чиним на лету — иначе каждый запрос к Supabase в проде уходит в никуда.
 * Правильное значение переменной всё равно стоит проставить в Vercel.
 */
export function normalizeSupabaseUrl(raw: string): string {
  if (!raw) return "";

  const dashboard = raw.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1]}.supabase.co`;

  return raw.replace(/\/+$/, "");
}

export const publicEnv = {
  supabaseUrl: normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://gimn-zdorovia.vercel.app",
  authorSiteUrl: process.env.NEXT_PUBLIC_AUTHOR_SITE_URL ?? "https://ai-arhitektor.ru",
} as const;

const publicEnvSchema = z.object({
  supabaseUrl: z.string().url("NEXT_PUBLIC_SUPABASE_URL должен быть URL"),
  supabaseAnonKey: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY пуст"),
  appUrl: z.string().url(),
  authorSiteUrl: z.string().url(),
});

/** Бросает понятную ошибку, если Supabase не сконфигурирован. */
export function requirePublicEnv() {
  const parsed = publicEnvSchema.safeParse(publicEnv);
  if (!parsed.success) {
    throw new Error(
      `Некорректные публичные переменные окружения: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

/* ---------------------------------------------------------------------------
   Серверные переменные — только для server-only модулей.
   --------------------------------------------------------------------------- */
const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().min(1).default("gimn_zdorovia_bot"),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1).optional(),
  ADMIN_USER_ID: z.string().uuid().optional().or(z.literal("")),
  CRON_SECRET: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

/** Лениво читает и валидирует серверные переменные. Кидает при отсутствии обязательных. */
export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    ADMIN_USER_ID: process.env.ADMIN_USER_ID,
    CRON_SECRET: process.env.CRON_SECRET,
  });

  if (!parsed.success) {
    throw new Error(
      `Не заданы серверные переменные окружения: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/** Мягкая проверка: настроен ли Supabase. Нужна, чтобы страницы не падали в 500. */
export function isSupabaseConfigured(): boolean {
  return publicEnvSchema.safeParse(publicEnv).success;
}
