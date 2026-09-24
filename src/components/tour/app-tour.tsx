"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

import { markTourDone } from "@/components/tour/run-tour";
import { clearStep, readStep, setStartMuted, writeStep } from "@/lib/tour/state";
import { TOUR_STEPS, greeting, startButtonMuted, stepAt, tourButtons } from "@/lib/tour/steps";

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

/**
 * Ждём, пока нужный элемент появится: после перехода экран рисуется не
 * мгновенно. Ждём недолго: если якоря нет совсем, шаг должен показаться
 * без подсветки, а не висеть молча несколько секунд.
 */
function waitFor(selector: string, timeoutMs = 1200): Promise<Element | null> {
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
      // driver.js прячет футер, если не показывает ни одной своей кнопки:
      //   p = showButtons.includes("next") || ... ;
      //   p ? footer.style.display = "flex" : footer.style.display = "none";
      // Мы рисуем кнопки сами, поэтому своих у него нет — и футер вместе с
      // нашими кнопками уезжал в display:none. На первом шаге это был
      // тупик: ни дальше, ни пропустить. Возвращаем показ явно.
      popover.footer.style.display = "flex";
      popover.footer.replaceChildren();

      const row = document.createElement("div");
      row.className = "gz-tour-row";

      for (const button of tourButtons(current)) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `gz-tour-btn gz-tour-${button.id}${button.primary ? " gz-tour-primary" : ""}`;
        el.textContent = button.label;

        if (button.disabled) {
          el.disabled = true;
        } else if (button.action === "finish") {
          // Пропуск — осознанный ответ, а не побег: тур отмечается
          // пройденным, иначе встретил бы человека снова на каждом входе.
          el.addEventListener("click", () => finish(true));
        } else if (button.action === "prev") {
          el.addEventListener("click", () => goTo(current - 1));
        } else {
          el.addEventListener("click", () => goTo(current + 1));
        }

        row.append(el);
      }

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
              // Просим показать кнопку «дальше» — ради футера: без единой
              // своей кнопки driver.js прячет его целиком. Саму кнопку мы
              // тут же заменяем своим рядом в onPopoverRender.
              showButtons: ["next"],
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
