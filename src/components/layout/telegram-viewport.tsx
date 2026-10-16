"use client";

import { useEffect } from "react";

/**
 * Полноэкранный режим внутри Telegram (GIMN-perf / запрос «открывать как
 * приложение, без окон»).
 *
 * Скрипт telegram-web-app.js в app/layout грузится lazyOnload, поэтому
 * window.Telegram может появиться уже после монтирования — коротко ждём его
 * с несколькими попытками, затем:
 *   • expand() — максимальная высота (есть во всех версиях);
 *   • disableVerticalSwipes() — чтобы случайный свайп вниз не закрывал апп;
 *   • requestFullscreen() — честный полноэкран, только на ios/android и только
 *     если метод есть (Bot API 8.0+). На десктопе/в старых клиентах метода нет
 *     — тихо пропускаем. Любой вызов обёрнут в try/catch: неподдерживаемая
 *     платформа не должна ронять приложение.
 *
 * Вне Telegram (обычный браузер/PWA) window.Telegram нет — компонент ничего
 * не делает и ничего не рендерит.
 */
export function TelegramViewport() {
  useEffect(() => {
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      const wa = window.Telegram?.WebApp;
      if (!wa) {
        // Скрипт ещё не подгрузился — повторяем до ~2с, потом сдаёмся.
        if (tries++ < 14) timer = setTimeout(apply, 150);
        return;
      }

      try {
        wa.ready();
      } catch {
        /* вне Telegram не вызовется, здесь на всякий случай */
      }
      try {
        wa.expand();
      } catch {
        /* no-op */
      }
      try {
        wa.disableVerticalSwipes?.();
      } catch {
        /* старый клиент — метода нет */
      }

      const platform = wa.platform ?? "";
      if ((platform === "ios" || platform === "android") && typeof wa.requestFullscreen === "function") {
        try {
          wa.requestFullscreen();
        } catch {
          /* клиент не поддерживает полноэкран — остаёмся на expand() */
        }
      }
    };

    apply();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  return null;
}
