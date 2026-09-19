import { fail, ok } from "@/lib/api";
import { isAdmin, resetOwnAccount } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/admin/reset — админ сбрасывает СВОЙ аккаунт, чтобы пройти
 * путь нового пользователя заново. Права проверяются здесь, на сервере.
 * После сброса сессия закрывается — следующий вход ведёт в онбординг.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  if (!(await isAdmin(user.id))) return fail("Только для администратора", 403);

  try {
    const { cleared } = await resetOwnAccount(user.id);
    await supabase.auth.signOut();
    return ok({ cleared, next: "/auth/login" });
  } catch (e) {
    console.error("admin reset failed:", e);
    return fail("Не удалось сбросить аккаунт", 500);
  }
}
