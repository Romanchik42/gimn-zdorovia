"use client";

import { useEffect } from "react";
import type { DriveStep } from "driver.js";

import { markTourDone, runTour } from "@/components/tour/run-tour";

/** Шаги тура по приложению — тексты из SPEC 4.5 / US-11. */
const STEPS: DriveStep[] = [
  {
    element: '[data-tour="today-card"]',
    popover: {
      title: "Тренировка на сегодня",
      description: "Здесь ваша программа на день. Жмите «Начать» — и поехали.",
    },
  },
  {
    element: '[data-tour="custom-workout"]',
    popover: {
      title: "Своя тренировка",
      description: "Не хочется по плану? Соберите свою: выберите группу мышц, время и сложность.",
    },
  },
  {
    element: '[data-tour="nav-nutrition"]',
    popover: { title: "Питание", description: "Тут еда на день, рецепты и список покупок на неделю." },
  },
  {
    element: '[data-tour="nav-progress"]',
    popover: { title: "Прогресс", description: "Графики: гибкость, вес, регулярность занятий." },
  },
  {
    element: '[data-tour="nav-settings"]',
    popover: {
      title: "Настройки",
      description: "Тема, звуки, время напоминаний и приглашение друзей.",
    },
  },
  {
    popover: {
      title: "Готово!",
      description: "Теперь вы знаете приложение. Тур можно пересмотреть в настройках.",
      doneBtnText: "Начать пользоваться",
    },
  },
];

/** Запускается один раз после онбординга, если тур ещё не пройден (флаг в БД). */
export function AppTour({ autoStart }: { autoStart: boolean }) {
  useEffect(() => {
    if (!autoStart) return;
    // Даём странице дорисоваться, иначе окошко встанет на не тот элемент.
    const id = window.setTimeout(() => runTour(STEPS, () => void markTourDone("app")), 600);
    return () => window.clearTimeout(id);
  }, [autoStart]);

  return null;
}
