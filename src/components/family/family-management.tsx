"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CopyIcon, Loader2Icon, UserPlusIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FAMILY_MAX_PROFILES, INVITE_TTL_DAYS, familySize } from "@/lib/family/rules";

/**
 * «Моя семья» внутри раздела тарифов (GIMN-030).
 *
 * Состав спрашиваем своим запросом, а не получаем пропсом: таблицы
 * появляются миграцией 0030, и страница настроек, которая читала бы их
 * своим запросом, легла бы целиком до применения миграции — ради блока,
 * без которого прекрасно живут. Не ответили — блок просто не показываем.
 */

type Member = { id: string; name: string; acceptedAt: string | null };
type State = {
  ownerName: string | null;
  isOwner: boolean;
  members: Member[];
  invite: { code: string; expiresAt: string } | null;
  canInviteMore: boolean;
};

export function FamilyManagement({ appUrl }: { appUrl: string }) {
  const [state, setState] = useState<State | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/family/members")
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success) setState(json.data as State);
      })
      .catch(() => {
        // Не узнали состав — блока просто не будет.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  async function call(url: string, method: string): Promise<unknown | null> {
    setPending(true);
    try {
      const res = await fetch(url, { method });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error ?? "Не получилось");
        return null;
      }
      return json.data;
    } catch {
      toast.error("Сеть недоступна. Попробуйте ещё раз.");
      return null;
    } finally {
      setPending(false);
    }
  }

  async function invite() {
    const data = (await call("/api/family/invite", "POST")) as {
      invite: { code: string; expiresAt: string };
    } | null;
    if (data) setState((prev) => (prev ? { ...prev, invite: data.invite } : prev));
  }

  async function revoke() {
    if (await call("/api/family/invite", "DELETE")) {
      setState((prev) => (prev ? { ...prev, invite: null } : prev));
    }
  }

  async function remove(member: Member) {
    if (await call(`/api/family/members/${member.id}`, "DELETE")) {
      setState((prev) =>
        prev
          ? {
              ...prev,
              members: prev.members.filter((m) => m.id !== member.id),
              canInviteMore: true,
            }
          : prev,
      );
      toast.success(`${member.name} больше не в семье. Данные остались при нём.`);
    }
  }

  // Приглашённый видит, к кому присоединился, и всё: составом семьи
  // распоряжается её глава.
  if (!state.isOwner) {
    return (
      <div className="space-y-2 rounded-xl bg-background p-4 ring-1 ring-foreground/10">
        <h3 className="font-medium">👨‍👩‍👧 Моя семья</h3>
        <p className="text-sm text-muted-foreground">
          Вы в семье: {state.ownerName}. Занятия, замеры и меню у вас свои — общая только оплата.
        </p>
      </div>
    );
  }

  const link = state.invite ? `${appUrl.replace(/\/$/, "")}/family/${state.invite.code}` : null;

  return (
    <div className="space-y-3 rounded-xl bg-background p-4 ring-1 ring-foreground/10">
      <h3 className="font-medium">
        👨‍👩‍👧 Моя семья ({familySize(state.members.length)} из {FAMILY_MAX_PROFILES})
      </h3>

      <ul className="space-y-1 text-sm">
        <li className="flex items-center gap-2">
          <span aria-hidden>👤</span> Вы <span className="text-muted-foreground">— главный</span>
        </li>
        {state.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2">
            <span aria-hidden>👤</span>
            <span className="flex-1">
              {m.name}
              {m.acceptedAt ? (
                <span className="text-muted-foreground">
                  {" "}
                  — присоединился {format(new Date(m.acceptedAt), "d MMMM", { locale: ru })}
                </span>
              ) : null}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Убрать ${m.name} из семьи`}
              disabled={pending}
              onClick={() => void remove(m)}
            >
              <XIcon className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {link ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Ссылка для приглашения:</p>
          <p className="rounded-lg bg-muted p-2 font-mono text-xs break-all">{link}</p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={() => {
                navigator.clipboard
                  ?.writeText(link)
                  .then(() => toast.success("Ссылка скопирована"))
                  .catch(() => toast.error("Не удалось скопировать — выделите вручную"));
              }}
            >
              <CopyIcon className="size-4" aria-hidden /> Копировать
            </Button>
            <Button variant="ghost" className="h-11" disabled={pending} onClick={() => void revoke()}>
              <XIcon className="size-4" aria-hidden /> Удалить
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ссылка действует {INVITE_TTL_DAYS} дней. По ней может присоединиться только один человек.
            Для нового приглашения — создайте новую ссылку.
          </p>
        </div>
      ) : state.canInviteMore ? (
        <Button variant="outline" className="h-11 w-full" disabled={pending} onClick={() => void invite()}>
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserPlusIcon className="size-4" aria-hidden />
          )}
          Пригласить ещё
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Все {FAMILY_MAX_PROFILES} профиля заняты. Чтобы позвать кого-то ещё, сначала уберите
          участника.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        У каждого профиля свои тренировки, замеры и меню. Общая только оплата.
      </p>
    </div>
  );
}
