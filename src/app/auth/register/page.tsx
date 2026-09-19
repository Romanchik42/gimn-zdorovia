import { TelegramAuthScreen } from "@/components/auth/telegram-auth-screen";

export const metadata = { title: "Регистрация — Гимн.здоровья" };

/** Регистрация и вход — одно действие: аккаунт заводится при первом входе через Telegram. */
export default function RegisterPage() {
  return (
    <TelegramAuthScreen title="Гимн.здоровья" subtitle="Войдите через Telegram — программа подстроится под вас" />
  );
}
