/**
 * Проверка ознакомительного тура (GIMN-029).
 *
 * Главное здесь — тексты. Роман согласовал их дословно, а подсказка
 * перевранная «своими словами» обещает не то, что делает приложение, и
 * заметить это в коде невозможно: строка как строка. Поэтому проверка
 * сверяет тексты шагов и подсказок с самим батчем, если он под рукой.
 *
 * Второе — переходы. Тур ходит по экранам, и шаг, ссылающийся на адрес,
 * где его никто не покажет, просто зависнет: подсказка не появится, а
 * человек останется на полпути без единого объяснения.
 *
 * Запуск: npm run check:tour
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { HINTS, HINT_IDS, parseHintsSeen } from "@/lib/tour/hints";
import {
  LAST_STEP,
  TOUR_STEPS,
  firstStepOnPath,
  greeting,
  startButtonMuted,
  tourButtons,
} from "@/lib/tour/steps";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Экраны, на которых висит компонент тура. Список ведётся руками — см. ниже. */
const MOUNTED = ["/app", "/app/nutrition", "/app/progress", "/app/settings"];

console.log("Шаги и переходы:");
{
  check("шесть шагов", TOUR_STEPS.length === 6, String(TOUR_STEPS.length));

  const unmounted = TOUR_STEPS.filter((s) => !MOUNTED.includes(s.path));
  check(
    "каждый шаг живёт на экране, где тур подключён",
    unmounted.length === 0,
    unmounted.map((s) => `${s.id}→${s.path}`).join(", "),
  );

  const ids = TOUR_STEPS.map((s) => s.id);
  check("идентификаторы шагов не повторяются", new Set(ids).size === ids.length);

  check("первый шаг — на главной", TOUR_STEPS[0].path === "/app");
  check("последний шаг возвращает на главную", TOUR_STEPS[LAST_STEP].path === "/app");

  // Шаг без подсветки допустим только обзорный — первый и последний.
  const noAnchor = TOUR_STEPS.map((s, i) => ({ s, i })).filter(({ s }) => !s.element);
  check(
    "без подсветки только приветствие и финал",
    noAnchor.every(({ i }) => i === 0 || i === LAST_STEP),
    noAnchor.map(({ s }) => s.id).join(", "),
  );

  const expand = TOUR_STEPS.filter((s) => s.expand);
  check(
    "шаг, которому нужен раскрытый блок, подсвечивает его же",
    expand.every((s) => s.element === s.expand),
    expand.map((s) => s.id).join(", "),
  );
}

console.log("\nКнопка «Начать»:");
{
  // Приглушена на шагах 1-5, оживает на шестом: до него подсказки
  // рассказывают про приложение, и яркая кнопка тянет внимание на себя.
  const muted = TOUR_STEPS.map((_, i) => startButtonMuted(i));
  check("приглушена на первых пяти шагах", muted.slice(0, 5).every(Boolean), muted.join(", "));
  check("на последнем шаге активна", muted[LAST_STEP] === false);
  check("вне тура активна", startButtonMuted(-1) === false);
}

console.log("\nКнопки шага:");
{
  // Тупик на первом шаге (GIMN-030): кнопок не было вовсе — ни дальше, ни
  // пропустить. Поэтому здесь проверяется не «есть ли кнопка вперёд», а
  // что на КАЖДОМ шаге их ровно три и каждая при деле.
  const rows = TOUR_STEPS.map((_, i) => tourButtons(i));

  check("на каждом шаге три кнопки", rows.every((r) => r.length === 3), rows.map((r) => r.length).join(", "));

  check(
    "порядок один и тот же: пропустить, назад, дальше",
    rows.every((r) => r[0].id === "skip" && r[1].id === "back" && r[2].id === "next"),
  );

  check(
    "главная кнопка ровно одна и это «дальше»",
    rows.every((r) => r.filter((b) => b.primary).length === 1 && r[2].primary === true),
  );

  const first = tourButtons(0);
  check("на первом шаге «Назад» видна", first.some((b) => b.id === "back"));
  check("и при этом не нажимается", first.find((b) => b.id === "back")?.disabled === true);
  check("«Пропустить» на первом шаге работает", first[0].disabled !== true);
  check("«Дальше» на первом шаге работает", first[2].disabled !== true && first[2].action === "next");

  const middle = tourButtons(2);
  check("на средних шагах «Назад» нажимается", middle[1].disabled !== true && middle[1].action === "prev");

  const last = tourButtons(LAST_STEP);
  check("на последнем шаге кнопка закрывает тур", last[2].label === "Закрыть тур" && last[2].action === "finish");
  check("и остаётся главной", last[2].primary === true);
  check("«Пропустить» ведёт к завершению на любом шаге", rows.every((r) => r[0].action === "finish"));

  const labels = rows.flat().map((b) => b.label);
  check("у кнопок есть подписи", labels.every((l) => l.trim().length > 0));
}

console.log("\nПриветствие:");
{
  check("с именем", greeting("Роман") === "Здравствуйте, Роман! 👋", greeting("Роман"));
  check("без имени не выдумывает его", greeting(null) === "Здравствуйте! 👋", greeting(null));
  check("пустая строка — тоже без имени", greeting("   ") === "Здравствуйте! 👋");
}

console.log("\nПодсказки вне тура:");
{
  check("четыре подсказки", HINT_IDS.length === 4, String(HINT_IDS.length));
  check("у каждой есть заголовок и текст", HINT_IDS.every((id) => HINTS[id].title && HINTS[id].description));

  check("чужие отметки отбрасываются", parseHintsSeen(["points", "нечто", 42]).join() === "points");
  check("не массив — пустой список", parseHintsSeen(null).length === 0 && parseHintsSeen("points").length === 0);

  // Подсказки не дублируют шаги тура: это разные темы по построению.
  const stepTitles = new Set(TOUR_STEPS.map((s) => s.title));
  const overlap = HINT_IDS.filter((id) => stepTitles.has(HINTS[id].title));
  check("подсказки не повторяют шаги тура", overlap.length === 0, overlap.join(", "));
}

console.log("\nСверка текстов с батчем:");
{
  const batch = path.join(process.cwd(), "BATCH_GIMN029_FINAL.md");

  if (!existsSync(batch)) {
    console.log("  —    батч не найден, сверка пропущена (это не ошибка)");
  } else {
    const source = readFileSync(batch, "utf8");

    /** Строки батча без отступов и пустых — с ними и сравниваем. */
    const batchLines = new Set(
      source
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    );

    const check1 = (label: string, text: string) => {
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const missing = lines.filter((l) => !batchLines.has(l));
      check(label, missing.length === 0, missing.length ? `нет в батче: «${missing[0]}»` : "");
    };

    for (const step of TOUR_STEPS) {
      // Приветствие подставляет имя, поэтому сверяем только тело.
      if (step.id !== "welcome") check1(`шаг «${step.id}»: заголовок`, step.title);
      check1(`шаг «${step.id}»: текст`, step.description);
    }

    for (const id of HINT_IDS) {
      check1(`подсказка «${id}»: заголовок`, HINTS[id].title);
      check1(`подсказка «${id}»: текст`, HINTS[id].description);
    }
  }
}

console.log("\nПорядок экранов:");
{
  // Тур не должен метаться: на каждый экран заходим один раз подряд.
  const visits = TOUR_STEPS.map((s) => s.path);
  const runs: string[] = [];
  for (const p of visits) if (runs[runs.length - 1] !== p) runs.push(p);
  const repeated = runs.filter((p, i) => runs.indexOf(p) !== i && p !== "/app");
  check("на один экран не возвращаемся дважды", repeated.length === 0, repeated.join(", "));

  check("питание идёт до прогресса", firstStepOnPath("/app/nutrition") < firstStepOnPath("/app/progress"));
  check("прогресс идёт до настроек", firstStepOnPath("/app/progress") < firstStepOnPath("/app/settings"));
  check("несуществующий экран не находится", firstStepOnPath("/app/nowhere") === -1);
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
