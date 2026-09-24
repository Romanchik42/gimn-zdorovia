import { z } from "zod";

import { fail, ok, parseBody } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { HINT_IDS, parseHintsSeen } from "@/lib/tour/hints";

/**
 * Контекстные подсказки: какие уже показаны (GIMN-029).
 *
 * Отдельной ручкой, а не полем в запросе страницы: колонка hints_seen
 * появляется миграцией 0028, а деплой и миграция не атомарны. Перечисление
 * её в запросе страницы уронило бы всю страницу до применения миграции —
 * ради подсказки, без которой прекрасно живут.
 */
const hintSchema = z.object({ hint: z.enum(HINT_IDS) });

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  // "*" по той же причине: до миграции запрос с именем колонки — ошибка.
  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();

  return ok({ seen: parseHintsSeen((data as { hints_seen?: unknown } | null)?.hints_seen) });
}

export async function POST(request: Request) {
  const parsed = await parseBody(request, hintSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Нужно войти", 401);

  const { data } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  const seen = parseHintsSeen((data as { hints_seen?: unknown } | null)?.hints_seen);

  if (seen.includes(parsed.data.hint)) return ok({ seen });

  const next = [...seen, parsed.data.hint];
  const { error } = await supabase
    .from("users")
    .update({ hints_seen: next } as never)
    .eq("id", user.id);

  if (error) {
    // Не сохранилось — подсказка покажется ещё раз. Неприятно, но не повод
    // ронять экран, на котором человек чем-то занят.
    console.error("hint save failed:", error.message);
    return ok({ seen });
  }

  return ok({ seen: next });
}
