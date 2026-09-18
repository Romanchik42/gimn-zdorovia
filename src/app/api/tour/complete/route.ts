import { z } from "zod";

import { fail, ok, parseBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/tour/complete (SPEC 3.7).
 * Флаг хранится в БД, а не в браузере: пройденный тур не покажется снова
 * и на другом устройстве (US-11). reset: true — «Показать тур заново».
 */
const tourSchema = z.object({
  tour_type: z.enum(["app", "workout"]),
  reset: z.boolean().default(false),
});

export async function POST(request: Request) {
  const parsed = await parseBody(request, tourSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const done = !parsed.data.reset;
  const patch =
    parsed.data.tour_type === "app"
      ? { tour_completed: done, tour_completed_at: done ? new Date().toISOString() : null }
      : { workout_tour_completed: done };

  const { error } = await supabase.from("users").update(patch).eq("id", user.id);
  if (error) return fail("Не удалось сохранить", 500);

  return ok({ tour_type: parsed.data.tour_type, completed: done });
}
