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

  // «Показать тур заново» возвращает и контекстные подсказки (GIMN-030).
  //
  // До этого сброс чистил только tour_completed, а hints_seen оставался, —
  // и подсказки про баллы и анкету, однажды закрытые, не возвращались
  // никогда. Именно поэтому их «никто не видел»: проверить их после
  // первого прохода было нечем, и выглядело это как будто они не работают
  // вовсе. Кнопка обещает тур заново — значит, заново целиком.
  const patch =
    parsed.data.tour_type === "app"
      ? {
          tour_completed: done,
          tour_completed_at: done ? new Date().toISOString() : null,
          ...(parsed.data.reset ? { hints_seen: [] } : {}),
        }
      : { workout_tour_completed: done };

  const { error } = await supabase.from("users").update(patch).eq("id", user.id);
  if (error) return fail("Не удалось сохранить", 500);

  return ok({ tour_type: parsed.data.tour_type, completed: done });
}
