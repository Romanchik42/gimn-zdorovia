import { z } from "zod";
import type { NextRequest } from "next/server";

import { fail, ok, parseBody } from "@/lib/api";
import { isAdmin } from "@/lib/auth/admin";
import { REVIEW_ACTIONS, reviewFeedback } from "@/lib/points/feedback-review";
import { createClient } from "@/lib/supabase/server";

const actionSchema = z.object({ action: z.enum(REVIEW_ACTIONS) });

/**
 * POST /api/admin/feedback/[id]/action — решение по отзыву (GIMN-030):
 * статус плюс баллы автору плюс сообщение ему в Telegram.
 *
 * Права проверяются здесь, на сервере, и только здесь: клиент админку не
 * решает. Неадмину — 404, как и в списке.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/admin/feedback/[id]/action">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return fail("Некорректный идентификатор", 400);

  const parsed = await parseBody(request, actionSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);
  if (!(await isAdmin(user.id))) return fail("Не найдено", 404);

  const result = await reviewFeedback(id, parsed.data.action);
  if (!result.ok) return fail(result.error, 400);

  return ok(result);
}
