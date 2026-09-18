"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

/**
 * Общий запуск тура на driver.js (SPEC 4.5, US-11).
 * - затемнение с «окошком» вокруг элемента — встроено в driver.js;
 * - «Пропустить тур» на любом шаге (плюс Esc и крестик);
 * - шаги, чьих элементов нет на экране, выкидываются заранее — иначе
 *   подсказка повисла бы посреди экрана без привязки;
 * - onFinish вызывается ровно один раз — и при прохождении, и при пропуске.
 */
export function runTour(steps: DriveStep[], onFinish: () => void): void {
  const present = steps.filter((s) => {
    if (!s.element) return true;
    return typeof s.element === "string" ? document.querySelector(s.element) !== null : true;
  });
  if (present.length === 0) return;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onFinish();
  };

  const tour = driver({
    steps: present,
    showProgress: present.length > 1,
    progressText: "{{current}} из {{total}}",
    nextBtnText: "Дальше",
    prevBtnText: "Назад",
    doneBtnText: "Готово",
    allowClose: true,
    popoverClass: "gz-tour",
    stagePadding: 6,
    overlayOpacity: 0.55,
    onPopoverRender: (popover, { state }) => {
      // Кнопка «Пропустить тур» на всех шагах, кроме последнего.
      if (state.activeIndex !== undefined && state.activeIndex < present.length - 1) {
        const skip = document.createElement("button");
        skip.type = "button";
        skip.className = "gz-tour-skip";
        skip.textContent = "Пропустить тур";
        skip.addEventListener("click", () => tour.destroy());
        popover.footer.prepend(skip);
      }
    },
    onDestroyed: finish,
  });

  tour.drive();
}

export async function markTourDone(tourType: "app" | "workout"): Promise<void> {
  try {
    await fetch("/api/tour/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour_type: tourType }),
    });
  } catch {
    // не сохранилось — тур покажется ещё раз, это не страшно
  }
}
