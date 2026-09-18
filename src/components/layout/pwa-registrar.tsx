"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { flushQueue } from "@/lib/offline-queue";

/**
 * Регистрирует service worker и досылает отметки, сделанные без сети.
 * В разработке воркер не ставим: его кеш мешал бы видеть свежие правки.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((e) => {
        console.warn("service worker registration failed", e);
      });
    }

    async function sync() {
      const { sent } = await flushQueue();
      if (sent > 0) toast.success(`Связь вернулась — отправили отметки: ${sent}`);
    }

    void sync();
    window.addEventListener("online", sync);
    return () => window.removeEventListener("online", sync);
  }, []);

  return null;
}
