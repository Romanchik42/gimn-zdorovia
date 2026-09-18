import { fail, ok, parseBody } from "@/lib/api";
import { userSettingsSchema } from "@/lib/schemas/user";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/settings — частичное обновление настроек (US-08, US-10).
 * Пишем только присланные поля: одна форма меняет звук, другая — напоминания.
 */
export async function POST(request: Request) {
  const parsed = await parseBody(request, userSettingsSchema);
  if (parsed.error) return parsed.error;

  // Поля без значения отбросит сериализация — в UPDATE уйдёт только присланное.
  const patch = parsed.data;
  const fields = Object.keys(patch).filter((k) => patch[k as keyof typeof patch] !== undefined);
  if (fields.length === 0) return fail("Нечего сохранять", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  // RLS разрешает пользователю менять только свою строку; is_admin и
  // реферальные поля в схему не входят, поэтому через этот роут их не поднять.
  const { error } = await supabase.from("users").update(patch).eq("id", user.id);
  if (error) {
    console.error("settings update failed:", error.message);
    return fail("Не удалось сохранить настройки", 500);
  }

  return ok({ saved: fields });
}
