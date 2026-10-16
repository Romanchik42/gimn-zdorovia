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
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

/**
 * Все якоря data-tour в коде.
 *
 * Нужны, потому что шаг, указывающий на несуществующий элемент, не падает
 * и не ругается: подсказка просто выходит без подсветки, предварительно
 * подождав элемент, которого нет. Заметить это можно только глазами и
 * только на нужном экране — ровно то, что в этом батче и вскрылось.
 */
function anchorsInSource(): Set<string> {
  const found = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      // Только разметка. Сам список шагов лежит в .ts и содержит те же
      // селекторы строками — считая их, проверка находила бы любой якорь,
      // включая выдуманный, и подтверждала бы сама себя.
      if (!entry.endsWith(".tsx")) continue;
      const text = readFileSync(full, "utf8");
      for (const m of text.matchAll(/data-tour="([^"]+)"/g)) found.add(m[1]);
      for (const m of text.matchAll(/dataTour="([^"]+)"/g)) found.add(m[1]);
      // Нижняя навигация ставит якоря из списка: data-tour={tour}, где
      // tour приходит полем записи. Без этой строки все её якоря
      // выглядели бы несуществующими.
      for (const m of text.matchAll(/\btour:\s*"([^"]+)"/g)) found.add(m[1]);
    }
  };

  walk(path.join(process.cwd(), "src"));
  return found;
}

console.log("Шаги и переходы:");
{
  check("девять шагов", TOUR_STEPS.length === 9, String(TOUR_STEPS.length));

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

  // Якорь шага должен существовать в коде. До GIMN-030 шаг про замеры
  // указывал на раздел, который у новичка не рисуется вовсе: список
  // прошлых замеров пуст — и подсветка вела в пустоту именно у тех, ради
  // кого тур и сделан.
  const anchors = anchorsInSource();
  const broken = TOUR_STEPS.filter((s) => {
    if (!s.element) return false;
    const name = s.element.match(/data-tour="([^"]+)"/)?.[1];
    return !name || !anchors.has(name);
  });
  check(
    "каждый подсвечиваемый якорь есть в коде",
    broken.length === 0,
    broken.map((s) => `${s.id}→${s.element}`).join(", "),
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
  // Приглушена до финала: пока подсказки рассказывают про приложение,
  // яркая кнопка внизу тянет внимание на себя.
  const muted = TOUR_STEPS.map((_, i) => startButtonMuted(i));
  check("приглушена на всех шагах до финала", muted.slice(0, LAST_STEP).every(Boolean), muted.join(", "));
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
  // Режимы и диагностика ушли в основной тур (GIMN-030): контекстными их
  // за весь тестовый период не увидел никто — одна ждала переключения
  // режима, вторая захода в мастер диагностики.
  check("две подсказки", HINT_IDS.length === 2, String(HINT_IDS.length));
  check(
    "режимы и диагностика больше не контекстные",
    !(HINT_IDS as readonly string[]).includes("modes") &&
      !(HINT_IDS as readonly string[]).includes("diagnostics"),
    HINT_IDS.join(", "),
  );
  // Ушедшие темы должны найтись в туре — иначе их просто потеряли.
  const stepIds = new Set(TOUR_STEPS.map((s) => s.id));
  check("обе переехали в тур", stepIds.has("modes") && stepIds.has("diagnostics"));
  check("у каждой есть заголовок и текст", HINT_IDS.every((id) => HINTS[id].title && HINTS[id].description));

  check("чужие отметки отбрасываются", parseHintsSeen(["points", "нечто", 42]).join() === "points");
  // Старые отметки о переехавших подсказках остались у всех в БД и должны
  // тихо обесцениться, а не всплыть где-нибудь неизвестным идентификатором.
  check("отметки переехавших подсказок обесценились", parseHintsSeen(["modes", "diagnostics"]).length === 0);
  check("не массив — пустой список", parseHintsSeen(null).length === 0 && parseHintsSeen("points").length === 0);

  // Подсказки не дублируют шаги тура: это разные темы по построению.
  const stepTitles = new Set(TOUR_STEPS.map((s) => s.title));
  const overlap = HINT_IDS.filter((id) => stepTitles.has(HINTS[id].title));
  check("подсказки не повторяют шаги тура", overlap.length === 0, overlap.join(", "));

  // Подсказка, описанная в hints.ts и нигде не выведенная, не показывается
  // никому и ничем об этом не сообщает (GIMN-030). Ровно так и вышло бы,
  // если при переезде режимов и диагностики в тур забыть убрать одну из них
  // из списка — или, наоборот, оставить в списке, но снять с экрана.
  const mounted = new Set<string>();
  const walkSrc = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walkSrc(full);
        continue;
      }
      if (!entry.endsWith(".tsx")) continue;
      const text = readFileSync(full, "utf8");
      // <ContextHint id="points" ... /> — только в разметке, не в самом
      // hints.ts: иначе проверка подтверждала бы сама себя.
      for (const m of text.matchAll(/<ContextHint\s[^>]*id="([^"]+)"/g)) mounted.add(m[1]);
    }
  };
  walkSrc(path.join(process.cwd(), "src"));

  const orphans = HINT_IDS.filter((id) => !mounted.has(id));
  check("каждая подсказка где-то выведена", orphans.length === 0, orphans.join(", "));

  const stale = [...mounted].filter((id) => !(HINT_IDS as readonly string[]).includes(id));
  check("на экранах не осталось переехавших подсказок", stale.length === 0, stale.join(", "));
}

console.log("\n«Показать тур заново»:");
{
  // Сброс чистил только tour_completed, а hints_seen оставался — и
  // подсказки, однажды закрытые, не возвращались никогда. Именно поэтому
  // их «никто не видел»: проверить их после первого прохода было нечем.
  const route = readFileSync(path.join(process.cwd(), "src/app/api/tour/complete/route.ts"), "utf8");
  check("сброс возвращает и контекстные подсказки", route.includes("hints_seen: []"));
  check(
    "и только при сбросе, а не при прохождении",
    /reset\s*\?\s*\{\s*hints_seen:\s*\[\]\s*\}/.test(route),
  );

  // Без права на колонку запись молча не проходит: человек нажал
  // «показать заново», а подсказки не вернулись (основание — 0011, 0028).
  const grant = readFileSync(path.join(process.cwd(), "supabase/migrations/0028_tour_hints.sql"), "utf8");
  check("право на запись отметок выдано", grant.includes("GRANT UPDATE (hints_seen) ON public.users TO authenticated"));
}

console.log("\nПропавший якорь слышно:");
{
  // check:tour ловит выдуманные якоря, но не те, что есть в коде и не
  // дошли до экрана: у новичка блок замеров не рисуется вовсе. Такой шаг
  // выходит без подсветки и молчит — теперь хотя бы пишет в консоль.
  const tour = readFileSync(path.join(process.cwd(), "src/components/tour/app-tour.tsx"), "utf8");
  check("тур предупреждает о ненайденном якоре", /console\.warn\(`\[tour:/.test(tour));

  const hint = readFileSync(path.join(process.cwd(), "src/components/tour/context-hint.tsx"), "utf8");
  check("подсказка не молчит об отказе", (hint.match(/console\.warn\(/g) ?? []).length >= 2);
  check("пустых catch в подсказке не осталось", !/catch\s*\(\s*\)\s*\{\s*\/\//.test(hint));
}

console.log("\nСверка текстов с батчем:");
{
  // Тексты собраны из двух батчей: шесть шагов согласованы в GIMN-029,
  // три новых — в GIMN-030. Сверяем по обоим сразу, иначе новые шаги
  // выглядели бы отсебятиной, а старые пришлось бы переписывать в
  // свежий батч ради проверки.
  const batches = ["BATCH_GIMN029_FINAL.md", "BATCH_GIMN030_REVISION.md"]
    .map((name) => path.join(process.cwd(), "docs", "batches", name))
    .filter((file) => existsSync(file));

  if (batches.length === 0) {
    console.log("  —    батчи не найдены, сверка пропущена (это не ошибка)");
  } else {
    const source = batches.map((file) => readFileSync(file, "utf8")).join("\n");

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
  // Маршрут закреплён целиком, а не правилом «не возвращаться дважды»
  // (GIMN-030). Правило пришлось бы отменить: батч ставит диагностику в
  // настройки пятым шагом, режимы на главную седьмым, звуки снова в
  // настройки восьмым — заход в настройки дважды тут согласован. А раз
  // так, полезнее закрепить сам маршрут: тогда перестановка шага видна,
  // а не проходит молча.
  const APPROVED_ROUTE = [
    "/app", // приветствие, своя тренировка
    "/app/nutrition",
    "/app/progress",
    "/app/settings", // углублённая диагностика
    "/app", // связь диагностики с тренировкой, режимы
    "/app/settings", // звуки
    "/app", // финал
  ];

  const runs: string[] = [];
  for (const p of TOUR_STEPS.map((s) => s.path)) if (runs[runs.length - 1] !== p) runs.push(p);
  check(
    "маршрут по экранам — согласованный",
    runs.join(" → ") === APPROVED_ROUTE.join(" → "),
    runs.join(" → "),
  );

  // Экран, на который заходят дважды, между заходами должен что-то
  // показать: два подряд шага на одном адресе — это один заход, а не два.
  const settingsRuns = runs.filter((p) => p === "/app/settings").length;
  check("в настройки заходим ровно дважды", settingsRuns === 2, String(settingsRuns));

  check("питание идёт до прогресса", firstStepOnPath("/app/nutrition") < firstStepOnPath("/app/progress"));
  check("прогресс идёт до настроек", firstStepOnPath("/app/progress") < firstStepOnPath("/app/settings"));
  check("несуществующий экран не находится", firstStepOnPath("/app/nowhere") === -1);
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
