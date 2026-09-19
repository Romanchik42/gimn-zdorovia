import { fail, ok, parseBody } from "@/lib/api";
import { reminderShownSchema } from "@/lib/schemas/workout-feedback";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/workout/reminded — карточка с напоминанием «В прошлый раз здесь
 * было…» появилась на экране (GIMN-010). Отмечаем случаи показанными, чтобы
 * напоминание было один раз. RLS пускает только к своим строкам.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, reminderShownSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const { error } = await supabase
    .from("side_effect_events")
    .update({ reminded_at: new Date().toISOString() })
    .in("id", parsed.data.event_ids)
    .eq("user_id", user.id)
    .is("reminded_at", null);

  if (error) {
    console.error("reminded update failed:", error.message);
    return fail("Не удалось отметить", 500);
  }
  return ok({ marked: parsed.data.event_ids.length });
}
