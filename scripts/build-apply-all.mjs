// Собирает supabase/apply_all.sql из миграций и seed — для ручного применения
// на пустую БД одним файлом (Supabase → SQL Editor). Источник правды — исходники.
import fs from "node:fs";
import path from "node:path";

const dir = "supabase/migrations";
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const last = files.at(-1).slice(0, 4);
const norm = (s) => s.replace(/\r\n/g, "\n").replace(/\s+$/, "");

let out = `-- ============================================================================
-- ВСЁ ОДНИМ ФАЙЛОМ: миграции 0001-${last} + seed + перезагрузка схемы PostgREST.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
-- Применять ОДИН раз на пустую БД: Supabase → SQL Editor → вставить → Run.
-- ============================================================================
`;
for (const f of files) out += `\n-- >>> ${f}\n${norm(fs.readFileSync(path.join(dir, f), "utf8"))}\n`;
out += `\n-- >>> seed.sql\n${norm(fs.readFileSync("supabase/seed.sql", "utf8"))}\n\n-- Чтобы API сразу увидел новые таблицы:\nNOTIFY pgrst, 'reload schema';\n`;
fs.writeFileSync("supabase/apply_all.sql", out);
console.log(`apply_all.sql: ${files.length} миграций + seed`);
