import { fail, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { getPointsHistory } from "@/lib/points/service";

/** GET /api/points/history — история начислений и обменов (GIMN-027). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  return ok({ history: await getPointsHistory(user.id) });
}
