import { TelegramAuthScreen } from "@/components/auth/telegram-auth-screen";

export const metadata = { title: "Вход — Гимн.здоровья" };

export default function LoginPage() {
  return <TelegramAuthScreen title="Гимн.здоровья" subtitle="Войдите через Telegram, чтобы продолжить занятия" />;
}
