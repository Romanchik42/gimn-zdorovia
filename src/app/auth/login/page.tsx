import { Suspense } from "react";
import Link from "next/link";

import { LoginForm } from "@/components/auth/auth-form";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = { title: "Вход — Гимн.здоровья" };

export default function LoginPage() {
  // Имя бота читаем на сервере, чтобы не заводить лишнюю NEXT_PUBLIC-переменную.
  const botUsername = process.env.TELEGRAM_BOT_USERNAME ?? "gimn_zdorovia_bot";

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">С возвращением</h1>
          <p className="text-sm text-muted-foreground">Войдите, чтобы продолжить занятия</p>
        </header>

        <TelegramLoginButton botUsername={botUsername} />

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">или почтой</span>
          <Separator className="flex-1" />
        </div>

        <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
          <LoginForm />
        </Suspense>

        <p className="text-center text-sm text-muted-foreground">
          Ещё нет аккаунта?{" "}
          <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </main>
  );
}
