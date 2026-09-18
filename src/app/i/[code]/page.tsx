import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshakeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InviteTracker } from "@/components/referral/invite-tracker";
import { MedicalDisclaimer } from "@/components/medical-disclaimer";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidReferralCode, normalizeReferralCode } from "@/lib/referral/code-generator";
import { firstName } from "@/lib/referral/format";
import { REFERRAL_SOURCES, type StoredReferralSource } from "@/lib/referral/storage";

export const metadata: Metadata = {
  title: "Приглашение — Гимн.здоровья",
  description: "Вас пригласили в Гимн.здоровья — ежедневную гимнастику для здоровья.",
};

async function inviterName(code: string): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from("users")
      .select("name")
      .eq("referral_code", code)
      .maybeSingle();
    return data ? firstName(data.name) : null;
  } catch {
    // БД недоступна — показываем обычный лендинг, приглашение всё равно запомним
    return null;
  }
}

/** Страница приглашения /i/AB12CD (US-12). Несуществующий код лендинг не ломает. */
export default async function InvitePage({ params, searchParams }: PageProps<"/i/[code]">) {
  const [{ code: raw }, query] = await Promise.all([params, searchParams]);
  const code = normalizeReferralCode(raw);
  const valid = isValidReferralCode(code);

  const src = typeof query.src === "string" ? query.src : "link";
  const source: StoredReferralSource = (REFERRAL_SOURCES as readonly string[]).includes(src)
    ? (src as StoredReferralSource)
    : "link";

  const inviter = valid ? await inviterName(code) : null;

  return (
    <main className="flex flex-1 flex-col items-center justify-between gap-10 px-4 py-10">
      {valid ? <InviteTracker code={code} source={source} /> : null}

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        {inviter ? (
          <p className="flex items-center gap-2 rounded-full bg-primary/12 px-4 py-2 text-sm font-medium text-primary">
            <HeartHandshakeIcon className="size-4" aria-hidden />
            Вас пригласил(а) {inviter}
          </p>
        ) : null}

        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Гимн.здоровья</h1>
          <p className="text-muted-foreground">гимнастика для здоровья</p>
        </div>

        <p className="text-pretty text-muted-foreground">
          Ежедневная гимнастика при болезни Бехтерева и для поддержания формы: персональная
          программа, меню на день и прогресс — 30 минут в день.
        </p>

        <Button asChild size="lg" className="h-14 w-full max-w-xs text-base">
          <Link href="/auth/register">Начать</Link>
        </Button>
        <Link href="/auth/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Уже есть аккаунт? Войти
        </Link>
      </div>

      <footer className="w-full max-w-md">
        <MedicalDisclaimer compact />
      </footer>
    </main>
  );
}
