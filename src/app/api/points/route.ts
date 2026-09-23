import { fail, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { getUserPoints } from "@/lib/points/service";

/** GET /api/points — остаток баллов (GIMN-027). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  return ok({ points: await getUserPoints(user.id) });
}
