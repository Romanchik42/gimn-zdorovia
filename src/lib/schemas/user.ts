import { z } from "zod";

import { THEMES } from "@/lib/themes";

/**
 * Единая Zod-схема пользователя — одна на клиент и сервер (SPEC 3.8).
 * Формы валидируют ей же, что и API, поэтому правила не расходятся.
 */

export const MODES = ["behtereva", "general"] as const;
export const SOUND_PACKS = ["soft", "energetic", "minimal", "none"] as const;

export const modeSchema = z.enum(MODES);
export const themeSchema = z.enum(THEMES);
export const soundPackSchema = z.enum(SOUND_PACKS);

export const userSchema = z.object({
  telegram_id: z.number().int().positive().optional(),
  email: z.email("Некорректный email").optional(),
  name: z.string().trim().min(2, "Имя от 2 символов").max(100, "Имя до 100 символов"),
  gender: z.enum(["male", "female"]).optional(),
  mode: modeSchema,
  theme: themeSchema.default("sage"),
});

export type UserData = z.infer<typeof userSchema>;

/** Откуда пришёл приглашённый (SPEC 5.7) — для разбивки по каналам. */
export const referralSourceSchema = z.enum(["link", "qr", "telegram", "share"]);

/** Регистрация по email. */
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Имя от 2 символов").max(100),
  email: z.email("Некорректный email"),
  password: z.string().min(8, "Пароль от 8 символов").max(72, "Пароль до 72 символов"),
  referral_code: z.string().optional(),
  referral_source: referralSourceSchema.optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** Время напоминания: ЧЧ:ММ с шагом 15 минут (US-08) — крон ходит раз в 15 минут. */
export const reminderTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):(00|15|30|45)$/, "Время с шагом 15 минут, например 07:15");

/** Настройки пользователя (страница /app/settings). */
export const userSettingsSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  theme: themeSchema.optional(),
  auto_theme: z.boolean().optional(),
  sounds_enabled: z.boolean().optional(),
  sound_pack: soundPackSchema.optional(),
  sound_volume: z.number().int().min(0).max(100).optional(),
  morning_reminder_time: reminderTime.optional(),
  evening_reminder_time: reminderTime.optional(),
  reminders_enabled: z.boolean().optional(),
});

export type UserSettingsInput = z.infer<typeof userSettingsSchema>;

/** Полезная нагрузка Telegram Login Widget. */
export const telegramLoginSchema = z.object({
  id: z.number().int().positive(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  username: z.string().optional(),
  photo_url: z.string().optional(),
  auth_date: z.number().int().positive(),
  hash: z.string().min(1),
  referral_code: z.string().optional(),
  referral_source: referralSourceSchema.optional(),
});

export type TelegramLoginInput = z.infer<typeof telegramLoginSchema>;

/** Вход из приложения, открытого кнопкой бота: сырая строка initData от Telegram. */
export const telegramWebAppSchema = z.object({
  init_data: z.string().min(1).max(4096),
  referral_code: z.string().optional(),
  referral_source: referralSourceSchema.optional(),
});
