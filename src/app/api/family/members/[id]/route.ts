import { z } from "zod";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { removeMember } from "@/lib/family/service";
import { createClient } from "@/lib/supabase/server";

/**
 * DELETE /api/family/members/[id] — вывести человека из семьи (GIMN-030).
 *
 * Удаляется только связь. Прогресс, замеры, план и история остаются у
 * обоих: расставание по оплате — не повод стирать чьи-то занятия.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/family/members/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return fail("Некорректный идентификатор", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const result = await removeMember(id, user.id);
  if (!result.ok) return fail(result.error ?? "Не удалось", 400);

  return ok({ id });
}
