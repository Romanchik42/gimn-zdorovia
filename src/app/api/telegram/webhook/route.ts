import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { rateLimit } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/telegram/verify";
import { sendMessage, sendPhoto } from "@/lib/telegram/bot";
import { parseLinkPayload } from "@/lib/telegram/link";
import {
  APP_LINKS,
  HELP_TEXT,
  NOT_REGISTERED_TEXT,
  menuText,
  openAppButton,
  progressText,
  todayText,
} from "@/lib/telegram/messages";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";

/**
 * POST /api/telegram/webhook — команды бота (SPEC 0.4, 3.6).
 *
 * Отвечаем Telegram 200 даже при внутренней ошибке: на любой другой код он
 * повторяет доставку апдейта, и одна сломанная команда превращалась бы в спам
 * повторов. Ошибку пишем в лог. 401 — только при чужом secret_token.
 */

export const maxDuration = 30;

type TgUser = { id: number; first_name?: string; username?: string };
type Update = {
  update_id: number;
  message?: {
    from?: TgUser;
    chat: { id: number; type: string };
    text?: string;
  };
};

const done = () => NextResponse.json({ ok: true });

export async function POST(request: Request) {
  let env;
  try {
    env = serverEnv();
  } catch {
    return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });
  }

  if (!env.TELEGRAM_WEBHOOK_SECRET) {
    // Без секрета не принимаем ничего: иначе любой мог бы слать боту «апдейты».
    return NextResponse.json({ ok: false, error: "webhook secret not configured" }, { status: 503 });
  }

  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyWebhookSecret(secret, env.TELEGRAM_WEBHOOK_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: Update;
  try {
    update = (await request.json()) as Update;
  } catch {
    return done();
  }

  const message = update.message;
  // Работаем только в личке: в группах бот ничего не рассказывает о чужих тренировках.
  if (!message?.text || !message.from || message.chat.type !== "private") return done();

  const chatId = message.chat.id;
  if (!rateLimit(`tg:${chatId}`, 20, 60_000)) return done();

  try {
    await handle(chatId, message.from, message.text.trim());
  } catch (e) {
    console.error("telegram webhook: command failed", e);
    try {
      await sendMessage(chatId, "Что-то пошло не так. Попробуйте ещё раз чуть позже.");
    } catch {
      // и сообщить не получилось — уже залогировано
    }
  }

  return done();
}

async function handle(chatId: number, from: TgUser, text: string): Promise<void> {
  // «/today@gimn_zdorovia_bot аргумент» → команда «/today», аргумент «аргумент»
  const [rawCommand, ...rest] = text.split(/\s+/);
  const command = rawCommand.split("@")[0].toLowerCase();
  const arg = rest.join(" ");

  const admin = createAdminClient();
  const { data: user } = await admin
    .from("users")
    .select("id, name, referral_code")
    .eq("telegram_id", from.id)
    .maybeSingle();

  switch (command) {
    case "/start":
      return start(admin, chatId, from, arg, user);

    case "/help":
      return sendMessage(chatId, HELP_TEXT, openAppButton());

    case "/today":
      if (!user) return notRegistered(chatId);
      return sendMessage(chatId, await todayText(admin, user.id), openAppButton("Начать тренировку"));

    case "/menu": {
      if (!user) return notRegistered(chatId);
      const text = await menuText(admin, user.id);
      return sendMessage(
        chatId,
        text ?? "Меню на сегодня ещё не собрано — откройте раздел «Питание», оно соберётся само.",
        openAppButton("Открыть питание", APP_LINKS.nutrition()),
      );
    }

    case "/progress":
      if (!user) return notRegistered(chatId);
      return sendMessage(
        chatId,
        await progressText(admin, user.id),
        openAppButton("Графики прогресса", APP_LINKS.progress()),
      );

    case "/invite": {
      if (!user) return notRegistered(chatId);
      const url = `${APP_LINKS.invite(user.referral_code)}?src=qr`;
      const png = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 2 });
      return sendPhoto(
        chatId,
        png,
        `Пригласите друга в Гимн.здоровья — пусть отсканирует код или откроет ссылку:\n${APP_LINKS.invite(user.referral_code)}`,
        [[{ text: "Открыть ссылку", url: APP_LINKS.invite(user.referral_code) }]],
      );
    }

    default:
      return sendMessage(chatId, `Не знаю такой команды.\n\n${HELP_TEXT}`);
  }
}

async function start(
  admin: ReturnType<typeof createAdminClient>,
  chatId: number,
  from: TgUser,
  arg: string,
  user: { id: string; name: string } | null,
): Promise<void> {
  // 1. Привязка Telegram к аккаунту, созданному по email.
  const linkUserId = arg ? parseLinkPayload(arg) : null;
  if (linkUserId) {
    if (user && user.id !== linkUserId) {
      return sendMessage(chatId, "Этот Telegram уже привязан к другому аккаунту Гимн.здоровья.");
    }
    const { error } = await admin
      .from("users")
      .update({ telegram_id: from.id, telegram_username: from.username ?? null })
      .eq("id", linkUserId);
    if (error) {
      console.error("telegram link failed:", error.message);
      return sendMessage(chatId, "Не удалось привязать Telegram. Попробуйте ещё раз из настроек.");
    }
    return sendMessage(
      chatId,
      "Готово! Telegram привязан — сюда будут приходить напоминания и персональные отчёты.",
      openAppButton(),
    );
  }

  // 2. Приглашение: /start REFCODE (ссылка вида t.me/<бот>?start=REFCODE).
  const code = arg ? normalizeReferralCode(arg) : "";
  if (!user && isValidReferralCode(code)) {
    // IP не сохраняем (152-ФЗ): только код и источник.
    await admin.from("referral_clicks").insert({ referral_code: code, source: "telegram", user_agent: "telegram-bot" });
    return sendMessage(
      chatId,
      "Вас пригласили в Гимн.здоровья — гимнастику для здоровья. Откройте приложение и войдите через Telegram, чтобы начать.",
      openAppButton("Открыть приглашение", `${APP_LINKS.invite(code)}?src=telegram`),
    );
  }

  // 3. Обычный старт.
  if (user) {
    return sendMessage(chatId, `Здравствуйте, ${user.name}!\n\n${HELP_TEXT}`, openAppButton());
  }
  return notRegistered(chatId);
}

function notRegistered(chatId: number): Promise<void> {
  return sendMessage(chatId, NOT_REGISTERED_TEXT, openAppButton("Зарегистрироваться", APP_LINKS.register()));
}
