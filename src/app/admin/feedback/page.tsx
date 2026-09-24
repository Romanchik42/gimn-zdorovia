import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FeedbackReview } from "@/components/admin/feedback-review";
import { isAdmin } from "@/lib/auth/admin";
import { listFeedback } from "@/lib/points/feedback-review";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Отзывы — Гимн.здоровья" };

// Разбор идёт по свежим отзывам — кеш здесь только мешал бы.
export const dynamic = "force-dynamic";

/**
 * /admin/feedback (GIMN-030). Подтвердить баг, принять идею, отклонить —
 * и начислить за это баллы кнопкой, а не запросом в SQL-редакторе.
 *
 * Доступ проверяется ЗДЕСЬ, на сервере, до чтения любых данных. Чужому —
 * 404, а не «нет прав»: страница не должна признаваться, что существует.
 */
export default async function AdminFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/admin/feedback");
  if (!(await isAdmin(user.id))) notFound();

  const items = await listFeedback();

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-5">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" aria-label="Назад">
            <Link href="/app/settings">
              <ChevronLeftIcon className="size-5" aria-hidden />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Отзывы пользователей</h1>
        </div>

        <p className="text-sm text-muted-foreground">
          Решение по отзыву начисляет баллы автору и отправляет ему сообщение в Telegram.
          Повторное нажатие баллов не удваивает.
        </p>

        <FeedbackReview initial={items} />
      </div>
    </main>
  );
}
