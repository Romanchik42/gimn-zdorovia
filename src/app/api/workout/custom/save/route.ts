import { fail, ok, parseBody } from "@/lib/api";
import { MAX_CUSTOM_TEMPLATES, customSaveSchema } from "@/lib/schemas/workout";
import { createClient } from "@/lib/supabase/server";
import { currentMode } from "@/lib/modes/server";

/** POST /api/workout/custom/save — сохранение шаблона (SPEC 3.2). */
export async function POST(request: Request) {
  const parsed = await parseBody(request, customSaveSchema);
  if (parsed.error) return parsed.error;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  const mode = await currentMode(supabase, user.id);

  // Лимит шаблонов — на режим: программы разных режимов не делят одну квоту.
  const { count } = await supabase
    .from("user_custom_workouts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("mode", mode);

  if ((count ?? 0) >= MAX_CUSTOM_TEMPLATES) {
    return fail(`Максимум ${MAX_CUSTOM_TEMPLATES} шаблонов. Удалите ненужные.`, 400);
  }

  const { data, error } = await supabase
    .from("user_custom_workouts")
    .insert({
      user_id: user.id,
      mode,
      name: parsed.data.name,
      focus: parsed.data.focus,
      duration_min: parsed.data.duration_min,
      intensity: parsed.data.intensity,
      exercises_order: parsed.data.exercises_order,
    })
    .select("id")
    .single();

  if (error) {
    console.error("custom template insert failed:", error.message);
    return fail("Не удалось сохранить шаблон", 500);
  }

  return ok({ id: data.id });
}
