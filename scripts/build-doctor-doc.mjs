/**
 * Документ для ревматолога: весь справочник упражнений в читаемом виде.
 *
 * Собирается из supabase/seed.sql, а не из живой базы: seed — источник, из
 * которого база и наполняется, и он есть у любого, кто открыл репозиторий.
 * Значит, документ нельзя случайно собрать по устаревшему слепку.
 *
 * Запуск: node scripts/build-doctor-doc.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SEED = path.join(ROOT, "supabase", "seed.sql");
const OUT = path.join(ROOT, "DOC_REVMATOLOG_FULL_gimn_zdorovia.md");

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

function parseExercises(sql) {
  const rows = [];
  const re = /INSERT INTO exercises \(([^)]*)\) VALUES([\s\S]*?)ON CONFLICT/g;
  let m;
  while ((m = re.exec(sql))) {
    const cols = m[1].split(",").map((c) => c.trim());
    for (const chunk of splitValues(stripComments(m[2]))) {
      const values = splitRow(chunk);
      if (values.length !== cols.length) {
        throw new Error(`строка на ${values.length} значений при ${cols.length} колонках: ${values[0]}`);
      }
      rows.push(Object.fromEntries(cols.map((c, i) => [c, value(values[i])])));
    }
  }
  return rows;
}

/* ------------------------------- словари --------------------------------- */

const JOINT = {
  spine: "позвоночник",
  shoulder: "плечевой пояс",
  neck: "шейный отдел",
  legs: "ноги",
  hips: "тазобедренные суставы",
  core: "мышцы корпуса",
  full_body: "всё тело",
};

const LEVEL = { beginner: "начальный", intermediate: "средний", advanced: "продвинутый" };

const CONTRA = {
  high_blood_pressure: "повышенное артериальное давление",
  shoulder_pain: "боль в плечевом суставе",
  knee_pain: "боль в коленном суставе",
  acute_back_pain: "острая боль в спине",
  acute_neck_pain: "острая боль в шее",
};

const SIDE_EFFECT = {
  dizziness: "головокружение",
  pressure_up: "подъём давления",
  headache: "головная боль",
  cramp: "судорога",
  joint_pain: "боль в суставе",
  nausea: "тошнота",
  just_hard: "тяжело",
};

const ACTION = {
  stop: "прекратить упражнение",
  reduce_intensity: "снизить нагрузку",
};

const POSITION = {
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

const EQUIPMENT = { none: null, pullup_bar: "турник", dip_bars: "брусья" };

const MODE = {
  behtereva: "реабилитация Бехтерева",
  general: "общая форма",
  both: "обе программы",
};

function dose(e) {
  if (e.duration_sec) return `${e.duration_sec} сек`;
  if (e.repetitions) return `${e.repetitions} повторений`;
  return "—";
}

function render(e, index) {
  const lines = [];
  const gentle = e.gentle ? " **[ЩАДЯЩЕЕ]**" : "";
  lines.push(`#### ${index}. ${e.name}${gentle}`);
  lines.push("");
  const kit = EQUIPMENT[e.equipment ?? "none"];
  lines.push(
    `**Программа:** ${MODE[e.mode] ?? e.mode} · **Зона:** ${JOINT[e.target_joint] ?? e.target_joint} · **Дозировка:** ${dose(e)}`,
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
  const contra = (e.contraindications ?? []).map((c) => CONTRA[c] ?? c);
  lines.push(
    contra.length
      ? `**Противопоказания:** ${contra.join("; ")}.`
      : "**Противопоказания:** в справочнике не отмечены.",
  );
  lines.push("");
  const effects = (e.side_effects ?? []).map((s) => `${SIDE_EFFECT[s.trigger] ?? s.trigger} → ${ACTION[s.action] ?? s.action}`);
  if (effects.length) {
    lines.push(`**Реакция приложения на жалобу:** ${effects.join("; ")}.`);
    lines.push("");
  }
  return lines.join("\n");
}

/* -------------------------------- сборка --------------------------------- */

const all = parseExercises(readFileSync(SEED, "utf8"));
const bar = all.filter((e) => (e.equipment ?? "none") !== "none");
const core = all.filter((e) => (e.equipment ?? "none") === "none");

// Щадящие идут отдельной главой, поэтому из своих типов их вынимаем.
const gentle = core.filter((e) => e.gentle);
const plain = core.filter((e) => !e.gentle);
const byType = (t) => plain.filter((e) => e.type === t);

const CHAPTERS = [
  ["ДЫХАТЕЛЬНЫЕ", byType("breathing"), "Задают ритм занятия и работают с подвижностью рёберно-позвоночных суставов."],
  ["РАЗМИНКА", byType("warmup"), "Разогрев перед основной частью, малая амплитуда."],
  ["САМОМАССАЖ", byType("massage"), "Снятие мышечного напряжения; входит в разминочную часть."],
  ["ОСНОВНЫЕ", byType("main"), "Основная часть занятия: подвижность, осанка, силовая выносливость."],
  ["РАСТЯЖКА", byType("stretch"), "Завершение занятия, удержание без пружинящих движений."],
  ["ЩАДЯЩИЕ", gentle, "Микроамплитуда и изометрия. Их получают зоны, которые по углублённой диагностике почти не двигаются: ограничение — повод мягко развивать зону, а не исключать её."],
];

const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

let doc = `# Упражнения «Гимн.здоровья» — полная база

Материал для врача-ревматолога. Собран ${today} из справочника приложения
(\`supabase/seed.sql\`) скриптом \`scripts/build-doctor-doc.mjs\` — то есть
описывает ровно то, что видит пользователь, без пересказа.

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

---

## Вопросы, на которые нужен ваш ответ

1. **Изометрические упражнения** (глава «Щадящие»: изометрия шеи вперёд,
   вбок, на поворот, изометрия плеча у стены, прижатие спины к стулу,
   напряжение бедра сидя). Приложение предлагает их зонам с ограниченной
   подвижностью, дозировка — треть усилия, 5 секунд, дыхание не
   задерживается. Допустимо ли это при активном воспалении? Не нужно ли
   исключать изометрию при повышенном артериальном давлении полностью —
   сейчас она лишь помечена противопоказанием.
2. **Амплитуда при обострении.** Правильно ли, что в период обострения
   зона не исключается, а получает микроамплитудные упражнения?
3. **Вытяжение позвоночника висом** (глава «Общая форма: турник и брусья»:
   мёртвый вис, вис для осанки). Сейчас эти упражнения доступны только в
   программе общей формы и не предлагаются при болезни Бехтерева.
   Верно ли такое разделение?
4. **Дозировка.** Разумны ли указанные длительности и число повторений
   для домашних ежедневных занятий?
5. **Чего в списке не хватает** для полноценной домашней программы?

---

## Содержание

`;

const chapters = CHAPTERS.filter(([, list]) => list.length > 0);
chapters.forEach(([title, list], i) => {
  doc += `${i + 1}. [${title}](#${i + 1}-${title.toLowerCase()}) — ${list.length}\n`;
});
doc += `${chapters.length + 1}. [ОБЩАЯ ФОРМА: ТУРНИК И БРУСЬЯ](#${chapters.length + 1}-общая-форма-турник-и-брусья) — ${bar.length}\n\n`;
doc += `**Всего в справочнике: ${all.length} упражнений**, из них ${core.length} без снаряда\n(доступны в обеих программах по показаниям) и ${bar.length} на турнике и брусьях\n(только программа общей формы).\n\n---\n\n`;

chapters.forEach(([title, list, note], i) => {
  doc += `## ${i + 1}. ${title}\n\n${note}\n\nВ разделе: ${list.length}.\n\n`;
  list.forEach((e, n) => {
    doc += render(e, n + 1) + "\n";
  });
  doc += "---\n\n";
});

doc += `## ${chapters.length + 1}. ОБЩАЯ ФОРМА: ТУРНИК И БРУСЬЯ\n\n`;
doc += `Упражнения на турнике и брусьях. Доступны **только** в программе общей\nформы и только тем, кто в анкете отметил наличие снаряда. При болезни\nБехтерева не предлагаются ни при каких ответах — см. вопрос 3 выше.\n\nВ разделе: ${bar.length}.\n\n`;
bar.forEach((e, n) => {
  doc += render(e, n + 1) + "\n";
});

doc += `---\n\n**Итого: ${all.length} упражнений.**\n\nДокумент пересобирается командой \`node scripts/build-doctor-doc.mjs\` —\nпосле правок в справочнике его не нужно переписывать руками.\n`;

writeFileSync(OUT, doc, "utf8");

const dupes = all.map((e) => e.slug).filter((s, i, a) => a.indexOf(s) !== i);
console.log(`${OUT}: ${all.length} упражнений (${core.length} без снаряда + ${bar.length} со снарядом)`);
chapters.forEach(([t, l]) => console.log(`  ${t}: ${l.length}`));
console.log(dupes.length ? `ДУБЛИ: ${dupes.join(", ")}` : "  дублей нет");
const noTech = all.filter((e) => !e.technique || String(e.technique).trim().length < 20);
console.log(noTech.length ? `БЕЗ ТЕХНИКИ: ${noTech.map((e) => e.slug).join(", ")}` : "  техника описана у всех");
