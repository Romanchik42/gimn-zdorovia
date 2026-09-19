import { NextResponse } from "next/server";
import QRCode from "qrcode";

import { rateLimit } from "@/lib/api";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSecret } from "@/lib/telegram/verify";
import { deleteMessage, sendMessage, sendPhoto, type InlineButton } from "@/lib/telegram/bot";
import { rememberWorkoutMessage, showHome } from "@/lib/telegram/chat";
import { parseLinkPayload } from "@/lib/telegram/link";
import {
  APP_LINKS,
  HELP_TEXT,
  HOME_TEXT,
  NOT_REGISTERED_TEXT,
  menuText,
  openAppButton,
  progressText,
  todayText,
  webAppUrl,
} from "@/lib/telegram/messages";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";
import { firstName } from "@/lib/referral/format";

/**
 * POST /api/telegram/webhook — команды бота (SPEC 0.4, 3.6).
 *
 * Чистый чат: на /start сообщение пользователя удаляется, а бот держит одно
 * короткое «домашнее» сообщение с кнопкой приложения — повторный /start
 * заменяет его, а не добавляет новое. Произвольный текст и неизвестные
 * команды тоже удаляются, без ответа. Сам бот пишет только по делу:
 * напоминания, отчёты и ответы на команды из меню.
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
    message_id: number;
    from?: TgUser;
    chat: { id: number; type: string };
    text?: string;
  };
};

type Admin = ReturnType<typeof createAdminClient>;
type BotUser = { id: string; name: string; referral_code: string } | null;
type Home = [text: string, buttons: InlineButton[][]];

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
    await handle(chatId, message.message_id, message.from, message.text.trim());
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

async function handle(chatId: number, messageId: number, from: TgUser, text: string): Promise<void> {
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
      await deleteMessage(chatId, messageId);
      return start(admin, chatId, from, arg, user);

    case "/help":
      await sendMessage(chatId, HELP_TEXT, openAppButton());
      return;

    case "/today":
      if (!user) return notRegistered(chatId);
      // Сообщение о тренировке: уберётся, когда человек перейдёт в приложение.
      await rememberWorkoutMessage(
        chatId,
        await sendMessage(chatId, await todayText(admin, user.id), openAppButton("Начать тренировку")),
      );
      return;

    case "/menu": {
      if (!user) return notRegistered(chatId);
      const text = await menuText(admin, user.id);
      await sendMessage(
        chatId,
        text ?? "Меню на сегодня ещё не собрано — откройте раздел «Питание», оно соберётся само.",
        openAppButton("Открыть питание", webAppUrl("/app/nutrition")),
      );
      return;
    }

    case "/progress":
      if (!user) return notRegistered(chatId);
      await sendMessage(
        chatId,
        await progressText(admin, user.id),
        openAppButton("Графики прогресса", webAppUrl("/app/progress")),
      );
      return;

    case "/invite": {
      if (!user) return notRegistered(chatId);
      const url = `${APP_LINKS.invite(user.referral_code)}?src=qr`;
      const png = await QRCode.toBuffer(url, { type: "png", width: 512, margin: 2 });
      // Здесь обычная ссылка, не Web App: её пересылают другу, у которого нашего бота нет.
      return sendPhoto(
        chatId,
        png,
        `Пригласите друга в Гимн.здоровья — пусть отсканирует код или откроет ссылку:\n${APP_LINKS.invite(user.referral_code)}`,
        [[{ text: "Открыть ссылку", url: APP_LINKS.invite(user.referral_code), style: "primary" }]],
      );
    }

    default:
      // Не отвечаем: убираем сообщение и опускаем «домашнее» вниз, к полю ввода,
      // чтобы кнопка приложения оставалась под рукой.
      await deleteMessage(chatId, messageId);
      return showHome(chatId, ...defaultHome(user));
  }
}

function defaultHome(user: BotUser): Home {
  return user ? [HOME_TEXT.user(firstName(user.name)), openAppButton()] : [HOME_TEXT.guest, openAppButton()];
}

async function start(admin: Admin, chatId: number, from: TgUser, arg: string, user: BotUser): Promise<void> {
  // 1. Привязка Telegram к аккаунту, созданному по email.
  const linkUserId = arg ? parseLinkPayload(arg) : null;
  if (linkUserId) {
    if (user && user.id !== linkUserId) {
      return showHome(chatId, HOME_TEXT.linkedElsewhere, openAppButton());
    }
    const { error } = await admin
      .from("users")
      .update({ telegram_id: from.id, telegram_username: from.username ?? null })
      .eq("id", linkUserId);
    if (error) {
      console.error("telegram link failed:", error.message);
      return showHome(chatId, HOME_TEXT.linkFailed, openAppButton());
    }
    return showHome(chatId, HOME_TEXT.linked, openAppButton());
  }

  // 2. Приглашение: /start REFCODE (ссылка вида t.me/<бот>?start=REFCODE).
  const code = arg ? normalizeReferralCode(arg) : "";
  if (!user && isValidReferralCode(code)) {
    // IP не сохраняем (152-ФЗ): только код и источник.
    await admin.from("referral_clicks").insert({ referral_code: code, source: "telegram", user_agent: "telegram-bot" });
    return showHome(chatId, HOME_TEXT.invited, openAppButton("Открыть приложение", webAppUrl("/app", code)));
  }

  // 3. Обычный старт.
  return showHome(chatId, ...defaultHome(user));
}

async function notRegistered(chatId: number): Promise<void> {
  await sendMessage(chatId, NOT_REGISTERED_TEXT, openAppButton());
}
