/**
 * Разбор справочника упражнений из supabase/seed.sql.
 *
 * Общий модуль для документов врачу: и Markdown-выгрузка
 * (build-doctor-doc.mjs), и чеклист в Word (build-doctor-docx.mjs) читают
 * один и тот же источник одним и тем же кодом — иначе два документа про
 * одни упражнения начнут расходиться.
 *
 * Почему seed, а не живая база: seed — то, из чего база наполняется, и он
 * есть у любого, кто открыл репозиторий. Собрать документ по устаревшему
 * слепку так нельзя.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

/* ------------------------------- разбор SQL ------------------------------ */

/** Значения одной строки VALUES: идём посимвольно, следя за кавычками и скобками. */
function splitRow(text) {
  const out = [];
  let buf = "";
  let depth = 0;
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") {
        buf += c + text[++i];
        continue;
      }
      if (c === "'") {
        // Удвоенный апостроф внутри строки — это один апостроф, не конец.
        if (text[i + 1] === "'") {
          buf += "''";
          i++;
          continue;
        }
        inString = false;
      }
      buf += c;
      continue;
    }
    if (c === "'") {
      inString = true;
      buf += c;
      continue;
    }
    if (c === "(" || c === "[") depth++;
    if (c === ")" || c === "]") depth--;
    if (c === "," && depth === 0) {
      out.push(buf.trim());
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Убирает построчные комментарии SQL вне строковых литералов.
 * Иначе комментарий вроде «-- Дыхание (4)» съезжает в разбор скобками.
 */
function stripComments(text) {
  let out = "";
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") {
        out += c + text[++i];
        continue;
      }
      if (c === "'") {
        if (text[i + 1] === "'") {
          out += "''";
          i++;
          continue;
        }
        inString = false;
      }
      out += c;
      continue;
    }
    if (c === "'") {
      inString = true;
      out += c;
      continue;
    }
    if (c === "-" && text[i + 1] === "-") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += c;
  }
  return out;
}

/** Строки VALUES одного INSERT — по скобкам верхнего уровня. */
function splitValues(text) {
  const rows = [];
  let depth = 0;
  let start = -1;
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === "'") inString = text[i + 1] === "'" ? (i++, true) : false;
      continue;
    }
    if (c === "'") {
      inString = true;
      continue;
    }
    if (c === "(") {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (c === ")") {
      depth--;
      if (depth === 0 && start >= 0) {
        rows.push(text.slice(start, i));
        start = -1;
      }
    }
  }
  return rows;
}

/** Литерал SQL → значение JS. */
function value(raw) {
  const v = raw.trim();
  if (v === "NULL") return null;
  if (v === "TRUE") return true;
  if (v === "FALSE") return false;
  if (/^-?\d+$/.test(v)) return Number(v);

  const jsonb = v.match(/^'([\s\S]*)'::jsonb$/);
  if (jsonb) {
    try {
      return JSON.parse(jsonb[1].replace(/''/g, "'"));
    } catch {
      return null;
    }
  }
  const escaped = v.match(/^E'([\s\S]*)'$/);
  if (escaped) {
    return escaped[1].replace(/\\n/g, "\n").replace(/\\'/g, "'").replace(/''/g, "'");
  }
  const plain = v.match(/^'([\s\S]*)'$/);
  if (plain) return plain[1].replace(/''/g, "'");
  return v;
}

/**
 * Все упражнения из seed. Порядок сохраняется: в seed он осмысленный —
 * от простого к сложному внутри каждого блока.
 */
export function parseExercises(root) {
  const sql = readFileSync(path.join(root, "supabase", "seed.sql"), "utf8");
  const rows = [];
  const re = /INSERT INTO exercises \(([^)]*)\) VALUES([\s\S]*?)ON CONFLICT/g;
  let m;
  let block = 0;
  while ((m = re.exec(sql))) {
    const cols = m[1].split(",").map((c) => c.trim());
    for (const chunk of splitValues(stripComments(m[2]))) {
      const values = splitRow(chunk);
      if (values.length !== cols.length) {
        throw new Error(`строка на ${values.length} значений при ${cols.length} колонках: ${values[0]}`);
      }
      rows.push({
        ...Object.fromEntries(cols.map((c, i) => [c, value(values[i])])),
        // Из какого блока seed строка. Нужно, чтобы отличить одиннадцать
        // упражнений специального щадящего блока (микроамплитуда и
        // изометрика) от дыхания и мягкой разминки, которым признак
        // «щадящее» проставил поздний UPDATE.
        _block: block,
        _authoredGentle: cols.includes("gentle"),
      });
    }
    block++;
  }

  // Поздние UPDATE в seed меняют position и gentle у ранних строк — без них
  // документ покажет значения по умолчанию вместо настоящих.
  applyUpdates(sql, rows);
  return rows;
}

/** Догоняет простые `UPDATE exercises SET <col> = <val> WHERE slug IN (...)` из seed. */
function applyUpdates(sql, rows) {
  const bySlug = new Map(rows.map((r) => [r.slug, r]));
  const re =
    /UPDATE exercises SET (\w+) = ([^\n]*?)\s*\n?\s*WHERE (?:type = '(\w+)'\s*\n?\s*OR )?slug IN \(([\s\S]*?)\)/g;
  let m;
  while ((m = re.exec(sql))) {
    const [, col, rawValue, byType, slugList] = m;
    const v = value(rawValue.replace(/,$/, ""));
    const slugs = [...slugList.matchAll(/'([a-z0-9-]+)'/g)].map((x) => x[1]);
    for (const slug of slugs) {
      const row = bySlug.get(slug);
      if (row) row[col] = v;
    }
    if (byType) for (const row of rows) if (row.type === byType) row[col] = v;
  }
}

/* ------------------------------- словари --------------------------------- */

export const JOINT = {
  spine: "позвоночник",
  shoulder: "плечевой пояс",
  neck: "шейный отдел",
  legs: "ноги",
  hips: "тазобедренные суставы",
  core: "мышцы корпуса",
  full_body: "всё тело",
};

export const LEVEL = { beginner: "начальный", intermediate: "средний", advanced: "продвинутый" };

export const CONTRA = {
  high_blood_pressure: "повышенное артериальное давление",
  shoulder_pain: "боль в плечевом суставе",
  knee_pain: "боль в коленном суставе",
  acute_back_pain: "острая боль в спине",
  acute_neck_pain: "острая боль в шее",
};

export const SIDE_EFFECT = {
  dizziness: "головокружение",
  pressure_up: "подъём давления",
  headache: "головная боль",
  cramp: "судорога",
  joint_pain: "боль в суставе",
  nausea: "тошнота",
  just_hard: "тяжело",
};

export const ACTION = {
  stop: "прекратить упражнение",
  reduce_intensity: "снизить нагрузку",
  skip_exercise: "исключить упражнение",
  skip_joint: "исключить зону",
};

export const POSITION = {
  any: "любое",
  standing: "стоя",
  standing_free: "стоя без опоры",
  sitting: "сидя на стуле",
  sitting_floor: "сидя на полу",
  kneeling: "на коленях",
  quadruped: "на четвереньках",
  supine: "лёжа на спине",
  prone: "лёжа на животе",
  side: "лёжа на боку",
};

export const EQUIPMENT = { none: null, pullup_bar: "турник", dip_bars: "брусья" };

export const MODE = {
  behtereva: "реабилитация",
  general: "общая форма",
  both: "обе программы",
};

export const TYPE_TITLES = {
  breathing: "ДЫХАТЕЛЬНЫЕ",
  warmup: "РАЗМИНКА",
  massage: "САМОМАССАЖ",
  main: "ОСНОВНЫЕ",
  stretch: "РАСТЯЖКА",
};

/** Дозировка одной строкой. */
export function dose(e) {
  if (e.duration_sec) return `${e.duration_sec} сек`;
  if (e.repetitions) return `${e.repetitions} повт.`;
  return "—";
}

export function contraList(e) {
  return (e.contraindications ?? []).map((c) => CONTRA[c] ?? c);
}

export function effectList(e) {
  return (e.side_effects ?? []).map((s) => `${SIDE_EFFECT[s.trigger] ?? s.trigger} → ${ACTION[s.action] ?? s.action}`);
}

/**
 * Точечный вопрос врачу по конкретному упражнению.
 *
 * Спрашиваем только там, где у приложения нет способа решить самому:
 * изометрия и вытяжение висом — вопросы допустимости, пустые
 * противопоказания у нагрузочного упражнения — вопрос полноты,
 * «продвинутый» уровень — вопрос уместности дома.
 */
export function doctorQuestion(e) {
  if (e.slug.includes("-iso-") || e.slug.endsWith("-quad-set")) {
    return "Допустима ли изометрия при активном воспалении? Не исключать ли её совсем при повышенном АД?";
  }
  if (e.equipment === "pullup_bar" && e.type === "stretch") {
    return "Допустимо ли вытяжение висом? Сейчас упражнение доступно только в программе общей формы.";
  }
  if (e.gentle && e.slug.startsWith("neck-micro")) {
    return "Достаточна ли амплитуда 10-15 градусов в период обострения?";
  }
  if (contraList(e).length === 0 && e.type === "main") {
    return "Противопоказания не отмечены — так и должно быть?";
  }
  if (e.level === "advanced") {
    return "Уровень «продвинутый» для домашних занятий без наблюдения — оставить?";
  }
  return null;
}

/** Пять общих вопросов, которые идут в конце документа. */
export const GENERAL_QUESTIONS = [
  {
    title: "Изометрические упражнения",
    text:
      "Глава «Щадящие»: изометрия шеи вперёд, вбок и на поворот, изометрия плеча у стены, " +
      "прижатие спины к стулу, напряжение бедра сидя. Приложение предлагает их зонам с " +
      "ограниченной подвижностью; дозировка — треть усилия, 5 секунд, дыхание не задерживается. " +
      "Допустимо ли это при активном воспалении? Не нужно ли исключать изометрию при повышенном " +
      "артериальном давлении полностью — сейчас она лишь помечена противопоказанием.",
  },
  {
    title: "Амплитуда при обострении",
    text:
      "Приложение в обострение не убирает зону из программы, а даёт ей микроамплитудные " +
      "упражнения: ограничение считается поводом мягко развивать зону, а не забрасывать её. " +
      "Правильный ли это подход?",
  },
  {
    title: "Вытяжение позвоночника висом",
    text:
      "Мёртвый вис и вис для осанки (глава «Турник и брусья»). Сейчас они доступны только в " +
      "программе общей формы и при анкилозирующем спондилите не предлагаются ни при каких " +
      "ответах анкеты. Верно ли такое разделение?",
  },
  {
    title: "Дозировка",
    text:
      "Разумны ли указанные длительности и число повторений для домашних ежедневных занятий? " +
      "Что стоит уменьшить, что можно увеличить?",
  },
  {
    title: "Чего не хватает",
    text:
      "Какие упражнения следует добавить, чтобы домашняя программа была полноценной? " +
      "И наоборот — что убрать.",
  },
];
