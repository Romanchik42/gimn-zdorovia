import { fail, ok, parseBody } from "@/lib/api";
import { switchModeSchema } from "@/lib/schemas/modes";
import { createClient } from "@/lib/supabase/server";
import { loadModes, switchMode } from "@/lib/modes/server";

/**
 * POST /api/modes/switch — сменить текущий режим (GIMN-012).
 *
 * Только между режимами, которыми человек уже занимается: включение нового
 * режима идёт через его анкету, иначе программу было бы не из чего собрать.
 * Данные второго режима остаются на месте — переключение ничего не удаляет.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, switchModeSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const switched = await switchMode(supabase, user.id, parsed.data.mode);
  if (!switched) {
    return fail("Этим режимом вы ещё не занимаетесь — сначала заполните анкету", 409);
  }

  const modes = await loadModes(supabase, user.id);
  return ok({ current: modes.current, active: modes.active });
}
