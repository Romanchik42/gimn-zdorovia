import { z } from "zod";

import { fail, ok, parseBody, rateLimit } from "@/lib/api";
import { INVITE_CODE_LENGTH } from "@/lib/family/rules";
import { joinFamily } from "@/lib/family/service";
import { createClient } from "@/lib/supabase/server";

const joinSchema = z.object({ code: z.string().trim().length(INVITE_CODE_LENGTH) });

/**
 * POST /api/family/join — принять приглашение (GIMN-030).
 *
 * Ограничение частоты здесь не для нагрузки: код короткий, и без него
 * ссылку можно было бы подбирать перебором, войдя под любым аккаунтом.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, joinSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  if (!rateLimit(`family-join:${user.id}`, 10, 10 * 60_000)) {
    return fail("Слишком много попыток. Попробуйте позже.", 429);
  }

  const result = await joinFamily(parsed.data.code, user.id);
  if (!result.ok) return fail(result.error, 400);

  return ok({ ownerName: result.ownerName });
}
