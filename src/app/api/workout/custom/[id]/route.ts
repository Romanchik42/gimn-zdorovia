import { z } from "zod";
import type { NextRequest } from "next/server";

import { fail, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

/** DELETE /api/workout/custom/[id] — удалить свой шаблон (лимит 20, SPEC 3.2). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/workout/custom/[id]">) {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return fail("Некорректный идентификатор", 400);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return fail("Нужно войти", 401);

  // RLS и так не даст удалить чужое; user_id в фильтре — чтобы честно вернуть 404.
  const { data, error } = await supabase
    .from("user_custom_workouts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");

  if (error) return fail("Не удалось удалить шаблон", 500);
  if (!data?.length) return fail("Шаблон не найден", 404);

  return ok({ id });
}
