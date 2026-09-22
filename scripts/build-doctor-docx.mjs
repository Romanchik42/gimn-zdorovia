/**
 * Чеклист упражнений для ревматолога в Word (GIMN-021).
 *
 * Отличие от DOC_REVMATOLOG_FULL_gimn_zdorovia.md: тот документ читают,
 * а этот заполняют. По каждому упражнению — колонка решения с галочками
 * «одобрено / изменить / исключить» и место для пометки врача, поэтому
 * альбомная ориентация и таблица, а не текст.
 *
 * Источник — тот же supabase/seed.sql через scripts/lib/seed-exercises.mjs:
 * два документа про одни упражнения не должны расходиться.
 *
 * Запуск: node scripts/build-doctor-docx.mjs
 */
import { writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  PageOrientation,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from "docx";

import {
  parseExercises,
  JOINT,
  LEVEL,
  POSITION,
  EQUIPMENT,
  MODE,
  TYPE_TITLES,
  dose,
  contraList,
  effectList,
  doctorQuestion,
  GENERAL_QUESTIONS,
} from "./lib/seed-exercises.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "docs", "DOC_REVMATOLOG_CHECKLIST_gimn.docx");

/* ------------------------------- оформление ------------------------------ */

const FONT = "Calibri";
const BODY = 22; // половины пункта, то есть 11 pt — минимум для печати
const SMALL = 20; // 10 pt, для служебных строк внутри ячейки

/** Ширины колонок в DXA. Сумма равна ширине текста на странице. */
const COLS = [620, 2500, 2300, 4900, 2100, 2600];
const TABLE_WIDTH = COLS.reduce((a, b) => a + b, 0);
const MARGIN = Math.round((16838 - TABLE_WIDTH) / 2);

const HEADERS = ["№", "Упражнение", "Зона и дозировка", "Техника", "Противопоказания", "Решение врача"];

function text(value, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 40, line: 264 },
    alignment: opts.align,
    children: [
      new TextRun({
        text: value,
        font: FONT,
        size: opts.size ?? BODY,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
      }),
    ],
  });
}

function cell(children, opts = {}) {
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.TOP,
    shading: opts.fill ? { type: ShadingType.CLEAR, fill: opts.fill, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: children.length > 0 ? children : [text("")],
  });
}

function headerRow() {
  return new TableRow({
    tableHeader: true,
    children: HEADERS.map((h, i) =>
      cell([text(h, { bold: true, size: SMALL })], { width: COLS[i], fill: "E8EDE9" }),
    ),
  });
}

/* --------------------------- строка упражнения --------------------------- */

function exerciseRow(e, index) {
  const kit = EQUIPMENT[e.equipment ?? "none"];
  const contra = contraList(e);
  const effects = effectList(e);
  const question = doctorQuestion(e);

  const nameCell = [text(e.name, { bold: true })];
  if (e.gentle) nameCell.push(text("ЩАДЯЩЕЕ", { size: SMALL, bold: true, color: "7C6A2A" }));
  nameCell.push(text(`Программа: ${MODE[e.mode] ?? e.mode}`, { size: SMALL, color: "666666" }));

  const metaCell = [
    text(JOINT[e.target_joint] ?? e.target_joint),
    text(dose(e), { bold: true }),
    text(`Уровень: ${LEVEL[e.level] ?? e.level}`, { size: SMALL, color: "666666" }),
    text(`Положение: ${POSITION[e.position ?? "any"] ?? e.position}`, { size: SMALL, color: "666666" }),
  ];
  if (kit) metaCell.push(text(`Снаряд: ${kit}`, { size: SMALL, color: "666666" }));

  const techniqueCell = [text(e.description, { italics: true, size: SMALL, color: "555555", after: 80 })];
  for (const step of String(e.technique).split("\n")) {
    if (step.trim()) techniqueCell.push(text(step.trim()));
  }

  const contraCell = contra.length
    ? contra.map((c) => text(`• ${c}`))
    : [text("не отмечены", { italics: true, color: "666666" })];
  if (effects.length) {
    contraCell.push(text("Реакция приложения на жалобу:", { size: SMALL, bold: true, color: "666666" }));
    for (const x of effects) contraCell.push(text(x, { size: SMALL, color: "666666" }));
  }

  const decisionCell = [
    text("☐  Одобрено"),
    text("☐  Изменить"),
    text("☐  Исключить"),
  ];
  if (question) {
    decisionCell.push(text(`Вопрос: ${question}`, { size: SMALL, italics: true, color: "8A4B00", after: 60 }));
  }
  decisionCell.push(text("Пометка: ___________________", { size: SMALL, color: "999999" }));

  return new TableRow({
    children: [
      cell([text(String(index), { bold: true })], { width: COLS[0] }),
      cell(nameCell, { width: COLS[1] }),
      cell(metaCell, { width: COLS[2] }),
      cell(techniqueCell, { width: COLS[3] }),
      cell(contraCell, { width: COLS[4] }),
      cell(decisionCell, { width: COLS[5] }),
    ],
  });
}

function chapterTable(list) {
  return new Table({
    columnWidths: COLS,
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
      left: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
      right: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "DDDDDD" },
    },
    rows: [headerRow(), ...list.map((e, i) => exerciseRow(e, i + 1))],
  });
}

function heading(value) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 140 },
    children: [new TextRun({ text: value, font: FONT, size: 28, bold: true })],
  });
}

/* --------------------------------- сборка -------------------------------- */

const all = parseExercises(ROOT);
const bar = all.filter((e) => (e.equipment ?? "none") !== "none");
const core = all.filter((e) => (e.equipment ?? "none") === "none");
// Специальный щадящий блок — отдельной главой, как в Markdown-выгрузке.
const gentleBlock = core.filter((e) => e._authoredGentle);
const plain = core.filter((e) => !e._authoredGentle);

const CHAPTERS = [
  ...["breathing", "warmup", "massage", "main", "stretch"].map((t) => [
    TYPE_TITLES[t],
    plain.filter((e) => e.type === t),
  ]),
  ["ЩАДЯЩИЕ: микроамплитуда и изометрия", gentleBlock],
  ["ТУРНИК И БРУСЬЯ (только программа общей формы)", bar],
].filter(([, list]) => list.length > 0);

const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

const body = [
  new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({ text: "Гимн.здоровья — Чеклист упражнений для ревматолога", font: FONT, size: 36, bold: true }),
    ],
  }),
  // Русская локаль уже заканчивает дату на «г.» — своя точка дала бы две.
  text(`Составлен ${today} · всего упражнений: ${all.length} (${core.length} без снаряда, ${bar.length} на турнике и брусьях)`, {
    size: SMALL,
    color: "666666",
    after: 200,
  }),

  heading("Что это за приложение"),
  text(
    "«Гимн.здоровья» — приложение с домашней гимнастикой. В нём две программы: реабилитация при " +
      "болезни Бехтерева и общая физическая форма. Комплекс на день приложение собирает само из " +
      "справочника, который приведён ниже: по анкете, по диагностике подвижности и по жалобам, " +
      "которые человек отмечает прямо во время занятия.",
  ),
  text(
    "У каждого упражнения в базе проставлены противопоказания и реакции на жалобы. Если человек " +
      "отметил боль в зоне, упражнения с соответствующим противопоказанием в комплекс не попадают. " +
      "Если во время занятия он нажал «Плохо» и выбрал симптом, приложение на неделю снижает " +
      "интенсивность или исключает упражнение совсем.",
  ),
  text(
    "Приложение не ставит диагноз, не назначает лечение и не отменяет назначения врача. Содержимое " +
      "составлено по общедоступным рекомендациям ASAS/EULAR по ЛФК при аксиальном спондилоартрите: " +
      "низкоударные движения, работа на подвижность и осанку, без осевой нагрузки и без крайних амплитуд.",
    { after: 160 },
  ),

  heading("Как заполнять"),
  text(
    "По каждому упражнению отметьте одно из трёх в последней колонке: «Одобрено» — оставить как есть; " +
      "«Изменить» — оставить, но поправить дозировку, амплитуду или противопоказания (напишите, что именно); " +
      "«Исключить» — убрать из программы. Там, где у нас есть свой вопрос, он выделен и подписан «Вопрос».",
  ),
  text(
    "Пять общих вопросов собраны в конце документа — на них ответ важнее, чем на отметки по отдельным упражнениям.",
    { after: 160 },
  ),
];

for (const [title, list] of CHAPTERS) {
  body.push(heading(`${title} — ${list.length}`));
  body.push(chapterTable(list));
  body.push(text("", { after: 120 }));
}

body.push(heading("Пять вопросов, на которые нужен ваш ответ"));
GENERAL_QUESTIONS.forEach((q, i) => {
  body.push(text(`${i + 1}. ${q.title}`, { bold: true, after: 60 }));
  body.push(text(q.text, { after: 100 }));
  body.push(text("Ответ: ______________________________________________________________________", {
    color: "999999",
    after: 200,
  }));
});

body.push(
  text(
    "Документ собран из справочника приложения командой node scripts/build-doctor-docx.mjs — " +
      "он описывает ровно то, что видит пользователь.",
    { size: SMALL, italics: true, color: "888888", align: AlignmentType.LEFT },
  ),
);

const doc = new Document({
  creator: "Гимн.здоровья",
  title: "Чеклист упражнений для ревматолога",
  description: "Справочник упражнений приложения «Гимн.здоровья» для разбора врачом",
  sections: [
    {
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: 720, bottom: 720, left: MARGIN, right: MARGIN },
        },
      },
      children: body,
    },
  ],
});

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, await Packer.toBuffer(doc));

console.log(`${path.relative(ROOT, OUT)}: ${all.length} упражнений, ${(statSync(OUT).size / 1024).toFixed(0)} КБ`);
for (const [title, list] of CHAPTERS) console.log(`  ${title}: ${list.length}`);
console.log(`  с вопросом врачу: ${all.filter((e) => doctorQuestion(e)).length}`);
