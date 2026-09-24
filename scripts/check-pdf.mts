/**
 * Проверка печатных версий документов (GIMN-029).
 *
 * Главная опасность здесь — кириллица. В PDF нет «системных» шрифтов с
 * русскими буквами: четырнадцать стандартных начертаний содержат только
 * латиницу. Забыли вложить шрифт — и документ откроется рядом квадратов,
 * причём сборка пройдёт, ошибок не будет, и заметит это только человек,
 * который откроет файл.
 *
 * Поэтому проверка не верит ни на слово, ни на глаз: она собирает PDF,
 * распаковывает его потоки, восстанавливает видимый текст через карту
 * ToUnicode и сравнивает с исходными данными документа. Если в файле
 * вместо букв квадраты — совпадения не будет.
 *
 * Запуск: npm run check:pdf
 */
import { inflateSync } from "node:zlib";

import { renderLegalPdf } from "@/lib/legal/pdf";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/legal/registry";
import { DRAFT_NOTICE, OWNER_PLACEHOLDER, type LegalDoc } from "@/legal/document";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

/** Все потоки файла, распакованные. Сжатые — через inflate, прочие как есть. */
function streams(pdf: Buffer): string[] {
  const out: string[] = [];
  const marker = Buffer.from("stream");
  const end = Buffer.from("endstream");

  let at = 0;
  while (true) {
    const start = pdf.indexOf(marker, at);
    if (start === -1) break;
    const stop = pdf.indexOf(end, start);
    if (stop === -1) break;

    // После «stream» идёт перевод строки — его в данные не включаем.
    let from = start + marker.length;
    if (pdf[from] === 0x0d) from++;
    if (pdf[from] === 0x0a) from++;

    const raw = pdf.subarray(from, stop);
    try {
      out.push(inflateSync(raw).toString("latin1"));
    } catch {
      out.push(raw.toString("latin1"));
    }
    at = stop + end.length;
  }
  return out;
}

/**
 * Карты «номер глифа → символ» из ToUnicode — по одной на шрифт.
 *
 * Именно по одной, а не одна общая: обычное и полужирное начертания
 * вкладываются урезанными, и номера глифов у них свои. Склеенная карта
 * читает заголовки по таблице основного текста и выдаёт кашу — первый
 * вариант этой проверки так и делал и обвинял в этом генератор.
 */
function toUnicodeMaps(chunks: string[]): Map<number, string>[] {
  const maps: Map<number, string>[] = [];

  for (const chunk of chunks) {
    if (!chunk.includes("beginbfchar") && !chunk.includes("beginbfrange")) continue;
    const map = new Map<number, string>();

    for (const block of chunk.split("beginbfchar").slice(1)) {
      const body = block.split("endbfchar")[0];
      for (const m of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        map.set(parseInt(m[1], 16), String.fromCodePoint(parseInt(m[2].slice(0, 4), 16)));
      }
    }

    for (const block of chunk.split("beginbfrange").slice(1)) {
      const body = block.split("endbfrange")[0];
      for (const m of body.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
        const from = parseInt(m[1], 16);
        const to = parseInt(m[2], 16);
        const first = parseInt(m[3].slice(0, 4), 16);
        for (let i = 0; i <= to - from; i++) map.set(from + i, String.fromCodePoint(first + i));
      }
    }

    if (map.size > 0) maps.push(map);
  }

  return maps;
}

/** Видимый текст одной картой: строки, набранные другим шрифтом, выпадут. */
function decodeWith(chunks: string[], map: Map<number, string>): string {
  const parts: string[] = [];

  for (const chunk of chunks) {
    if (!chunk.includes("Tj") && !chunk.includes("TJ")) continue;
    for (const m of chunk.matchAll(/<([0-9a-fA-F\s]+)>\s*Tj/g)) {
      const hex = m[1].replace(/\s+/g, "");
      let word = "";
      for (let i = 0; i + 3 < hex.length + 1; i += 4) {
        const code = parseInt(hex.slice(i, i + 4), 16);
        word += map.get(code) ?? "";
      }
      parts.push(word);
    }
  }

  return parts.join(" ");
}

/**
 * Весь текст файла: каждая карта прикладывается ко всем строкам. Строка,
 * набранная не тем шрифтом, расшифруется мусором — но своей картой она
 * расшифруется верно, и в общую кучу попадёт правильный вариант. Для
 * вопроса «есть ли в файле такая фраза» этого достаточно.
 */
function visibleText(chunks: string[]): string {
  return toUnicodeMaps(chunks)
    .map((map) => decodeWith(chunks, map))
    .join(" ");
}

/**
 * Высоты, на которых нарисована каждая строка.
 *
 * Нужны, чтобы поймать текст, уехавший за страницу. Само по себе
 * извлечение текста его не ловит: строка, нарисованная на высоте минус
 * двести, из файла читается прекрасно, а на бумаге её нет. Именно так
 * выглядит сломанная разбивка на страницы — и именно её первый вариант
 * этой проверки пропускал.
 */
function baselines(chunks: string[]): { x: number; y: number }[][] {
  const perPage: { x: number; y: number }[][] = [];
  for (const chunk of chunks) {
    if (!chunk.includes("Tm")) continue;
    const spots = [...chunk.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g)].map((m) => ({
      x: Number(m[1]),
      y: Number(m[2]),
    }));
    if (spots.length > 0) perPage.push(spots);
  }
  return perPage;
}

/**
 * Сколько строк помещается на лист: высота за вычетом полей, делённая на
 * межстрочный интервал самого мелкого кегля. Считаем по разным высотам, а
 * не по числу надписей: у пункта списка их две — маркер и сам текст, и
 * стоят они на одной строке по замыслу.
 */
const MAX_LINES_PER_PAGE = 60;

/** Высота листа A4 в точках — та же, что в генераторе. */
const PAGE_HEIGHT = 841.89;

/** Первые слова каждого абзаца документа — по ним и ищем совпадение. */
function sampleSentences(doc: LegalDoc): string[] {
  const out: string[] = [doc.title, doc.lead];
  for (const clause of doc.clauses) {
    out.push(clause.title);
    for (const block of clause.blocks) {
      if (block.kind === "p") out.push(block.text);
      if (block.kind === "list") out.push(...block.items);
    }
  }
  return out;
}

/** Текст в PDF разбит на строки, поэтому сравниваем по словам, а не целиком. */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter((w) => w.length > 3);
}

console.log("Сборка:");

const rendered = new Map<string, Buffer>();
for (const slug of LEGAL_SLUGS) {
  const bytes = await renderLegalPdf(LEGAL_DOCS[slug].doc);
  const buf = Buffer.from(bytes);
  rendered.set(slug, buf);
  check(
    `${slug}: файл собран (${(buf.length / 1024).toFixed(0)} КиБ)`,
    buf.subarray(0, 5).toString() === "%PDF-" && buf.length > 5000,
  );
}

console.log("\nШрифт вложен в файл:");
for (const slug of LEGAL_SLUGS) {
  // Служебные словари pdf-lib складывает в сжатые потоки, поэтому искать
  // их в сырых байтах бесполезно — смотрим в распакованном.
  const all = [rendered.get(slug)!.toString("latin1"), ...streams(rendered.get(slug)!)].join(" ");
  check(`${slug}: есть встроенный TrueType`, all.includes("/FontFile2"));
  check(`${slug}: есть карта ToUnicode`, all.includes("/ToUnicode"));
  check(
    `${slug}: не опирается на стандартные шрифты PDF`,
    !all.includes("/BaseFont /Helvetica") && !all.includes("/BaseFont/Helvetica"),
  );
}

console.log("\nКириллица читается из файла:");
for (const slug of LEGAL_SLUGS) {
  const chunks = streams(rendered.get(slug)!);
  const text = visibleText(chunks);

  const cyrillic = [...text].filter((ch) => /[а-яёА-ЯЁ]/.test(ch)).length;
  check(`${slug}: в тексте ${cyrillic} русских букв`, cyrillic > 500, String(cyrillic));

  const squares = [...text].filter((ch) => ch === "�" || ch === "□").length;
  check(`${slug}: квадратов и замен нет`, squares === 0, String(squares));

  const found = words(text);
  const haveAll = (phrase: string) => words(phrase).every((w) => found.includes(w));

  check(`${slug}: заголовок на месте`, haveAll(LEGAL_DOCS[slug].doc.title), LEGAL_DOCS[slug].doc.title);
  check(`${slug}: владелец назван обезличенно`, haveAll(OWNER_PLACEHOLDER));
  check(`${slug}: плашка «это проект» на месте`, haveAll(DRAFT_NOTICE));

  // Каждый абзац документа должен найтись в файле — иначе часть текста
  // потерялась при разбивке на страницы, и человек распечатает огрызок.
  const sentences = sampleSentences(LEGAL_DOCS[slug].doc);
  const missing = sentences.filter((s) => !haveAll(s));
  check(
    `${slug}: все ${sentences.length} абзацев попали в файл`,
    missing.length === 0,
    missing.length ? `нет: ${missing[0].slice(0, 50)}…` : "",
  );

  // Разбивка на страницы. Ловим две беды сразу: строку, уехавшую за лист,
  // и страницу, на которую свалили больше, чем на неё влезает, — вторая
  // выглядит как текст, напечатанный поверх текста.
  const pages = baselines(chunks);
  const all = pages.flat();
  const outside = all.filter((p) => p.y < 10 || p.y > PAGE_HEIGHT - 10);
  check(
    `${slug}: все ${all.length} надписей на листе`,
    all.length > 100 && outside.length === 0,
    outside.length ? `за полем: ${outside.slice(0, 3).map((p) => p.y.toFixed(0)).join(", ")}` : "",
  );

  const linesOn = (page: { y: number }[]) => new Set(page.map((p) => p.y.toFixed(1))).size;
  const crowded = pages.filter((page) => linesOn(page) > MAX_LINES_PER_PAGE);
  check(
    `${slug}: ${pages.length} страниц, ни одна не перегружена`,
    pages.length > 1 && crowded.length === 0,
    crowded.length ? `строк на странице: ${linesOn(crowded[0])}` : `страниц: ${pages.length}`,
  );

  // Две надписи в одной точке — это текст поверх текста. Маркер списка не
  // в счёт: он стоит на той же высоте, но левее самого пункта.
  const stacked = pages.filter(
    (page) => new Set(page.map((p) => `${p.x.toFixed(1)}:${p.y.toFixed(1)}`)).size < page.length,
  );
  check(`${slug}: надписи не наложены друг на друга`, stacked.length === 0, String(stacked.length));

  // Ёлочки и тире — первое, что отваливается при неверной кодировке.
  check(`${slug}: кавычки-ёлочки сохранились`, text.includes("«") && text.includes("»"));
}

console.log("\nСлужебное:");
{
  const slug = LEGAL_SLUGS[0];
  const chunks = streams(rendered.get(slug)!);
  const text = visibleText(chunks);
  check("страницы пронумерованы", /\d+\s+из\s+\d+/.test(text.replace(/\s+/g, " ")), "");

  const names = LEGAL_SLUGS.map((s) => LEGAL_DOCS[s].fileName);
  check("у каждого документа своё имя файла", new Set(names).size === names.length);
  check("имена оканчиваются на .pdf", names.every((n) => n.endsWith(".pdf")));
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
