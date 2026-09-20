import "server-only";

import type { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMode, type Mode } from "@/lib/modes";
import type { UserModeRow } from "@/lib/supabase/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Режимы пользователя (GIMN-012).
 *
 * Текущий режим — users.mode: в нём человек сейчас занимается и его данные
 * показываются. Активные — строки user_modes с is_active: их может быть два.
 *
 * Весь остальной код спрашивает режим здесь, а не читает users.mode напрямую,
 * чтобы «данные текущего режима» означало одно и то же везде.
 */

export const DEFAULT_MODE: Mode = "general";

export type ModesState = {
  current: Mode;
  active: Mode[];
  /** Есть ли второй активный режим — от этого зависит переключалка на главном. */
  hasBoth: boolean;
};

/** Текущий режим пользователя. Нет строки — общий режим, как при регистрации. */
export async function currentMode(supabase: ServerClient, userId: string): Promise<Mode> {
  const { data } = await supabase.from("users").select("mode").eq("id", userId).maybeSingle();
  return isMode(data?.mode) ? data.mode : DEFAULT_MODE;
}

export async function loadModes(supabase: ServerClient, userId: string): Promise<ModesState> {
  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("users").select("mode").eq("id", userId).maybeSingle(),
    supabase.from("user_modes").select("mode, is_active").eq("user_id", userId),
  ]);

  const current = isMode(profile?.mode) ? profile.mode : DEFAULT_MODE;
  const active = ((rows ?? []) as Pick<UserModeRow, "mode" | "is_active">[])
    .filter((r) => r.is_active && isMode(r.mode))
    .map((r) => r.mode);

  // Старые аккаунты появились до 0015 — их текущий режим активен по факту.
  if (!active.includes(current)) active.push(current);

  return { current, active, hasBoth: active.length > 1 };
}

/**
 * Отметить, что человек занимается этим режимом, и сделать его текущим.
 * Вызывается после анкеты режима (диагностика или профиль общего режима).
 *
 * users.mode и user_modes пишутся служебным ключом: право менять mode
 * пользователю не выдано (0011), иначе режим можно было бы подменить из консоли.
 */
export async function activateMode(userId: string, mode: Mode): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  await admin
    .from("user_modes")
    .upsert(
      { user_id: userId, mode, is_active: true, last_used_at: now },
      { onConflict: "user_id,mode" },
    );
  await admin.from("users").update({ mode }).eq("id", userId);
}

/** Переключить текущий режим. Возвращает false, если этим режимом не занимаются. */
export async function switchMode(
  supabase: ServerClient,
  userId: string,
  mode: Mode,
): Promise<boolean> {
  const { active } = await loadModes(supabase, userId);
  if (!active.includes(mode)) return false;

  const admin = createAdminClient();
  await admin.from("users").update({ mode }).eq("id", userId);
  await admin
    .from("user_modes")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("mode", mode);
  return true;
}
