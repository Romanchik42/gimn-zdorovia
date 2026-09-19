import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { addDays, todayIso } from "@/lib/dates";

/**
 * Проверка прав администратора — только на сервере (SPEC: is_admin не на клиенте).
 * Источник — флаг users.is_admin или ADMIN_USER_ID из окружения; во втором
 * случае флаг подтягиваем в БД, чтобы работали RLS-политики «админ видит всё».
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("is_admin").eq("id", userId).maybeSingle();
  if (me?.is_admin) return true;

  let envAdminId: string | null = null;
  try {
    envAdminId = serverEnv().ADMIN_USER_ID || null;
  } catch {
    envAdminId = null;
  }
  if (envAdminId !== userId) return false;

  if (me) await admin.from("users").update({ is_admin: true }).eq("id", userId);
  return true;
}

/** Таблицы с данными пользователя. Отметки и побочки уходят каскадом, но чистим явно. */
const USER_TABLES = [
  "workout_feedback_via_workouts",
  "side_effect_events",
  "user_workouts",
  "user_custom_workouts",
  "user_week_plan",
  "user_diagnostics",
  "user_profiles_general",
  "user_meals",
  "shopping_list",
  "user_progress",
  "personal_reports",
  "notifications_log",
] as const;

/**
 * «Сбросить мой аккаунт» для теста (GIMN-010). Стирает ТОЛЬКО данные этого
 * пользователя и возвращает профиль к состоянию «только что пришёл»: без
 * недельного плана приложение снова ведёт в онбординг.
 *
 * Сам аккаунт, Telegram-привязка, реферальный код и флаг админа остаются:
 * удаление учётки обнулило бы referred_by у приглашённых им людей — а других
 * пользователей сброс трогать не должен.
 */
export async function resetOwnAccount(userId: string): Promise<{ cleared: Record<string, number> }> {
  const admin = createAdminClient();
  const cleared: Record<string, number> = {};

  for (const table of USER_TABLES) {
    if (table === "workout_feedback_via_workouts") {
      // У отметок нет user_id — находим через тренировки пользователя.
      const { data: workouts } = await admin.from("user_workouts").select("id").eq("user_id", userId);
      const ids = (workouts ?? []).map((w) => w.id);
      if (ids.length) {
        const { count, error } = await admin
          .from("workout_feedback")
          .delete({ count: "exact" })
          .in("user_workout_id", ids);
        if (error) throw new Error(`workout_feedback: ${error.message}`);
        cleared.workout_feedback = count ?? 0;
      }
      continue;
    }
    const { count, error } = await admin.from(table).delete({ count: "exact" }).eq("user_id", userId);
    if (error) throw new Error(`${table}: ${error.message}`);
    cleared[table] = count ?? 0;
  }

  const { data: me } = await admin.from("users").select("telegram_id").eq("id", userId).maybeSingle();
  if (me?.telegram_id) {
    await admin.from("telegram_chats").delete().eq("chat_id", me.telegram_id);
  }

  const { error } = await admin
    .from("users")
    .update({
      mode: "general",
      workout_length: null,
      tour_completed: false,
      tour_completed_at: null,
      workout_tour_completed: false,
      next_report_date: addDays(todayIso(), 30),
    })
    .eq("id", userId);
  if (error) throw new Error(`users: ${error.message}`);

  return { cleared };
}
