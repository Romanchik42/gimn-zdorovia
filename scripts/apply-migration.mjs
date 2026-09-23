/**
 * Применение миграции к базе напрямую (GIMN-027).
 *
 * Supabase SQL Editor — ручной путь, и для каждой миграции он означает
 * копипаст. Здесь то же самое, но из терминала: строка подключения берётся
 * из secrets/.env, файл прогоняется одной транзакцией.
 *
 * Секреты в вывод не попадают: печатается только имя файла и результат.
 *
 * Запуск: node scripts/apply-migration.mjs supabase/migrations/0020_....sql
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readEnvFile(file) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const env = { ...readEnvFile(path.join(ROOT, "secrets", ".env")), ...process.env };
const url = env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL не задан — ни в secrets/.env, ни в окружении.");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Укажите файл миграции: node scripts/apply-migration.mjs <путь.sql>");
  process.exit(1);
}

const sql = readFileSync(path.resolve(ROOT, file), "utf8");

// Supabase требует TLS, а сертификат у него за прокси — проверку цепочки
// отключаем осознанно: адрес хоста берётся из нашего же секрета.
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log(`✓ применено: ${path.basename(file)}`);
} catch (e) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // соединение могло не открыться — откатывать нечего
  }
  // Сообщение драйвера не содержит строки подключения, только текст ошибки SQL.
  console.error(`✗ не применено: ${path.basename(file)}\n  ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
