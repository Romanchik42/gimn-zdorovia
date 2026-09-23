// Ярлык приложения: белая фигура на брендовом Sage (SPEC 7.4).
//
// Фигура — «exercise-yoga» из Health Icons (https://healthicons.org, лицензия
// CC0: авторы отказались от всех прав, атрибуция не требуется). Спокойная поза
// отвечает концепции SPEC 7.1: движение, восстановление, спокойствие.
// Это временный ярлык: когда будет авторский логотип — заменить GLYPH и
// перезапустить скрипт (node scripts/generate-icons.mjs).
import fs from "node:fs";
import sharp from "sharp";

const SAGE = "#7C9885";
const TEXT = "#2D3E33";

// Пути глифа в системе 48×48 (Health Icons, filled/people/exercise-yoga).
const GLYPH = [
  "M29 10C29 12.7614 26.7614 15 24 15C21.2386 15 19 12.7614 19 10C19 7.23858 21.2386 5 24 5C26.7614 5 29 7.23858 29 10Z",
  "M31 43C31 43.5523 30.5523 44 30 44H12.8559C11.2786 44 10 42.7214 10 41.1441C10 40.1566 10.5102 39.2392 11.349 38.7182L16.6329 35.4363C17.5141 34.8889 18.05 33.9252 18.05 32.8878V32H20.424C21.4849 32 22.5023 31.5786 23.2524 30.8284L24 30.0809L24.7475 30.8284C25.4977 31.5786 26.5151 32 27.576 32H30V32.8915C30 33.9259 30.5329 34.8873 31.41 35.4355L36.6556 38.714C37.4919 39.2367 38 40.1534 38 41.1396C38 42.7194 36.7194 44 35.1396 44H32.8293C32.9398 43.6872 33 43.3506 33 43V42.7503C33 41.2472 31.8876 39.9761 30.3978 39.7767L17.1826 38.0088C16.6352 37.9356 16.1321 38.32 16.0588 38.8674C15.9856 39.4148 16.37 39.9179 16.9174 39.9912L30.1326 41.7591C30.6292 41.8255 31 42.2492 31 42.7503V43Z",
  "M26.1617 29.4142L25 28.2525V24.51C25.1481 24.5956 25.2875 24.7017 25.4142 24.8284L27.2929 26.7071C27.4804 26.8946 27.7348 27 28 27H31C31.3466 27 31.6684 26.8205 31.8506 26.5257C32.0328 26.2309 32.0494 25.8628 31.8944 25.5528L30.8944 23.5528C30.6474 23.0588 30.0467 22.8586 29.5528 23.1056C29.0588 23.3526 28.8586 23.9532 29.1056 24.4472L29.3819 25H28.4142L26.8284 23.4142C25.2663 21.8521 22.7336 21.8521 21.1716 23.4142L19.5858 25H18.618L18.8944 24.4472C19.1414 23.9532 18.9412 23.3526 18.4472 23.1056C17.9532 22.8586 17.3525 23.0588 17.1056 23.5528L16.1056 25.5528C15.9506 25.8628 15.9671 26.2309 16.1493 26.5257C16.3315 26.8205 16.6534 27 17 27H20C20.2652 27 20.5195 26.8946 20.7071 26.7071L22.5858 24.8284C22.7125 24.7017 22.8519 24.5956 23 24.51V28.2525L21.8382 29.4142C21.4631 29.7893 20.9544 30 20.424 30H14.3855C12.9788 30 12.0116 28.5862 12.5215 27.2751L15.5256 19.5502C16.1235 18.0127 17.604 17 19.2536 17H28.7463C30.396 17 31.8764 18.0127 32.4743 19.5502L35.4785 27.2751C35.9883 28.5862 35.0212 30 33.6144 30H27.576C27.0455 30 26.5368 29.7893 26.1617 29.4142Z",
];

/**
 * Знак size×size: фон и фигура. scale — доля стороны под фигуру
 * (maskable-иконке нужен запас: Android обрезает до круга ~80%).
 */
function mark({ size = 64, radius = 16, scale = 0.72, bg = SAGE, fg = "#FFFFFF" } = {}) {
  const k = (size * scale) / 48;
  const offset = (size - 48 * k) / 2;
  const paths = GLYPH.map((d) => `<path d="${d}" fill="${fg}"/>`).join("");
  return `<rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/><g transform="translate(${offset} ${offset}) scale(${k})">${paths}</g>`;
}

const svg = (w, h, body, label = "Гимн.здоровья") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">${body}</svg>\n`;

const header = "<!-- Ярлык: фигура Health Icons (CC0). Генерируется scripts/generate-icons.mjs -->\n";

// Векторные: знак, полный логотип (знак + название), одноцветный.
fs.writeFileSync("public/logo/logo-mark.svg", header + svg(64, 64, mark()));
fs.writeFileSync(
  "public/logo/logo-full.svg",
  header +
    svg(
      280,
      64,
      `${mark()}<text x="80" y="41" font-family="Inter, 'Segoe UI', Arial, sans-serif" font-size="26" font-weight="600" fill="${TEXT}">Гимн.здоровья</text>`,
    ),
);
fs.writeFileSync("public/logo/logo-mono.svg", header + svg(64, 64, mark({ bg: "none", fg: "currentColor", scale: 0.9 })));

const png = (size, opts, file) =>
  sharp(Buffer.from(svg(size, size, mark({ size, ...opts }))), { density: 300 })
    .resize(size, size)
    .png({ compressionLevel: 9, palette: true })
    .toFile(file);

await png(192, { radius: 42 }, "public/icons/icon-192.png");
await png(512, { radius: 112 }, "public/icons/icon-512.png");
// Maskable: фон во весь квадрат, фигура в безопасной зоне.
await png(512, { radius: 0, scale: 0.56 }, "public/icons/icon-maskable-512.png");
// iOS скругляет сам — отдаём квадрат.
await png(180, { radius: 0, scale: 0.66 }, "public/icons/apple-touch-icon.png");

// favicon.ico: PNG внутри ICO (поддерживается всеми современными браузерами).
const fav = await sharp(Buffer.from(svg(32, 32, mark({ size: 32, radius: 7, scale: 0.8 }))), { density: 300 })
  .resize(32, 32)
  .png()
  .toBuffer();
const ico = Buffer.alloc(22);
ico.writeUInt16LE(0, 0);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico.writeUInt8(32, 6);
ico.writeUInt8(32, 7);
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(fav.length, 14);
ico.writeUInt32LE(22, 18);
fs.writeFileSync("src/app/favicon.ico", Buffer.concat([ico, fav]));


// Превью для соцсетей и Telegram (1200×630). Раньше картинка лежала готовой
// и несла на себе букву «Г» — заглушку, оставшуюся с тех пор, когда знака ещё
// не было. Теперь собирается здесь же, из той же фигуры, что и все ярлыки:
// иначе «Г» рано или поздно снова разойдётся с логотипом (GIMN-026).
const MUTED = "#6B7A6F";
const SAND = "#C8A87C";
const BG = "#FAFAF7";
const FONT = "Inter, 'Segoe UI', 'DejaVu Sans', Arial, sans-serif";

const ogBody = [
  `<rect width="1200" height="630" fill="${BG}"/>`,
  `<g transform="translate(96 215)">${mark({ size: 200, radius: 44, scale: 0.68 })}</g>`,
  `<text x="352" y="286" font-family="${FONT}" font-size="76" font-weight="700" fill="${TEXT}">Гимн.здоровья</text>`,
  `<text x="356" y="342" font-family="${FONT}" font-size="34" fill="${MUTED}">гимнастика для здоровья</text>`,
  `<rect x="352" y="390" width="700" height="66" rx="33" fill="${SAGE}"/>`,
  `<text x="384" y="431" font-family="${FONT}" font-size="26" fill="#FFFFFF">При болезни Бехтерева и для формы · 30 минут в день</text>`,
  `<rect x="0" y="616" width="840" height="14" fill="${SAGE}"/>`,
  `<rect x="840" y="616" width="360" height="14" fill="${SAND}"/>`,
].join("");

await sharp(Buffer.from(svg(1200, 630, ogBody)), { density: 300 })
  .png({ compressionLevel: 9 })
  .toFile("public/marketing/og-image.png");

for (const f of [
  "public/logo/logo-mark.svg",
  "public/icons/icon-192.png",
  "public/icons/icon-512.png",
  "public/icons/icon-maskable-512.png",
  "public/icons/apple-touch-icon.png",
  "src/app/favicon.ico",
  "public/marketing/og-image.png",
]) {
  console.log(f.padEnd(40), fs.statSync(f).size, "B");
}
