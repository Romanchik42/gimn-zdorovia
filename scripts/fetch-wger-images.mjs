/**
 * Картинки упражнений с wger (GIMN-015).
 *
 * wger.de — открытая база тренировок, её картинки лежат под Creative Commons
 * (CC BY-SA 3.0 и 4.0) и доступны через публичный API без ключа. Берём ТОЛЬКО
 * те, где движение совпадает с нашей техникой: список ниже составлен вручную,
 * каждый файл отсмотрен глазами. Остальным упражнениям рисуем схему движения
 * (src/components/exercise/exercise-scheme.tsx) — лучше схема, чем картинка,
 * на которой человек делает другое.
 *
 * Лицензия требует атрибуции: автор и ссылка на файл записаны здесь же и
 * попадают в exercises.image_credit и в docs/IMAGE_SOURCES.md.
 *
 * Запуск: node scripts/fetch-wger-images.mjs
 */
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "exercises");

/**
 * Отобранные вручную: наше упражнение → картинка wger.
 *
 * `crop` — доля кадра, которую отрезаем сверху: у одной серии поверх картинки
 * стоят испанские подписи «Inicio / Movimiento», сами кадры под ними в порядке.
 * Обрезка — переработка по смыслу CC BY-SA, она разрешена при той же лицензии.
 */
const PICKED = [
  // Турник и брусья (GIMN-014) — до этого у всех 15 были только схемы.
  { slug: "bar-pullup-overhand", name: "Pull-ups", author: "Imobard", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg" },
  { slug: "bar-pullup-underhand", name: "Chin Up", author: "Everkinetic", license: "CC BY-SA 3.0",
    url: "https://wger.de/media/exercise-images/152/b2c5a9f9-8beb-41f7-841c-9664d22a427e.png" },
  { slug: "dip-pushup", name: "Dips", author: "cshep442", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/194/34600351-8b0b-4cb0-8daa-583537be15b0.png" },
  { slug: "bar-australian-row", name: "Inverted Rows", author: "Gavru", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/1198/864906ac-4ac7-4e52-a886-c6bb97950a9f.jpg" },
  { slug: "bar-knee-raise", name: "Knee Raises", author: "wger", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/978/d3ffe51f-7eb8-4cc9-9eae-105847af3005.png" },
  { slug: "bar-leg-raise", name: "Leg raises pull up bar", author: "wger", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/979/27097a3a-5749-428d-b94c-6082afe390f6.png" },
  // Упражнения, у которых картинки не было — только схема.
  { slug: "main-bird-dog", name: "Quadriped Arm and Leg Raise", author: "utkb", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/957/0fd94587-6021-4763-856e-7227f5fcba2a.png" },
  { slug: "gen-jumping-jacks", name: "Jumping Jacks", author: "wger", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/320/6c9124b6-3551-47a8-9c22-20141c8b9c53.png" },
  { slug: "warmup-neck-tilts", name: "Head tilts", author: "wger", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/1018/5bbd3879-b6fc-4aaa-9e8e-33ae9a688112.png" },
  { slug: "warmup-neck-turns", name: "Head turns", author: "wger", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/1007/757846d3-78e4-4068-bbca-62e567372c94.png" },
  { slug: "main-hip-flexor-stretch", name: "Hip Flexor Stretch", author: "Davidgj32", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/1867/767631e5-10d2-46b8-b03f-cc298f96963b.png" },
  { slug: "stretch-piriformis", name: "Lying Figure Four Stretch", author: "Davidgj32", license: "CC BY-SA 4.0",
    url: "https://wger.de/media/exercise-images/1869/c49187bd-9f90-4a7a-b25e-1d50e857a104.png" },
  // Одна картинка на два упражнения: ягодичный мостик есть в обоих режимах,
  // а image_url собирается из slug — значит, и файла нужно два.
  { slug: "main-bridge", name: "Glute Bridge", author: "wger", license: "CC BY-SA 4.0", cropTop: 0.175,
    url: "https://wger.de/media/exercise-images/265/7528acb4-b2cc-4b75-b6ae-d514cbd4f78b.png" },
  { slug: "gen-glute-bridge", name: "Glute Bridge", author: "wger", license: "CC BY-SA 4.0", cropTop: 0.175,
    url: "https://wger.de/media/exercise-images/265/7528acb4-b2cc-4b75-b6ae-d514cbd4f78b.png" },
];

const MAX_WIDTH = 900;

async function retry(fn, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise((r) => setTimeout(r, 400 * i));
    }
  }
}

mkdirSync(OUT, { recursive: true });

let saved = 0;
for (const item of PICKED) {
  const bytes = await retry(async () => {
    const res = await fetch(item.url, { headers: { "User-Agent": "gimn-zdorovia/1.0 (exercise images)" } });
    if (!res.ok) throw new Error(`${res.status} ${item.url}`);
    return Buffer.from(await res.arrayBuffer());
  });

  let img = sharp(bytes).flatten({ background: "#ffffff" });
  if (item.cropTop) {
    const meta = await sharp(bytes).metadata();
    const top = Math.round(meta.height * item.cropTop);
    img = sharp(bytes)
      .extract({ left: 0, top, width: meta.width, height: meta.height - top })
      .flatten({ background: "#ffffff" });
  }

  const out = path.join(OUT, `${item.slug}.webp`);
  await img.resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
  saved++;
  console.log(`${item.slug}.webp  ${(statSync(out).size / 1024).toFixed(1)} КБ  ← ${item.name} (${item.author})`);
}

console.log(`\nсохранено: ${saved}. Дальше: node scripts/build-exercise-thumbs.mjs`);
