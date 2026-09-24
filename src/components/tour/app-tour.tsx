"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

import { markTourDone } from "@/components/tour/run-tour";
import { clearStep, readStep, setStartMuted, writeStep } from "@/lib/tour/state";
import { LAST_STEP, TOUR_STEPS, greeting, startButtonMuted, stepAt } from "@/lib/tour/steps";

/**
 * Ознакомительный тур (US-11, переписан в GIMN-029).
 *
 * Было: шесть подсказок на одном экране — про питание рассказывали, тыкая
 * в кнопку внизу главной. Стало: каждый шаг открывает свой экран, и
 * человек видит то, о чём читает.
 *
 * Отсюда устройство. driver.js показывает ровно один шаг — свой
 * собственный переход по шагам он не знает, потому что между шагами
 * бывает смена адреса и новая отрисовка. Номер шага живёт в
 * sessionStorage; компонент висит на каждом экране тура и подхватывает
 * подсказку, когда экран открылся.
 *
 * Кнопки собираются руками: driver.js ставит «Назад» и «Дальше» в своём
 * порядке и не знает про «Пропустить тур». Нужен один ряд из трёх, где
 * главная — «Дальше».
 */

/** Ждём, пока нужный элемент появится: после перехода экран рисуется не мгновенно. */
function waitFor(selector: string, timeoutMs = 3000): Promise<Element | null> {
  const found = document.querySelector(selector);
  if (found) return Promise.resolve(found);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (!el) return;
      observer.disconnect();
      window.clearTimeout(timer);
      resolve(el);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

export function AppTour({ autoStart = false, name }: { autoStart?: boolean; name?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  // Показанный шаг: повторный запуск того же шага дёргал бы подсветку.
  const shownRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Первый вход: тур ещё не проходили — начинаем с нуля.
    if (autoStart && readStep() === null) writeStep(0);

    const index = readStep();
    if (index === null) {
      setStartMuted(false);
      return;
    }

    const step = stepAt(index);
    if (!step) {
      clearStep();
      setStartMuted(false);
      return;
    }

    // Шаг живёт на другом экране — там его и покажут.
    if (step.path !== pathname) return;
    if (shownRef.current === index) return;

    setStartMuted(startButtonMuted(index));

    const finish = (completed: boolean) => {
      driverRef.current?.destroy();
      driverRef.current = null;
      shownRef.current = null;
      clearStep();
      setStartMuted(false);
      if (completed) void markTourDone("app");
    };

    const goTo = (next: number) => {
      driverRef.current?.destroy();
      driverRef.current = null;
      shownRef.current = null;
      writeStep(next);
      const target = TOUR_STEPS[next];
      if (target.path !== pathname) router.push(target.path);
      else start(next);
    };

    function buttons(popover: { footer: HTMLElement }, current: number): void {
      popover.footer.replaceChildren();

      const row = document.createElement("div");
      row.className = "gz-tour-row";

      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "gz-tour-btn gz-tour-skip";
      skip.textContent = "Пропустить тур";
      // Пропуск — это осознанный ответ, а не побег: тур отмечается
      // пройденным, иначе он встретил бы человека снова на каждом входе.
      skip.addEventListener("click", () => finish(true));
      row.append(skip);

      if (current > 0) {
        const back = document.createElement("button");
        back.type = "button";
        back.className = "gz-tour-btn";
        back.textContent = "Назад";
        back.addEventListener("click", () => goTo(current - 1));
        row.append(back);
      }

      const next = document.createElement("button");
      next.type = "button";
      next.className = "gz-tour-btn gz-tour-next";
      if (current === LAST_STEP) {
        next.textContent = "Закрыть тур";
        next.addEventListener("click", () => finish(true));
      } else {
        next.textContent = "Дальше →";
        next.addEventListener("click", () => goTo(current + 1));
      }
      row.append(next);

      popover.footer.append(row);
    }

    async function start(at: number): Promise<void> {
      const current = stepAt(at);
      if (!current || cancelled) return;

      // Секция настроек свёрнута — подсвечивать было бы нечего.
      if (current.expand) {
        const box = await waitFor(current.expand);
        if (box instanceof HTMLDetailsElement) box.open = true;
      }

      const element = current.element ? await waitFor(current.element) : undefined;
      if (cancelled) return;

      shownRef.current = at;

      const instance = driver({
        // Подсветка только там, где элемент нашёлся: подсказка, привязанная
        // к пустому месту, выглядит как сбой.
        steps: [
          {
            element: element ?? undefined,
            popover: {
              title: at === 0 ? greeting(name) : current.title,
              description: current.description,
              showButtons: [],
            },
          },
        ],
        allowClose: false,
        popoverClass: "gz-tour",
        stagePadding: 6,
        overlayOpacity: 0.55,
        onPopoverRender: (popover) => buttons(popover, at),
      });

      driverRef.current = instance;
      instance.drive();
    }

    // Небольшая пауза: экран после перехода дорисовывается, и подсветка,
    // поставленная слишком рано, встанет на прежнее место элемента.
    const timer = window.setTimeout(() => void start(index), 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [autoStart, name, pathname, router]);

  // Уходя со страницы совсем, гасим оформление: иначе кнопка «Начать»
  // осталась бы приглушённой после закрытия вкладки с туром.
  useEffect(() => () => setStartMuted(false), []);

  return null;
}
