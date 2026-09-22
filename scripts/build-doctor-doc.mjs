/**
 * Документ для ревматолога: весь справочник упражнений в читаемом виде.
 *
 * Этот документ читают; заполняемый чеклист с галочками — отдельный,
 * в Word: scripts/build-doctor-docx.mjs. Разбор seed у них общий
 * (scripts/lib/seed-exercises.mjs), чтобы два документа про одни
 * упражнения не расходились.
 *
 * Запуск: node scripts/build-doctor-doc.mjs
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import {
  parseExercises,
  JOINT,
  LEVEL,
  POSITION,
  EQUIPMENT,
  TYPE_TITLES,
  dose,
  contraList,
  effectList,
  GENERAL_QUESTIONS,
} from "./lib/seed-exercises.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "DOC_REVMATOLOG_FULL_gimn_zdorovia.md");

const MODE_FULL = {
  behtereva: "реабилитация Бехтерева",
  general: "общая форма",
  both: "обе программы",
};

function render(e, index) {
  const lines = [];
  const kit = EQUIPMENT[e.equipment ?? "none"];
  lines.push(`#### ${index}. ${e.name}${e.gentle ? " **[ЩАДЯЩЕЕ]**" : ""}`);
  lines.push("");
  lines.push(
    `**Программа:** ${MODE_FULL[e.mode] ?? e.mode} · **Зона:** ${JOINT[e.target_joint] ?? e.target_joint} · **Дозировка:** ${dose(e)}`,
  );
  lines.push("");
  lines.push(
    `**Уровень:** ${LEVEL[e.level] ?? e.level} · **Исходное положение:** ${POSITION[e.position ?? "any"] ?? e.position}${kit ? ` · **Снаряд:** ${kit}` : ""}`,
  );
  lines.push("");
  lines.push(`*${e.description}*`);
  lines.push("");
  lines.push("**Техника.**");
  lines.push("");
  // Шаги идут подряд, без пустых строк между ними: так Markdown соберёт их
  // в плотный нумерованный список, а не в череду абзацев через строку.
  for (const step of String(e.technique).split("\n")) {
    if (step.trim()) lines.push(step.trim());
  }
  lines.push("");

  const contra = contraList(e);
  lines.push(
    contra.length
      ? `**Противопоказания:** ${contra.join("; ")}.`
      : "**Противопоказания:** в справочнике не отмечены.",
  );
  lines.push("");

  const effects = effectList(e);
  if (effects.length) {
    lines.push(`**Реакция приложения на жалобу:** ${effects.join("; ")}.`);
    lines.push("");
  }
  return lines.join("\n");
}

/* -------------------------------- сборка --------------------------------- */

const all = parseExercises(ROOT);
const bar = all.filter((e) => (e.equipment ?? "none") !== "none");
const core = all.filter((e) => (e.equipment ?? "none") === "none");
// Щадящих в базе 22: одиннадцать из специального блока микроамплитуды и
// изометрики плюс дыхание и мягкая разминка, которым признак проставлен
// отдельным UPDATE. Отдельной главой идут только эти одиннадцать —
// остальные остаются в своих частях занятия, но помечены в заголовке.
const gentleBlock = core.filter((e) => e._authoredGentle);
const plain = core.filter((e) => !e._authoredGentle);

const NOTES = {
  breathing: "Задают ритм занятия и работают с подвижностью рёберно-позвоночных суставов.",
  warmup: "Разогрев перед основной частью, малая амплитуда.",
  massage: "Снятие мышечного напряжения; входит в разминочную часть.",
  main: "Основная часть занятия: подвижность, осанка, силовая выносливость.",
  stretch: "Завершение занятия, удержание без пружинящих движений.",
};

const CHAPTERS = [
  ...["breathing", "warmup", "massage", "main", "stretch"].map((t) => [
    TYPE_TITLES[t],
    plain.filter((e) => e.type === t),
    NOTES[t],
  ]),
  [
    "ЩАДЯЩИЕ",
    gentleBlock,
    "Микроамплитуда и изометрия. Их получают зоны, которые по углублённой диагностике почти не двигаются: ограничение — повод мягко развивать зону, а не исключать её.",
  ],
].filter(([, list]) => list.length > 0);

const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
const gentleTotal = all.filter((e) => e.gentle).length;

let doc = `# Упражнения «Гимн.здоровья» — полная база

Материал для врача-ревматолога. Собран ${today} из справочника приложения
(\`supabase/seed.sql\`) скриптом \`scripts/build-doctor-doc.mjs\` — то есть
описывает ровно то, что видит пользователь, без пересказа.

Заполняемый чеклист с колонками «одобрено / изменить / исключить» —
отдельный файл, \`docs/DOC_REVMATOLOG_CHECKLIST_gimn.docx\`.

**Что это за приложение.** Домашняя гимнастика с двумя программами:
реабилитация при болезни Бехтерева и общая физическая форма. Комплекс на
день собирается автоматически из справочника ниже — по анкете, диагностике
подвижности и жалобам, которые человек отмечает во время занятия.

**Как приложение ограничивает нагрузку.** У каждого упражнения проставлены
противопоказания и реакции на жалобы. Если человек отметил боль в зоне,
упражнения с соответствующим противопоказанием в комплекс не попадают.
Если во время занятия он нажал «Плохо» и выбрал симптом, приложение снижает
интенсивность следующих занятий на неделю или исключает упражнение.

**Чего приложение не делает.** Не ставит диагноз, не назначает лечение и не
отменяет назначения врача. Содержимое собрано по общедоступным
рекомендациям ASAS/EULAR по ЛФК при аксиальном спондилоартрите
(низкоударные движения, работа на подвижность и осанку, без осевой нагрузки
и без крайних амплитуд) и является вспомогательным материалом.

**Пометка [ЩАДЯЩЕЕ]** стоит у ${gentleTotal} упражнений: это те, которые
приложение считает безопасными при ограниченной подвижности. Отдельной
главой ниже идут ${gentleBlock.length} из них — специальный блок
микроамплитуды и изометрики; остальные остались в своих частях занятия.

---

## Вопросы, на которые нужен ваш ответ

${GENERAL_QUESTIONS.map((q, i) => `${i + 1}. **${q.title}.** ${q.text}`).join("\n")}

---

## Содержание

`;

CHAPTERS.forEach(([title, list], i) => {
  doc += `${i + 1}. [${title}](#${i + 1}-${title.toLowerCase()}) — ${list.length}\n`;
});
doc += `${CHAPTERS.length + 1}. [ОБЩАЯ ФОРМА: ТУРНИК И БРУСЬЯ](#${CHAPTERS.length + 1}-общая-форма-турник-и-брусья) — ${bar.length}\n\n`;
doc += `**Всего в справочнике: ${all.length} упражнений**, из них ${core.length} без снаряда\n(доступны в обеих программах по показаниям) и ${bar.length} на турнике и брусьях\n(только программа общей формы).\n\n---\n\n`;

CHAPTERS.forEach(([title, list, note], i) => {
  doc += `## ${i + 1}. ${title}\n\n${note}\n\nВ разделе: ${list.length}.\n\n`;
  list.forEach((e, n) => {
    doc += render(e, n + 1) + "\n";
  });
  doc += "---\n\n";
});

doc += `## ${CHAPTERS.length + 1}. ОБЩАЯ ФОРМА: ТУРНИК И БРУСЬЯ\n\n`;
doc += `Упражнения на турнике и брусьях. Доступны **только** в программе общей\nформы и только тем, кто в анкете отметил наличие снаряда. При болезни\nБехтерева не предлагаются ни при каких ответах — см. вопрос 3 выше.\n\nВ разделе: ${bar.length}.\n\n`;
bar.forEach((e, n) => {
  doc += render(e, n + 1) + "\n";
});

doc += `---\n\n**Итого: ${all.length} упражнений.**\n\nДокумент пересобирается командой \`node scripts/build-doctor-doc.mjs\` —\nпосле правок в справочнике его не нужно переписывать руками.\n`;

writeFileSync(OUT, doc, "utf8");

const dupes = all.map((e) => e.slug).filter((s, i, a) => a.indexOf(s) !== i);
console.log(`${path.relative(ROOT, OUT)}: ${all.length} упражнений (${core.length} без снаряда + ${bar.length} со снарядом)`);
CHAPTERS.forEach(([t, l]) => console.log(`  ${t}: ${l.length}`));
console.log(`  ТУРНИК И БРУСЬЯ: ${bar.length}`);
console.log(`  щадящих в базе: ${gentleTotal}`);
console.log(dupes.length ? `  ДУБЛИ: ${dupes.join(", ")}` : "  дублей нет");
const noTech = all.filter((e) => !e.technique || String(e.technique).trim().length < 20);
console.log(noTech.length ? `  БЕЗ ТЕХНИКИ: ${noTech.map((e) => e.slug).join(", ")}` : "  техника описана у всех");
