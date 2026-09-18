/**
 * Очередь запросов, отправленных без сети (SPEC этап 7: «отметки локально + синк»).
 *
 * Пользователь занимается в подвале спортзала или в метро: отметка ✅/⚠️/❌ не
 * должна теряться из-за пропавшей связи. Запрос откладывается в localStorage
 * и уходит, когда сеть вернётся. Повторная отправка безопасна: отметки на
 * сервере — upsert по паре «тренировка + упражнение».
 */

const KEY = "gz-offline-queue";
const MAX_ITEMS = 200;

type Queued = { url: string; body: unknown; queuedAt: number };

function read(): Queued[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Queued[]) : [];
  } catch {
    return [];
  }
}

function write(items: Queued[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items.slice(-MAX_ITEMS)));
  } catch {
    // хранилище недоступно — отметка потеряется, но занятие не прервётся
  }
}

export function enqueue(url: string, body: unknown): void {
  write([...read(), { url, body, queuedAt: Date.now() }]);
}

export function pendingCount(): number {
  return read().length;
}

let flushing = false;

/**
 * Отправляет накопленное по порядку. 4xx выбрасываем (повтор не поможет),
 * сеть и 5xx — оставляем до следующей попытки.
 */
export async function flushQueue(): Promise<{ sent: number; left: number }> {
  if (flushing || typeof navigator !== "undefined" && !navigator.onLine) {
    return { sent: 0, left: read().length };
  }
  flushing = true;
  let sent = 0;

  try {
    const items = read();
    const keep: Queued[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        const res = await fetch(item.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.body),
        });
        if (res.ok || (res.status >= 400 && res.status < 500)) sent++;
        else keep.push(item);
      } catch {
        // Сеть снова пропала — оставляем этот и все следующие как есть.
        keep.push(...items.slice(i));
        break;
      }
    }

    write(keep);
    return { sent, left: keep.length };
  } finally {
    flushing = false;
  }
}
