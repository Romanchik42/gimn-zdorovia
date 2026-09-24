"use client";

import { ChevronDownIcon } from "lucide-react";

import { CodeLogin } from "@/components/auth/code-login";

/**
 * Дополнительные способы входа (GIMN-029).
 *
 * Telegram остаётся первым и единственным на виду: он у нас основной, и
 * ставить пять кнопок в ряд значит заставить каждого выбирать там, где
 * выбора обычно не нужно. Остальное — под свёрткой, для тех, у кого
 * Telegram нет.
 *
 * Что именно подключено, решает сервер: страница передаёт сюда готовые
 * признаки. Кнопка канала, ключей от которого нет, не показывается вовсе
 * — вместо неё строка о том, что канал пока не работает. Кнопка, которая
 * на нажатие отвечает отказом, хуже отсутствующей: человек считает, что
 * сломалось приложение, и уходит совсем.
 */

export type LoginAvailability = {
  sms: boolean;
  email: boolean;
  oauth: { provider: string; label: string; ready: boolean }[];
};

export function OtherLogins({ available }: { available: LoginAvailability }) {
  const oauthPending = available.oauth.filter((p) => !p.ready);

  return (
    <details className="group rounded-xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground">
        Другие способы входа
        <ChevronDownIcon
          className="size-4 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <div className="space-y-4 border-t border-border px-4 py-4">
        {available.sms ? (
          <CodeLogin channel="sms" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Вход по SMS пока не подключён.
          </p>
        )}

        {available.email ? (
          <CodeLogin channel="email" />
        ) : (
          <p className="text-sm text-muted-foreground">Вход по почте пока не подключён.</p>
        )}

        {available.oauth
          .filter((p) => p.ready)
          .map((p) => (
            <a
              key={p.provider}
              href={`/api/auth/oauth/${p.provider}`}
              className="flex h-12 w-full items-center justify-center rounded-lg border border-border text-sm font-medium hover:bg-muted"
            >
              Войти через {p.label}
            </a>
          ))}

        {oauthPending.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Вход через {oauthPending.map((p) => p.label).join(", ")} появится позже.
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          Ничего не подошло? Напишите нам в Telegram — ответим и заведём вход руками.
        </p>
      </div>
    </details>
  );
}
