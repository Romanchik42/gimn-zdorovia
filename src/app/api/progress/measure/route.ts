import { fail, ok, parseBody } from "@/lib/api";
import { MEASUREMENT_FIELDS, measurementSchema, weightJumpWarning } from "@/lib/schemas/progress";
import { createClient } from "@/lib/supabase/server";
import { todayIso } from "@/lib/dates";

/**
 * POST /api/progress/measure — замер за сегодня (US-09, расширен в GIMN-028).
 *
 * Одна строка на день: повторный замер дополняет её, не стирая то, что в
 * этот раз не заполняли. Поэтому каждое поле берётся из нового значения,
 * а при его отсутствии — из уже записанного.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, measurementSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const date = todayIso();

  // "*": колонки обхватов появляются с миграцией 0024, а деплой и миграция
  // не атомарны — перечисление уронило бы весь запрос до её применения.
  const { data: current } = await supabase
    .from("user_progress")
    .select("*")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  // Прошлый замер веса — чтобы заметить опечатку. Сегодняшний не в счёт:
  // сравнивать значение с ним же самим смысла нет.
  const { data: previous } = await supabase
    .from("user_progress")
    .select("weight_kg")
    .eq("user_id", user.id)
    .lt("date", date)
    .not("weight_kg", "is", null)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const m = parsed.data;
  const row: Record<string, unknown> = { user_id: user.id, date };

  for (const field of MEASUREMENT_FIELDS) {
    row[field] = m[field] ?? (current as Record<string, unknown> | null)?.[field] ?? null;
  }
  row.notes = m.notes ?? (current as Record<string, unknown> | null)?.notes ?? null;

  const { error } = await supabase
    .from("user_progress")
    .upsert(row as never, { onConflict: "user_id,date" });

  if (error) {
    console.error("measurement upsert failed:", error.message);
    return fail("Не удалось сохранить замер", 500);
  }

  // Замер сохранён в любом случае: предупреждение — это повод перепроверить,
  // а не причина потерять введённое.
  return ok({ date, warning: weightJumpWarning(previous?.weight_kg, m.weight_kg) });
}
