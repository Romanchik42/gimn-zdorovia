import { fail, ok } from "@/lib/api";
import { familyState } from "@/lib/family/service";
import { createClient } from "@/lib/supabase/server";

/** GET /api/family/members — состав семьи и активная ссылка (GIMN-030). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  return ok(await familyState(user.id));
}
