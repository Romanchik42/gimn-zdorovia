import { fail, ok } from "@/lib/api";
import { createInvite, revokeInvite } from "@/lib/family/service";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/family/invite — создать ссылку-приглашение (GIMN-030).
 * DELETE — убрать её, не дожидаясь семи дней.
 *
 * Потолок «не больше трёх приглашённых» проверяет сервер: в браузере
 * кнопку просто не рисуют, но это не защита.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const result = await createInvite(user.id);
  if (!result.ok) return fail(result.error, 400);

  return ok({ invite: result.invite });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  await revokeInvite(user.id);
  return ok({ revoked: true });
}
