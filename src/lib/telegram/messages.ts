import "server-only";

import { format } from "date-fns";
import { ru } from "date-fns/locale";

import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays, dayOfWeek, todayIso } from "@/lib/dates";
import { MEAL_TYPE_LABELS } from "@/lib/schemas/nutrition";
import { focusLabel } from "@/lib/workout-engine/weekly-cycle";
import { isMode, type Mode } from "@/lib/modes";
import type { InlineButton } from "@/lib/telegram/bot";
import type { MealType } from "@/lib/supabase/types";

/**
 * Тексты бота и рассылок. Только простой текст — parse_mode не используется,
 * поэтому никакого экранирования не нужно и ничего не может «сломаться».
 */

type Admin = ReturnType<typeof createAdminClient>;

/** Обычные ссылки — для пересылки тем, у кого нашего бота нет. */
export const APP_LINKS = {
  invite: (code: string) => `${publicEnv.appUrl}/i/${code}`,
};

/**
 * Адрес приложения для Web App. Всё идёт через /tg: там сессия открывается
 * по подписанному initData, и только потом — переход на нужный экран.
 * ref — код приглашения, если человек пришёл по ссылке друга.
 */
export function webAppUrl(path = "/app", ref?: string): string {
  const query = new URLSearchParams({ next: path });
  if (ref) query.set("ref", ref);
  return `${publicEnv.appUrl}/tg?${query}`;
}

/** Кнопка открывает приложение внутри Telegram (Web App), вход — автоматически. */
export function openAppButton(text = "Открыть приложение", url = webAppUrl()): InlineButton[][] {
  // Синяя (primary) — кнопка бота в самом Telegram; в приложении цвета по теме.
  return [[{ text, web_app: { url }, style: "primary" }]];
}

function longDate(iso: string): string {
  return format(new Date(`${iso}T12:00:00Z`), "d MMMM", { locale: ru });
}

export const HELP_TEXT = [
  "Гимн.здоровья — гимнастика для здоровья.",
  "",
  "Команды:",
  "/today — тренировка на сегодня",
  "/menu — меню на сегодня",
  "/progress — краткий отчёт",
  "/invite — пригласить друга (ссылка и QR-код)",
  "/help — эта подсказка",
].join("\n");

export const NOT_REGISTERED_TEXT =
  "Похоже, вы ещё не зарегистрированы. Откройте приложение — вход через Telegram произойдёт сам.";

/**
 * «Домашнее» сообщение — единственное, что бот держит в чате после /start.
 * Коротко и с одной кнопкой: всё остальное — внутри приложения.
 */
export const HOME_TEXT = {
  guest: "Гимн.здоровья — гимнастика для здоровья. Откройте приложение: вход через Telegram произойдёт сам.",
  user: (name: string) => `${name}, тренировка и меню на сегодня — в приложении.`,
  linked: "Telegram привязан. Сюда будут приходить только напоминания и отчёты.",
  linkedElsewhere: "Этот Telegram уже привязан к другому аккаунту Гимн.здоровья.",
  linkFailed: "Не удалось привязать Telegram. Попробуйте ещё раз из настроек приложения.",
  invited: "Вас пригласили в Гимн.здоровья — гимнастику для здоровья.",
};

/**
 * Текущий режим — бот показывает то же, что приложение (GIMN-012).
 * Читаем служебным ключом: бот работает вне пользовательской сессии.
 */
async function modeOf(admin: Admin, userId: string): Promise<Mode> {
  const { data } = await admin.from("users").select("mode").eq("id", userId).maybeSingle();
  return isMode(data?.mode) ? data.mode : "general";
}

export async function todayText(admin: Admin, userId: string): Promise<string> {
  const today = todayIso();
  const mode = await modeOf(admin, userId);

  const { data: day } = await admin
    .from("user_week_plan")
    .select("focus, duration_min, is_rest_day")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("day_of_week", dayOfWeek(today))
    .maybeSingle();

  const { data: done } = await admin
    .from("user_workouts")
    .select("id")
    .eq("user_id", userId)
    .eq("mode", mode)
    .eq("scheduled_date", today)
    .eq("status", "completed")
    .limit(1)
    .maybeSingle();

  if (!day) return "План на неделю ещё не составлен. Откройте приложение — он соберётся за минуту.";

  const lines = [
    day.is_rest_day
      ? `Сегодня день отдыха: ${focusLabel(day.focus).toLowerCase()}, около ${day.duration_min} минут.`
      : `Сегодня: ${focusLabel(day.focus)}, около ${day.duration_min} минут.`,
  ];
  if (done) lines.push("Тренировка уже сделана — отлично!");
  return lines.join("\n");
}

export async function menuText(admin: Admin, userId: string): Promise<string | null> {
  const today = todayIso();
  const { data: rows } = await admin
    .from("user_meals")
    .select("meal_type, portion, meals(name, total_kcal)")
    .eq("user_id", userId)
    .eq("mode", await modeOf(admin, userId))
    .eq("date", today);

  if (!rows?.length) return null;

  const order: MealType[] = ["breakfast", "lunch", "snack", "dinner"];
  let total = 0;
  const lines = order.flatMap((type) => {
    const row = rows.find((r) => r.meal_type === type);
    // Связь meals приходит объектом; типы БД написаны вручную без связей.
    const meal = (row as unknown as { meals?: { name: string; total_kcal: number } } | undefined)?.meals;
    if (!row || !meal) return [];
    const kcal = Math.round(meal.total_kcal * Number(row.portion ?? 1));
    total += kcal;
    return [`${MEAL_TYPE_LABELS[type]}: ${meal.name} — ${kcal} ккал`];
  });

  return ["Меню на сегодня:", ...lines, "", `Итого: ${total} ккал`].join("\n");
}

export async function progressText(admin: Admin, userId: string): Promise<string> {
  const today = todayIso();
  const mode = await modeOf(admin, userId);
  const [{ count: week }, { count: month }, { data: last }, { data: user }] = await Promise.all([
    admin
      .from("user_workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("status", "completed")
      .gte("scheduled_date", addDays(today, -6)),
    admin
      .from("user_workouts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("mode", mode)
      .eq("status", "completed")
      .gte("scheduled_date", addDays(today, -29)),
    admin
      .from("user_progress")
      .select("date, weight_kg, shober_test_cm")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin.from("users").select("next_report_date").eq("id", userId).maybeSingle(),
  ]);

  const lines = [
    "Ваш прогресс:",
    `Тренировок за 7 дней: ${week ?? 0}`,
    `Тренировок за 30 дней: ${month ?? 0}`,
  ];
  if (last?.weight_kg) lines.push(`Последний вес: ${String(last.weight_kg).replace(".", ",")} кг`);
  if (last?.shober_test_cm) lines.push(`Тест Шобера: ${String(last.shober_test_cm).replace(".", ",")} см`);
  if (user?.next_report_date) lines.push("", `Следующий персональный отчёт: ${longDate(user.next_report_date)}`);
  return lines.join("\n");
}
