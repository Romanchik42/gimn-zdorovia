/**
 * Маленькие превью картинок упражнений (GIMN-013).
 *
 * В каталоге значок движения занимает 48 пикселей, а исходники тяжёлые:
 * одна анимация дыхания весит 417 КБ. Тянуть её ради значка — это лишние
 * полминуты на медленной связи, поэтому рядом кладём статичное превью
 * <slug>-thumb.webp. Полная картинка остаётся в карточке упражнения.
 *
 * Первый кадр гифки берётся как есть: у наших анимаций он показывает
 * исходное положение, по нему упражнение узнаётся.
 *
 * Запуск: node scripts/build-exercise-thumbs.mjs
 */
import { readdirSync, writeFileSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.resolve(import.meta.dirname, "..", "public", "exercises");
const SIZE = 96;

const files = readdirSync(DIR).filter(
  (f) => /\.(gif|webp|png|jpg)$/i.test(f) && !f.endsWith("-thumb.webp"),
);

let total = 0;
for (const file of files) {
  const base = file.replace(/\.[^.]+$/, "");
  const out = path.join(DIR, `${base}-thumb.webp`);

  const buf = await sharp(readFileSync(path.join(DIR, file)))
    .resize({ width: SIZE, height: SIZE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  writeFileSync(out, buf);
  const kb = statSync(out).size / 1024;
  const wasKb = statSync(path.join(DIR, file)).size / 1024;
  total += kb;
  console.log(`${base}-thumb.webp  ${kb.toFixed(1)} КБ  (было ${wasKb.toFixed(0)} КБ)`);
}
console.log(`\nвсего превью: ${files.length}, суммарно ${total.toFixed(1)} КБ`);
