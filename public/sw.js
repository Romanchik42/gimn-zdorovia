/*
 * Service worker «Гимн.здоровья».
 *
 * next-pwa не работает с Next 16 (он встраивается в webpack, а Next 16 собирает
 * Turbopack), поэтому воркер написан руками и нарочно скромный:
 *  - /api/* никогда не кешируем — там данные конкретного пользователя;
 *  - /_next/static/* — cache-first: имена файлов содержат хеш и не меняются;
 *  - главная и страницы тренировок — network-first с сохранением копии,
 *    чтобы последнюю тренировку можно было открыть без сети;
 *  - без сети и без копии — /offline.html.
 * Смена VERSION сбрасывает старые кеши при следующей активации.
 */

const VERSION = "v1";
const STATIC_CACHE = `gz-static-${VERSION}`;
const PAGES_CACHE = `gz-pages-${VERSION}`;
const PRECACHE = ["/offline.html", "/manifest.json", "/icons/icon-192.png"];
const MAX_CACHED_PAGES = 6;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("gz-") && k !== STATIC_CACHE && k !== PAGES_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Выход из аккаунта: страницы с чужими данными не должны оставаться на устройстве.
self.addEventListener("message", (event) => {
  if (event.data === "gz:clear-pages") event.waitUntil(caches.delete(PAGES_CACHE));
});

function isOfflinePage(url) {
  return url.pathname === "/app" || url.pathname.startsWith("/app/workout/");
}

async function trimPages() {
  const cache = await caches.open(PAGES_CACHE);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_PAGES))) {
    await cache.delete(key);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // RSC-запросы клиентской навигации не кешируем: без сети Next сам откатится
  // к обычной навигации, а её перехватывает ветка ниже.
  if (request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          // Редиректы (например, на логин) и ошибки не сохраняем.
          if (isOfflinePage(url) && res.ok && !res.redirected && res.type === "basic") {
            const cache = await caches.open(PAGES_CACHE);
            await cache.put(request, res.clone());
            trimPages();
          }
          return res;
        } catch {
          const cached = await caches.match(request, { cacheName: PAGES_CACHE });
          if (cached) return cached;
          return (await caches.match("/offline.html")) || Response.error();
        }
      })(),
    );
  }
});
