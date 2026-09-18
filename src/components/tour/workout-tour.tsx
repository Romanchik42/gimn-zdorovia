"use client";

import { useEffect } from "react";
import type { DriveStep } from "driver.js";

import { markTourDone, runTour } from "@/components/tour/run-tour";

/** Короткий тур в первой тренировке: три кнопки отметки (US-11, п. 8). */
const STEPS: DriveStep[] = [
  {
    element: '[data-tour="feedback-done"]',
    popover: {
      title: "Сделал",
      description: "Упражнение получилось — отмечайте, и сразу откроется следующее.",
    },
  },
  {
    element: '[data-tour="feedback-difficult"]',
    popover: {
      title: "Плохо",
      description:
        "Было тяжело или появился симптом: спросим, что случилось, подскажем, что делать, и облегчим следующую тренировку.",
    },
  },
  {
    element: '[data-tour="feedback-skipped"]',
    popover: {
      title: "Пропустить",
      description: "Не хочется или не можется — просто пропустите. Это тоже честная отметка.",
      doneBtnText: "Понятно",
    },
  },
];

export function WorkoutTour({ autoStart }: { autoStart: boolean }) {
  useEffect(() => {
    if (!autoStart) return;
    const id = window.setTimeout(() => runTour(STEPS, () => void markTourDone("workout")), 500);
    return () => window.clearTimeout(id);
  }, [autoStart]);

  return null;
}
