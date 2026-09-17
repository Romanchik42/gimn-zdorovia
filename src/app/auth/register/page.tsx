import Link from "next/link";

import { RegisterForm } from "@/components/auth/auth-form";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { Separator } from "@/components/ui/separator";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";

export const metadata = { title: "Регистрация — Гимн.здоровья" };

export default function RegisterPage() {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gimn_zdorovia_bot";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Гимн.здоровья</h1>
          <p className="text-sm text-muted-foreground">
            Создайте аккаунт — программа подстроится под вас
          </p>
        </header>

        <TelegramLoginButton botUsername={botUsername} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">или почтой</span>
          <Separator className="flex-1" />
        </div>

        <RegisterForm />

        <p className="text-center text-sm text-muted-foreground">
          Уже есть аккаунт?{" "}
          <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Войти
          </Link>
        </p>

        <MedicalDisclaimer compact />
      </div>
    </main>
  );
}
