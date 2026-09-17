import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/types";

/**
 * Клиент с service_role — ОБХОДИТ RLS.
 *
 * `import "server-only"` здесь не для красоты: попадание этого модуля
 * в клиентский бандл означало бы утечку ключа, дающего полный доступ к БД
 * (SPEC 5.8). Сборка упадёт, если кто-то импортирует его из клиента.
 *
 * Использовать только там, где действие выполняется от имени системы:
 * регистрация, крон-рассылки, Telegram-вебхук.
 */
export function createAdminClient() {
  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();

  return createSupabaseClient<Database>(publicEnv.supabaseUrl, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
