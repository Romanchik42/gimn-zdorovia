// Рисует контактный лист всех схем движения в PNG — чтобы посмотреть глазами.
// Данные берутся из src/components/exercise/exercise-scheme.tsx: там они
// описаны как простые массивы координат, типы снимаются регулярками.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.argv[2] ?? ".";
const only = process.argv[3] ?? null; // подстрока slug
const src = fs.readFileSync(path.join(root, "src/components/exercise/exercise-scheme.tsx"), "utf8");

const W = 160, H = 120, FLOOR = 112;

function grab(name) {
  const i = src.indexOf(`const ${name}`);
  if (i < 0) throw new Error(`не найдено: ${name}`);
  const start = src.indexOf("{", i);
  let depth = 0, j = start;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) break; }
  }
  let body = src.slice(start, j + 1);
  body = body.replace(/\s+as\s+Segment\[\]/g, "").replace(/\s+as\s+const/g, "");
  body = body.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  return new Function("W", "H", "FLOOR", `return (${body});`)(W, H, FLOOR);
}

// POSES/PROPS/SCHEMES ссылаются на объявленные выше константы поз — соберём их.
const figureNames = [...src.matchAll(/const ([A-Z_0-9]+): Figure = \{/g)].map((m) => m[1]);
const figures = {};
for (const n of figureNames) figures[n] = grab(n);

const posesRaw = (() => {
  const i = src.indexOf("const POSES = {");
  const start = src.indexOf("{", i);
  let depth = 0, j = start;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") { depth--; if (depth === 0) break; }
  }
  return src.slice(start + 1, j);
})();
const POSES = {};
for (const m of posesRaw.matchAll(/(\w+):\s*([A-Z_0-9]+)/g)) POSES[m[1]] = figures[m[2]];

const PROPS = grab("PROPS");
const SCHEMES = grab("SCHEMES");

const pt = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy - r * Math.sin((deg * Math.PI) / 180)];
function arcPath(cx, cy, r, a1, a2) {
  const [x1, y1] = pt(cx, cy, r, a1);
  const [x2, y2] = pt(cx, cy, r, a2);
  return `M${x1} ${y1} A${r} ${r} 0 ${Math.abs(a2 - a1) > 180 ? 1 : 0} ${a2 > a1 ? 0 : 1} ${x2} ${y2}`;
}
function arrowPath(a) {
  switch (a[0]) {
    case "line": return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: 1, tail: 0 };
    case "press": return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: 1, tail: 0, bold: 1 };
    case "hold": return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: 0, tail: 0, dashed: 1 };
    case "both": return { d: `M${a[1]} ${a[2]} L${a[3]} ${a[4]}`, head: 1, tail: 1 };
    case "arc": return { d: arcPath(a[1], a[2], a[3], a[4], a[5]), head: 1, tail: 0 };
    case "circle": return { d: arcPath(a[1], a[2], a[3], 80, -250), head: 1, tail: 0 };
  }
}

const slugs = Object.keys(SCHEMES).filter((s) => !only || s.includes(only)).sort();
const cols = 5;
const cellW = 200, cellH = 170;
const rows = Math.ceil(slugs.length / cols);

let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cellW}" height="${rows * cellH}" viewBox="0 0 ${cols * cellW} ${rows * cellH}">`;
svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;
svg += `<defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="#7C9885"/></marker></defs>`;

slugs.forEach((slug, i) => {
  const sc = SCHEMES[slug];
  const x = (i % cols) * cellW, y = Math.floor(i / cols) * cellH;
  const pose = POSES[sc.pose];
  const props = (sc.props ?? []).flatMap((p) => PROPS[p]);
  svg += `<g transform="translate(${x + 20} ${y + 10}) scale(1)">`;
  svg += `<rect x="-4" y="-4" width="168" height="128" fill="#F5F7F5" stroke="#dde"/>`;
  const inner = sc.flip ? `<g transform="translate(${W} 0) scale(-1 1)">` : `<g>`;
  svg += inner;
  svg += `<g stroke="#bbb" stroke-width="2" fill="none" stroke-linecap="round">`;
  for (const [x1, y1, x2, y2] of props) svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  svg += `</g>`;
  svg += `<g stroke="#333" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round">`;
  svg += `<circle cx="${pose.head[0]}" cy="${pose.head[1]}" r="${pose.head[2]}"/>`;
  for (const [x1, y1, x2, y2] of pose.segments) svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  svg += `</g>`;
  for (const [hx, hy] of sc.hands ?? [])
    svg += `<rect x="${hx - 3}" y="${hy - 5}" width="6" height="10" rx="3" fill="none" stroke="#333" stroke-width="2.6"/>`;
  svg += `<g stroke="#7C9885" fill="none" stroke-linecap="round">`;
  for (const a of sc.arrows) {
    const { d, head, tail, bold, dashed } = arrowPath(a);
    svg += `<path d="${d}" stroke-width="${bold ? 4 : 3}"${dashed ? ' stroke-dasharray="5 4"' : ""}${head ? ' marker-end="url(#ah)"' : ""}${tail ? ' marker-start="url(#ah)"' : ""}/>`;
  }
  svg += `</g></g>`;
  svg += `<text x="0" y="140" font-family="sans-serif" font-size="11" fill="#333">${slug}</text>`;
  svg += `</g>`;
});
svg += `</svg>`;

const out = process.argv[4] ?? "schemes.png";
await sharp(Buffer.from(svg)).png().toFile(out);
console.log(`${slugs.length} схем → ${out}`);
