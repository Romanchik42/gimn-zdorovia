import Link from "next/link";
import type { Metadata } from "next";
import { UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JoinFamilyButton } from "@/components/family/join-family-button";
import { FAMILY_MAX_PROFILES } from "@/lib/family/rules";
import { previewInvite } from "@/lib/family/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Приглашение в семью — Гимн.здоровья",
  description: "Вас пригласили в семейный аккаунт Гимн.здоровья.",
};

// Срок ссылки проверяется на каждом открытии — кеш здесь врал бы.
export const dynamic = "force-dynamic";

/**
 * /family/[code] — страница приглашения (GIMN-030).
 *
 * Гостю показываем, кто зовёт, и отправляем входить: присоединиться может
 * только тот, у кого есть свой профиль — семья объединяет оплату, а не
 * данные, и профиль каждому нужен собственный.
 */
export default async function FamilyInvitePage({ params }: PageProps<"/family/[code]">) {
  const { code } = await params;
  const preview = await previewInvite(code);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-5 text-center">
        <UsersIcon className="mx-auto size-10 text-primary" aria-hidden />

        {preview.ok ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              Вы получили приглашение от {preview.ownerName}
            </h1>
            <p className="text-sm text-muted-foreground">
              Семейный аккаунт — это общая оплата на {FAMILY_MAX_PROFILES} профиля. Занятия, замеры,
              меню и прогресс у каждого остаются свои: ничего не смешивается.
            </p>

            {user ? (
              <JoinFamilyButton code={preview.code} ownerName={preview.ownerName} />
            ) : (
              <div className="space-y-2">
                <p className="text-sm">Чтобы присоединиться, войдите или заведите профиль.</p>
                <Button asChild className="h-12 w-full">
                  <Link href={`/auth/login?next=/family/${preview.code}`}>Войти</Link>
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">Приглашение не работает</h1>
            <p className="text-sm text-muted-foreground">{preview.error}</p>
            <Button asChild variant="outline" className="h-12 w-full">
              <Link href={user ? "/app" : "/"}>{user ? "В приложение" : "На главную"}</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
