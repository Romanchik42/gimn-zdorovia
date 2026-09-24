import { fail, ok } from "@/lib/api";
import { isAdmin } from "@/lib/auth/admin";
import { listFeedback } from "@/lib/points/feedback-review";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/feedback — все отзывы для разбора (GIMN-030).
 *
 * Неадмину отвечаем 404, а не 403: 403 подтверждает, что такая ручка есть
 * и кто-то ею пользуется. Знать это посторонним незачем.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);
  if (!(await isAdmin(user.id))) return fail("Не найдено", 404);

  return ok({ items: await listFeedback() });
}
