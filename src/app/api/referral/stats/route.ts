import { ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/referral/stats (SPEC 3.5, US-13).
 * Всем — общее число пользователей («Нас уже 247»), без персональных данных.
 * Залогиненному — ещё и сколько человек пришло по его ссылке.
 * Подробная аналитика — только на /admin/stats с проверкой на сервере.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { count: total } = await admin.from("users").select("id", { count: "exact", head: true });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return ok({ total_users: total ?? 0 });

  // RLS отдаст ровно тех, кого пригласил сам пользователь.
  const { count: invited } = await supabase
    .from("referrals")
    .select("id", { count: "exact", head: true })
    .eq("referrer_id", user.id);

  return ok({ total_users: total ?? 0, invited: invited ?? 0 });
}
