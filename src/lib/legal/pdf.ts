import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";

import fontkit from "@pdf-lib/fontkit";
import {
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

import {
  CONTACT,
  DRAFT_NOTICE,
  LAUNCH_DATE_PLACEHOLDER,
  OWNER_PLACEHOLDER,
  REQUISITES_PLACEHOLDER,
  type LegalBlock,
  type LegalDoc,
} from "@/legal/document";

/**
 * Печатная версия юридических документов (GIMN-029).
 *
 * Текст берётся из тех же данных, что и экранная версия: LegalDoc — это
 * массив пунктов, а не вёрстка. Второй копии текста для печати нет и быть
 * не должно — расхождение между тем, что человек прочитал на экране, и
 * тем, что он распечатал и подписал, стоит дороже любой экономии.
 *
 * Шрифт вкладывается в файл. Четырнадцать стандартных начертаний PDF
 * содержат только латиницу, и без вложенного шрифта весь документ вышел бы
 * квадратами — ровно та мина, о которой предупреждал батч.
 *
 * Вёрстка здесь простая намеренно: поля, колонка текста, переносы по
 * словам, нумерация страниц. Документ, который несут юристу и подшивают в
 * папку, не выигрывает от изысков, а каждая лишняя возможность — это
 * лишний способ развалить страницу на длинном слове.
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = { top: 56, bottom: 56, left: 56, right: 56 };
const SIZE = { title: 16, lead: 10, clause: 12, body: 10, small: 9 };
const LEADING = 1.45;
const GAP = { afterTitle: 18, afterClause: 8, betweenBlocks: 10, betweenParagraphs: 6 };

const INK = rgb(0.09, 0.09, 0.11);
const MUTED = rgb(0.42, 0.42, 0.46);
const RULE = rgb(0.8, 0.8, 0.84);

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

/**
 * Шрифты читаются с диска один раз на инстанс: файл на полмегабайта, а
 * документов три, и перечитывать его на каждое скачивание незачем.
 */
let fontFiles: Promise<{ regular: Buffer; bold: Buffer }> | null = null;

function loadFontFiles(): Promise<{ regular: Buffer; bold: Buffer }> {
  fontFiles ??= (async () => ({
    regular: await readFile(path.join(FONT_DIR, "PTSans-Regular.ttf")),
    bold: await readFile(path.join(FONT_DIR, "PTSans-Bold.ttf")),
  }))();
  return fontFiles;
}

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Ширина текстовой колонки. */
const COLUMN = A4.width - MARGIN.left - MARGIN.right;

/**
 * Разбивка абзаца на строки по ширине.
 *
 * Слово, которое само по себе шире колонки (длинная ссылка, например),
 * рубится по символам: иначе оно уехало бы за поле и было бы обрезано при
 * печати, причём молча.
 */
function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";

  const push = () => {
    if (line) lines.push(line);
    line = "";
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) {
      line = candidate;
      continue;
    }

    push();

    if (font.widthOfTextAtSize(word, size) <= width) {
      line = word;
      continue;
    }

    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > width) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line = chunk;
  }

  push();
  return lines;
}

/** Состояние обхода: текущая страница и высота, на которой пишем. */
class Layout {
  private readonly pdf: PDFDocument;
  private readonly fonts: Fonts;
  private page: PDFPage;
  private y: number;
  readonly pages: PDFPage[] = [];

  // Поля объявлены явно, без сокращённой записи в параметрах конструктора:
  // проверки в этом репозитории запускаются на срезании типов Node, а оно
  // такую запись не понимает и падает ещё до первой строки кода.
  constructor(pdf: PDFDocument, fonts: Fonts) {
    this.pdf = pdf;
    this.fonts = fonts;
    this.page = this.newPage();
    this.y = A4.height - MARGIN.top;
  }

  private newPage(): PDFPage {
    const page = this.pdf.addPage([A4.width, A4.height]);
    this.pages.push(page);
    return page;
  }

  /** Освобождает место под блок высотой h, при нехватке — новая страница. */
  private ensure(h: number): void {
    if (this.y - h >= MARGIN.bottom) return;
    this.page = this.newPage();
    this.y = A4.height - MARGIN.top;
  }

  space(h: number): void {
    this.y -= h;
  }

  /**
   * Пишет абзац. Строки переносятся вместе с отступом слева, поэтому
   * пункты списка не «съезжают» на второй строке под маркер.
   */
  text(
    value: string,
    opts: {
      size?: number;
      bold?: boolean;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gapAfter?: number;
    } = {},
  ): void {
    const size = opts.size ?? SIZE.body;
    const font = opts.bold ? this.fonts.bold : this.fonts.regular;
    const indent = opts.indent ?? 0;
    const lineHeight = size * LEADING;
    const lines = wrap(value, font, size, COLUMN - indent);

    for (const line of lines) {
      this.ensure(lineHeight);
      this.y -= lineHeight;
      this.page.drawText(line, {
        x: MARGIN.left + indent,
        y: this.y,
        size,
        font,
        color: opts.color ?? INK,
      });
    }

    if (opts.gapAfter) this.space(opts.gapAfter);
  }

  /** Маркер списка рисуется отдельно, чтобы текст переносился ровной колонкой. */
  bullet(value: string): void {
    const size = SIZE.body;
    const lineHeight = size * LEADING;
    this.ensure(lineHeight);
    // Позиция маркера считается до отрисовки текста: text двигает y сам.
    const markerY = this.y - lineHeight;
    this.page.drawText("—", {
      x: MARGIN.left,
      y: markerY,
      size,
      font: this.fonts.regular,
      color: MUTED,
    });
    this.text(value, { indent: 16 });
  }

  rule(): void {
    this.ensure(10);
    this.y -= 6;
    this.page.drawLine({
      start: { x: MARGIN.left, y: this.y },
      end: { x: A4.width - MARGIN.right, y: this.y },
      thickness: 0.5,
      color: RULE,
    });
    this.y -= 6;
  }
}

/**
 * Таблица без рамок: колонки равной ширины, каждая ячейка переносится сама.
 * Строка таблицы целиком на одну страницу не гарантируется — гарантируется,
 * что ни одна строка текста не потеряется.
 */
function drawTable(layout: Layout, head: string[], rows: string[][]): void {
  layout.text(head.join(" · "), { bold: true, size: SIZE.small, gapAfter: 2 });
  for (const row of rows) {
    layout.text(row.join(" — "), { size: SIZE.small, indent: 8, gapAfter: 2 });
  }
}

function drawBlock(layout: Layout, block: LegalBlock): void {
  if (block.kind === "p") {
    layout.text(block.text, { gapAfter: GAP.betweenParagraphs });
    return;
  }
  if (block.kind === "list") {
    for (const item of block.items) layout.bullet(item);
    layout.space(GAP.betweenParagraphs);
    return;
  }
  drawTable(layout, block.head, block.rows);
  layout.space(GAP.betweenParagraphs);
}

/**
 * Приводит вложенные шрифты к букве спецификации (GIMN-029).
 *
 * pdf-lib оставляет две вольности, которые большинство читалок прощает, а
 * Adobe Reader — нет. На телефоне документ открывался нормально, на
 * компьютере в части программ капризничал: ровно тот случай, когда «у меня
 * работает» ничего не значит.
 *
 * Первое: у потока со шрифтом нет ключа Length1 — длины несжатой программы
 * шрифта. Для FontFile2 спецификация требует его прямо. Восстанавливаем
 * распаковкой самого потока: другого источника этой длины не осталось.
 *
 * Второе: урезанный шрифт назван «PTSans-Regular-5466». Подмножество
 * положено называть «ABCDEF+PTSans-Regular» — шесть заглавных букв и плюс.
 * По этому префиксу читалка понимает, что в файле не весь шрифт, а часть;
 * без него она вправе считать шрифт полным и вести себя как угодно,
 * встретив отсутствующий глиф.
 */
function hardenEmbeddedFonts(pdf: PDFDocument): void {
  const objects = pdf.context.enumerateIndirectObjects();
  const dicts = objects.map(([, obj]) => obj).filter((obj): obj is PDFDict => obj instanceof PDFDict);

  const renamed = new Map<string, PDFName>();
  let tagIndex = 0;

  for (const dict of dicts) {
    if (dict.get(PDFName.of("Type"))?.toString() !== "/FontDescriptor") continue;

    // Length1: длина несжатой программы шрифта.
    const fileRef = dict.get(PDFName.of("FontFile2"));
    if (fileRef instanceof PDFRef) {
      const stream = pdf.context.lookup(fileRef);
      if (stream instanceof PDFRawStream) {
        const filter = stream.dict.get(PDFName.of("Filter"))?.toString() ?? "";
        const raw = stream.getContents();
        const size = filter.includes("FlateDecode") ? inflateSync(Buffer.from(raw)).length : raw.length;
        stream.dict.set(PDFName.of("Length1"), PDFNumber.of(size));
      }
    }

    // Имя подмножества: шесть заглавных букв, плюс, исходное имя.
    const current = dict.get(PDFName.of("FontName"));
    if (!current) continue;
    const old = current.toString().replace(/^\//, "");
    if (old.includes("+")) continue;

    const tag = subsetTag(tagIndex++);
    const clean = old.replace(/-\d+$/, "");
    const next = PDFName.of(`${tag}+${clean}`);
    dict.set(PDFName.of("FontName"), next);
    renamed.set(old, next);
  }

  // BaseFont стоит и у Type0, и у CIDFontType2 — обе ссылки на то же имя.
  for (const dict of dicts) {
    const base = dict.get(PDFName.of("BaseFont"));
    if (!base) continue;
    const next = renamed.get(base.toString().replace(/^\//, ""));
    if (next) dict.set(PDFName.of("BaseFont"), next);
  }
}

/** Шесть заглавных букв: AAAAAA, AAAAAB и так далее. Важна только уникальность. */
function subsetTag(index: number): string {
  let tag = "";
  let n = index;
  for (let i = 0; i < 6; i++) {
    tag = String.fromCharCode(65 + (n % 26)) + tag;
    n = Math.floor(n / 26);
  }
  return tag;
}

export async function renderLegalPdf(doc: LegalDoc): Promise<Uint8Array> {
  const files = await loadFontFiles();

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fonts: Fonts = {
    regular: await pdf.embedFont(files.regular, { subset: true }),
    bold: await pdf.embedFont(files.bold, { subset: true }),
  };

  pdf.setTitle(doc.title);
  pdf.setSubject(doc.lead);
  pdf.setProducer("Гимн.здоровья");
  pdf.setCreator("Гимн.здоровья");

  const layout = new Layout(pdf, fonts);

  layout.text(doc.title, { size: SIZE.title, bold: true, gapAfter: 4 });
  layout.text(doc.lead, { size: SIZE.lead, color: MUTED, gapAfter: 10 });
  layout.text(DRAFT_NOTICE, { size: SIZE.small, color: MUTED, gapAfter: GAP.afterTitle });

  doc.clauses.forEach((clause, i) => {
    layout.text(`${i + 1}. ${clause.title}`, {
      size: SIZE.clause,
      bold: true,
      gapAfter: GAP.afterClause,
    });
    for (const block of clause.blocks) drawBlock(layout, block);
    layout.space(GAP.betweenBlocks);
  });

  layout.rule();
  layout.text(`${OWNER_PLACEHOLDER}. Реквизиты ${REQUISITES_PLACEHOLDER}.`, {
    size: SIZE.small,
    color: MUTED,
  });
  layout.text(`Связь: форма отзыва в приложении или бот ${CONTACT}.`, {
    size: SIZE.small,
    color: MUTED,
  });
  layout.text(`Дата вступления в силу: ${LAUNCH_DATE_PLACEHOLDER}.`, {
    size: SIZE.small,
    color: MUTED,
  });

  // Нумерация проставляется в конце: раньше неизвестно, сколько страниц
  // вышло, а «стр. 3 из 7» без второго числа теряет половину смысла —
  // именно оно говорит, что документ распечатан целиком.
  const total = layout.pages.length;
  layout.pages.forEach((page, i) => {
    const label = `${i + 1} из ${total}`;
    const width = fonts.regular.widthOfTextAtSize(label, SIZE.small);
    page.drawText(label, {
      x: A4.width - MARGIN.right - width,
      y: MARGIN.bottom - 24,
      size: SIZE.small,
      font: fonts.regular,
      color: MUTED,
    });
  });

  // flush до правок не для красоты: pdf-lib вкладывает шрифты лениво, уже
  // на сохранении, и до этого вызова объектов шрифта в документе просто
  // нет — первая версия правки молча ничего не находила.
  await pdf.flush();
  hardenEmbeddedFonts(pdf);

  return pdf.save();
}
