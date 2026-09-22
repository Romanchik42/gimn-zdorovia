// Собирает supabase/apply_all.sql из миграций и seed — для ручного применения
// на пустую БД одним файлом (Supabase → SQL Editor). Источник правды — исходники.
//
// С аргументом --from=NNNN собирает вдобавок supabase/apply_from_NNNN.sql:
// только миграции от NNNN и дальше плюс весь seed. Нужно потому, что
// apply_all.sql вырос до ~152 КиБ, а вставка в SQL Editor обрывается около
// 132 КиБ — и Postgres сообщает об «unterminated quoted string» на том месте,
// где оборвало, хотя файл целый. Seed прикладывается полностью: он
// идемпотентен (ON CONFLICT DO NOTHING плюс UPDATE по slug) и трогает только
// справочники — exercises, meals, workout_sequences, side_effect_rules.
// Данных пользователей в нём нет, повторный прогон их не заденет.
//
// Запуск: node scripts/build-apply-all.mjs [--from=0017]
import fs from "node:fs";
import path from "node:path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const last = files.at(-1).slice(0, 4);
const norm = (s) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");
const seed = () => norm(fs.readFileSync("supabase/seed.sql", "utf8"));
const migration = (f) => `\n-- >>> ${f}\n${norm(fs.readFileSync(path.join(dir, f), "utf8"))}\n`;
const tail = `\n-- >>> seed.sql\n${seed()}\n\n-- Чтобы API сразу увидел новые таблицы:\nNOTIFY pgrst, 'reload schema';\n`;
const kib = (s) => (Buffer.byteLength(s, "utf8") / 1024).toFixed(1);

let all = `-- ============================================================================
-- ВСЁ ОДНИМ ФАЙЛОМ: миграции 0001-${last} + seed + перезагрузка схемы PostgREST.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
-- Применять ОДИН раз на пустую БД: Supabase → SQL Editor → вставить → Run.
--
-- ВНИМАНИЕ: файл больше 132 КиБ, а вставка в SQL Editor на этом размере
-- обрывается. Для базы, где миграции уже применялись, берите
-- apply_from_NNNN.sql — он маленький (node scripts/build-apply-all.mjs --from=NNNN).
-- ============================================================================
`;
for (const f of files) all += migration(f);
all += tail;
fs.writeFileSync("supabase/apply_all.sql", all);
console.log(`apply_all.sql: ${files.length} миграций + seed, ${kib(all)} КиБ`);

const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice("--from=".length);
if (fromArg) {
  const from = fromArg.padStart(4, "0");
  const rest = files.filter((f) => f.slice(0, 4) >= from);
  if (rest.length === 0) throw new Error(`нет миграций от ${from} и дальше`);

  let part = `-- ============================================================================
-- ДОБАВКА К УЖЕ ПРИМЕНЁННОЙ БАЗЕ: миграции ${from}-${last} + seed.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
--
-- Когда брать этот файл, а не apply_all.sql: база уже живёт, миграции до
-- ${from} в ней есть. Повторный прогон безопасен — миграции написаны
-- идемпотентно (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS), seed тоже.
--
-- Supabase → SQL Editor → вставить → Run.
-- ============================================================================
`;
  for (const f of rest) part += migration(f);

  // Без seed — на случай, если и 100 КиБ не проходят вставкой: тогда seed
  // применяется вторым заходом отдельным файлом (supabase/seed.sql).
  const noSeed = process.argv.includes("--no-seed");
  part += noSeed
    ? `\n-- Дальше отдельным заходом: вставить supabase/seed.sql целиком.\nNOTIFY pgrst, 'reload schema';\n`
    : tail;

  const out = `supabase/apply_from_${from}${noSeed ? "_migrations" : ""}.sql`;
  fs.writeFileSync(out, part);
  console.log(
    `${path.basename(out)}: ${rest.length} миграций (${rest.map((f) => f.slice(0, 4)).join(", ")})${noSeed ? ", без seed" : " + seed"}, ${kib(part)} КиБ`,
  );
}
