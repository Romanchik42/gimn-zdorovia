import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeftIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { addDays, todayIso } from "@/lib/dates";

export const metadata = { title: "Статистика — Гимн.здоровья" };

// Данные в реальном времени, без кеша (US-13).
export const dynamic = "force-dynamic";

const MODE_LABELS: Record<string, string> = { behtereva: "Бехтерева", general: "Общая форма" };
const SOURCE_LABELS: Record<string, string> = {
  link: "Ссылка",
  qr: "QR-код",
  telegram: "Telegram-бот",
  share: "Системный share",
  unknown: "Неизвестно",
};

function adminUserIdFromEnv(): string | null {
  try {
    return serverEnv().ADMIN_USER_ID || null;
  } catch {
    return null;
  }
}

function pct(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function shortDate(iso: string): string {
  return format(new Date(iso), "d MMM", { locale: ru });
}

/**
 * /admin/stats (US-13). Доступ проверяется ЗДЕСЬ, на сервере: страница
 * вообще не начнёт читать данные, пока не убедится, что это админ.
 * Неадмин отправляется на /app.
 */
export default async function AdminStatsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login?next=/admin/stats");

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("is_admin").eq("id", user.id).maybeSingle();

  const envAdminId = adminUserIdFromEnv();
  const isAdmin = Boolean(me?.is_admin) || (envAdminId !== null && envAdminId === user.id);
  if (!isAdmin) redirect("/app?denied=admin");

  // ADMIN_USER_ID из окружения — источник правды: подтягиваем флаг в БД,
  // чтобы RLS-политики «админ видит всё» работали и в клиентских запросах.
  if (!me?.is_admin && envAdminId === user.id) {
    await admin.from("users").update({ is_admin: true }).eq("id", user.id);
  }

  const today = todayIso();
  const weekAgoTs = new Date(`${addDays(today, -7)}T00:00:00+03:00`).toISOString();

  const [{ data: users }, { data: referrals }, { data: clicks }, { data: workouts }] = await Promise.all([
    admin.from("users").select("id, name, mode, created_at, referred_by"),
    admin.from("referrals").select("referrer_id, referred_id, source, created_at"),
    admin.from("referral_clicks").select("converted, source"),
    admin
      .from("user_workouts")
      .select("user_id")
      .eq("status", "completed")
      .gte("scheduled_date", addDays(today, -6)),
  ]);

  const all = users ?? [];
  const byId = new Map(all.map((u) => [u.id, u]));
  const total = all.length;
  const newWeek = all.filter((u) => u.created_at >= weekAgoTs).length;
  const invited = all.filter((u) => u.referred_by).length;

  const byMode = new Map<string, number>();
  for (const u of all) byMode.set(u.mode, (byMode.get(u.mode) ?? 0) + 1);

  const byChannel = new Map<string, number>();
  for (const r of referrals ?? []) byChannel.set(r.source, (byChannel.get(r.source) ?? 0) + 1);

  // Топ пригласивших: сколько привёл и когда последний раз.
  const top = new Map<string, { count: number; last: string }>();
  for (const r of referrals ?? []) {
    const cur = top.get(r.referrer_id) ?? { count: 0, last: r.created_at };
    top.set(r.referrer_id, { count: cur.count + 1, last: r.created_at > cur.last ? r.created_at : cur.last });
  }
  const topList = [...top.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 10);

  // Дерево на 2 уровня: кого привёл человек и кого привели они.
  const children = new Map<string, string[]>();
  for (const u of all) {
    if (u.referred_by) children.set(u.referred_by, [...(children.get(u.referred_by) ?? []), u.id]);
  }

  const clickTotal = clicks?.length ?? 0;
  const clickConverted = (clicks ?? []).filter((c) => c.converted).length;

  const workoutsWeek = workouts?.length ?? 0;
  const activeUsers = new Set((workouts ?? []).map((w) => w.user_id)).size;

  const nameOf = (id: string) => byId.get(id)?.name ?? "—";

  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header className="flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-11" aria-label="В приложение">
            <Link href="/app">
              <ChevronLeftIcon className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Статистика</h1>
            <p className="text-xs text-muted-foreground">Только для администратора · данные без кеша</p>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Всего пользователей" value={total} />
          <Stat label="Новых за 7 дней" value={newWeek} />
          <Stat label="По приглашениям" value={invited} note={pct(invited, total)} />
          <Stat label="Тренировок за 7 дней" value={workoutsWeek} note={`активных: ${activeUsers}`} />
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Table title="По режимам" rows={[...byMode.entries()].map(([k, v]) => [MODE_LABELS[k] ?? k, `${v} · ${pct(v, total)}`])} />
          <Table
            title="По каналам приглашений"
            rows={[...byChannel.entries()].map(([k, v]) => [SOURCE_LABELS[k] ?? k, String(v)])}
            empty="Приглашений пока нет"
          />
        </div>

        <Table
          title="Переходы по ссылкам"
          rows={[
            ["Переходов всего", String(clickTotal)],
            ["Из них зарегистрировались", `${clickConverted} · ${pct(clickConverted, clickTotal)}`],
            ["Средняя регулярность", activeUsers ? `${(workoutsWeek / activeUsers).toFixed(1).replace(".", ",")} трен./нед на активного` : "—"],
          ]}
        />

        <section className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-medium">Топ пригласивших</h2>
          {topList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока никто никого не пригласил.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-normal">Имя</th>
                  <th className="py-1 text-right font-normal">Привёл</th>
                  <th className="py-1 text-right font-normal">Последний</th>
                </tr>
              </thead>
              <tbody>
                {topList.map(([id, s]) => (
                  <tr key={id} className="border-t border-border">
                    <td className="py-1.5">{nameOf(id)}</td>
                    <td className="py-1.5 text-right tabular-nums">{s.count}</td>
                    <td className="py-1.5 text-right text-muted-foreground">{shortDate(s.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <h2 className="font-medium">Дерево приглашений</h2>
          {topList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Появится с первыми приглашениями.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topList.map(([id]) => (
                <li key={id}>
                  <span className="font-medium">{nameOf(id)}</span>
                  <ul className="mt-1 space-y-0.5 border-l border-border pl-3">
                    {(children.get(id) ?? []).map((child) => (
                      <li key={child}>
                        {nameOf(child)}
                        {(children.get(child) ?? []).length > 0 ? (
                          <span className="text-muted-foreground">
                            {" "}→ {(children.get(child) ?? []).map(nameOf).join(", ")}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="space-y-1 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value.toLocaleString("ru-RU")}</p>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

function Table({ title, rows, empty }: { title: string; rows: [string, string][]; empty?: string }) {
  return (
    <section className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty ?? "Нет данных"}</p>
      ) : (
        <dl className="space-y-1 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-t border-border pt-1 first:border-0 first:pt-0">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
