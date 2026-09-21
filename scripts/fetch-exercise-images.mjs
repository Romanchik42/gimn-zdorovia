/**
 * Картинки упражнений с Pixabay (GIMN-013).
 *
 * Берём ТОЛЬКО те, где движение совпадает с нашей техникой: список ниже
 * составлен вручную, каждый файл отсмотрен глазами. Остальным упражнениям
 * рисуем схему движения (src/components/exercise/exercise-scheme.tsx) —
 * лучше схема, чем картинка, на которой человек делает другое.
 *
 * Лицензия Pixabay требует не хотлинкать: файл скачивается в
 * public/exercises/ и коммитится. Ключ живёт только в secrets/.env и нужен
 * лишь здесь — прод его не использует.
 *
 * Запуск: node scripts/fetch-exercise-images.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "exercises");

/** Отобранные вручную: id Pixabay → наше упражнение. */
const PICKED = [
  { slug: "gen-plank", id: 6573171, page: "https://pixabay.com/vectors/plank-exercise-sport-workout-man-6573171/" },
  { slug: "gen-pushup", id: 4925111, page: "https://pixabay.com/illustrations/press-up-push-up-press-up-push-up-4925111/" },
  { slug: "main-hip-abduction", id: 2180074, page: "https://pixabay.com/illustrations/exercise-side-lying-leg-raises-woman-2180074/" },
  { slug: "stretch-child-pose", id: 2959214, page: "https://pixabay.com/photos/yoga-childs-pose-asana-2959214/" },
];

/** Ключ в .env записан с лишним префиксом — берём валидную по форме часть. */
function pixabayKey() {
  const env = readFileSync(path.join(ROOT, "secrets", ".env"), "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("PIXABAY_API_KEY="));
  const raw = (line ?? "").slice("PIXABAY_API_KEY=".length).trim().replace(/^["']|["']$/g, "");
  const m = raw.match(/\d{6,}-[0-9a-zA-Z]{20,}$/);
  if (!m) throw new Error("PIXABAY_API_KEY не найден или не похож на ключ Pixabay");
  return m[0];
}

async function retry(fn, tries = 5) {
  for (let a = 1; ; a++) {
    try {
      return await fn();
    } catch (e) {
      if (a >= tries) throw e;
      await new Promise((r) => setTimeout(r, 2000 * a));
    }
  }
}

const KEY = pixabayKey();
mkdirSync(OUT, { recursive: true });

for (const { slug, id, page } of PICKED) {
  const u = new URL("https://pixabay.com/api/");
  u.searchParams.set("key", KEY);
  u.searchParams.set("id", String(id));

  const hit = await retry(async () => {
    const r = await fetch(u, { signal: AbortSignal.timeout(60000) });
    const t = await r.text();
    if (!t.startsWith("{")) throw new Error(`${r.status} ${t.slice(0, 80)}`);
    const j = JSON.parse(t);
    if (!j.hits?.length) throw new Error(`id ${id} не найден`);
    return j.hits[0];
  });

  const raw = await retry(async () => {
    const r = await fetch(hit.largeImageURL, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error(`картинка: HTTP ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  });

  // WebP 800px по длинной стороне: лимит 150 КБ с запасом, качество хватает.
  const file = path.join(OUT, `${slug}.webp`);
  const out = await sharp(raw)
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  writeFileSync(file, out);

  const kb = statSync(file).size / 1024;
  console.log(`${slug}.webp  ${kb.toFixed(1)} КБ  автор ${hit.user}  ${page}${kb >= 150 ? "  ← ПРЕВЫШЕН ЛИМИТ 150 КБ" : ""}`);

  await new Promise((r) => setTimeout(r, 1200)); // лимит 100 запросов в минуту
}
