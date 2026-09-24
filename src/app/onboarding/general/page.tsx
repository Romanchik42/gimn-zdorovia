import { GeneralForm } from "@/components/onboarding/general-form";
import { ContextHint } from "@/components/tour/context-hint";
import { safeNext } from "@/lib/navigation/safe-next";
import { createClient } from "@/lib/supabase/server";
import { parseEquipmentList } from "@/lib/workout-engine/equipment";
import type { GeneralProfileInput } from "@/lib/schemas/diagnostics";

export const metadata = { title: "Анкета — Гимн.здоровья" };

/**
 * Анкета общего режима. Открывается и повторно — из настроек, чтобы сменить
 * цель, уровень или ответ про турник, поэтому прошлые ответы подставляются
 * (GIMN-014). Возраст и пол живут в users, остальное — в user_profiles_general.
 */
export default async function GeneralPage({ searchParams }: PageProps<"/onboarding/general">) {
  const { keep_mode, next } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initial: Partial<GeneralProfileInput> | null = null;

  if (user) {
    const [{ data: profile }, { data: general }] = await Promise.all([
      supabase.from("users").select("gender, birth_date").eq("id", user.id).maybeSingle(),
      supabase
        .from("user_profiles_general")
        // "*": training_location и gym_equipment появляются только с
        // миграцией 0021, а перечисление колонок уронило бы весь запрос до
        // её применения — анкета открылась бы пустой.
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    if (general) {
      // Дату рождения пишем как 1 января года рождения (анкета спрашивает
      // только возраст), поэтому обратно считаем по году — точнее и не нужно.
      const birthYear = profile?.birth_date ? Number(profile.birth_date.slice(0, 4)) : null;

      initial = {
        ...(profile?.gender ? { gender: profile.gender } : {}),
        ...(birthYear ? { age_years: new Date().getFullYear() - birthYear } : {}),
        weight_kg: Number(general.weight_kg),
        height_cm: Number(general.height_cm),
        goal: general.goal,
        activity_level: general.activity_level,
        difficulty: general.difficulty,
        training_days: general.training_days,
        has_turnik: general.has_turnik,
        training_location: general.training_location ?? "home",
        gym_equipment: parseEquipmentList(general.gym_equipment),
      };
    }
  }

  return (
    <div className="space-y-4">
      {/* Подсказка при первом заполнении (GIMN-029). Повторно человек
          приходит сюда из настроек — там она уже не нужна. */}
      <ContextHint id="general-profile" active={initial === null} />
      <GeneralForm
        keepMode={keep_mode === "1"}
        next={safeNext(next, "/onboarding/theme")}
        initial={initial}
      />
    </div>
  );
}
