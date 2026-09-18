/**
 * Генератор звуковых наборов (SPEC 5.6): 3 набора × 5 событий → public/sounds/<набор>/<событие>.mp3
 *
 * Звуки синтезируются кодом, а не скачиваются: это собственная работа, без
 * вопросов лицензии и атрибуции. Роман может заменить любой файл на свой —
 * имена и пути менять не нужно.
 *
 * Требования SPEC 5.6: моно, файл < 30 КБ, громкость набора выровнена к −12 dBFS.
 * Битрейт 96 kbps вместо 128: при 128 двухсекундный «complete» весит ~32 КБ
 * и не проходит лимит 30 КБ.
 *
 * Запуск: node scripts/generate-sounds.mjs
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import lamejs from "@breezystack/lamejs";

const RATE = 44100;
const KBPS = 96;
const PEAK = 0.251; // −12 dBFS

/* ------------------------------ примитивы ------------------------------ */

const buf = (sec) => new Float32Array(Math.round(sec * RATE));

/** Тон с экспоненциальным затуханием и мягкой атакой (без щелчка в начале). */
function tone(out, { at = 0, freq, dur, amp = 1, attack = 0.006, decay = 6, wave = "sine", bend = 0 }) {
  const start = Math.round(at * RATE);
  const n = Math.round(dur * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const f = freq * Math.pow(2, (bend * t) / dur / 12); // bend — в полутонах за всю длительность
    phase += (2 * Math.PI * f) / RATE;
    let s;
    if (wave === "triangle") s = (2 / Math.PI) * Math.asin(Math.sin(phase));
    else if (wave === "square") s = Math.tanh(Math.sin(phase) * 4) * 0.6;
    else s = Math.sin(phase);
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    // короткое затухание в конце, чтобы хвост не обрывался щелчком
    const tail = Math.min(1, (n - i) / (RATE * 0.01));
    out[start + i] += s * env * tail * amp;
  }
}

/** «Колокольчик»: основной тон + негармонический обертон, как у металла. */
function bell(out, opts) {
  tone(out, opts);
  tone(out, { ...opts, freq: opts.freq * 2.76, amp: (opts.amp ?? 1) * 0.18, decay: (opts.decay ?? 6) * 2.2 });
}

/** Сухой щелчок: короткая вспышка шума через полосовой фильтр + крошечный пинг. */
function click(out, { at = 0, freq = 2400, amp = 1, len = 0.012 }) {
  const start = Math.round(at * RATE);
  const n = Math.round(len * RATE);
  let lp = 0;
  let hp = 0;
  let seed = 12345 + Math.round(freq);
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const x = rnd();
    lp += 0.35 * (x - lp);
    hp = lp - hp * 0.2;
    out[start + i] += hp * Math.exp(-t * 400) * amp;
  }
  tone(out, { at, freq, dur: 0.06, amp: amp * 0.5, attack: 0.0005, decay: 90 });
}

/** Однополюсный низкочастотный фильтр — «теплее», как под водой. */
function lowpass(x, cutoff) {
  const a = 1 - Math.exp((-2 * Math.PI * cutoff) / RATE);
  let y = 0;
  for (let i = 0; i < x.length; i++) {
    y += a * (x[i] - y);
    x[i] = y;
  }
  return x;
}

function normalize(x) {
  let peak = 0;
  for (const v of x) {
    // NaN/Infinity в синтезе дали бы тишину или треск — лучше упасть сразу.
    if (!Number.isFinite(v)) throw new Error("синтез выдал нечисловой отсчёт");
    peak = Math.max(peak, Math.abs(v));
  }
  if (peak < 1e-4) throw new Error("синтез выдал тишину");
  if (peak > 0) for (let i = 0; i < x.length; i++) x[i] = (x[i] / peak) * PEAK;
  return x;
}

/* ------------------------------- наборы -------------------------------- */

const NOTE = { G4: 392, A4: 440, C5: 523.25, E5: 659.25, G5: 783.99, A5: 880, C6: 1046.5, E6: 1318.5, A6: 1760 };

const PACKS = {
  soft: {
    done: () =>
      lowpass(
        mix(0.45, (o) => {
          bell(o, { freq: NOTE.G5, dur: 0.3, decay: 9 });
          bell(o, { at: 0.09, freq: NOTE.C6, dur: 0.36, decay: 8, amp: 0.9 });
        }),
        2600,
      ),
    difficult: () => lowpass(mix(0.55, (o) => tone(o, { freq: NOTE.A4, dur: 0.55, decay: 5, attack: 0.03, bend: -2 })), 1400),
    skip: () => lowpass(mix(0.22, (o) => tone(o, { freq: 1200, dur: 0.22, decay: 22, attack: 0.002 })), 3000),
    complete: () =>
      lowpass(
        mix(1.9, (o) => {
          [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => bell(o, { at: i * 0.12, freq: f, dur: 1.9 - i * 0.12, decay: 2.2, amp: 0.8 }));
        }),
        2400,
      ),
    transition: () => lowpass(mix(0.2, (o) => tone(o, { freq: NOTE.A5, dur: 0.2, decay: 14, attack: 0.04, amp: 0.6 })), 2000),
  },
  energetic: {
    done: () => mix(0.35, (o) => {
      tone(o, { freq: NOTE.E6, dur: 0.14, decay: 14, wave: "triangle" });
      tone(o, { at: 0.08, freq: NOTE.A6, dur: 0.27, decay: 10, wave: "triangle" });
    }),
    difficult: () => mix(0.45, (o) => {
      tone(o, { freq: NOTE.E5, dur: 0.2, decay: 10, wave: "triangle" });
      tone(o, { at: 0.13, freq: NOTE.C5, dur: 0.32, decay: 8, wave: "triangle" });
    }),
    skip: () => lowpass(mix(0.2, (o) => tone(o, { freq: 900, dur: 0.2, decay: 26, wave: "square", attack: 0.002 })), 3500),
    complete: () => mix(1.6, (o) => {
      [NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone(o, { at: i * 0.09, freq: f, dur: 0.16, decay: 12, wave: "triangle" }));
      [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f) => tone(o, { at: 0.3, freq: f, dur: 1.3, decay: 2.6, wave: "triangle", amp: 0.55 }));
    }),
    transition: () => mix(0.18, (o) => tone(o, { freq: 600, dur: 0.18, decay: 12, bend: 12, wave: "triangle", amp: 0.7 })),
  },
  minimal: {
    done: () => mix(0.3, (o) => {
      click(o, { freq: 2600 });
      click(o, { at: 0.07, freq: 3200 });
    }),
    difficult: () => mix(0.4, (o) => {
      click(o, { freq: 1300 });
      click(o, { at: 0.1, freq: 1000 });
    }),
    skip: () => mix(0.2, (o) => click(o, { freq: 2000, amp: 0.8 })),
    complete: () => mix(1.5, (o) => {
      [2000, 2500, 3000].forEach((f, i) => click(o, { at: i * 0.09, freq: f }));
      tone(o, { at: 0.3, freq: NOTE.C6, dur: 1.2, decay: 3.5, amp: 0.5 });
    }),
    transition: () => mix(0.15, (o) => click(o, { freq: 3000, amp: 0.5, len: 0.006 })),
  },
};

function mix(sec, draw) {
  const out = buf(sec);
  draw(out);
  return out;
}

/* ------------------------------- запись -------------------------------- */

function encode(samples) {
  const enc = new lamejs.Mp3Encoder(1, RATE, KBPS);
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) pcm[i] = Math.max(-1, Math.min(1, samples[i])) * 32767;
  const chunks = [];
  for (let i = 0; i < pcm.length; i += 1152) chunks.push(enc.encodeBuffer(pcm.subarray(i, i + 1152)));
  chunks.push(enc.flush());
  return Buffer.concat(chunks.map((c) => Buffer.from(c)));
}

const root = path.resolve(import.meta.dirname, "..", "public", "sounds");
let packBytes = {};

for (const [pack, events] of Object.entries(PACKS)) {
  mkdirSync(path.join(root, pack), { recursive: true });
  for (const [event, make] of Object.entries(events)) {
    const file = path.join(root, pack, `${event}.mp3`);
    writeFileSync(file, encode(normalize(make())));
    const kb = statSync(file).size / 1024;
    packBytes[pack] = (packBytes[pack] ?? 0) + kb;
    console.log(`${pack}/${event}.mp3  ${kb.toFixed(1)} КБ${kb >= 30 ? "  ← ПРЕВЫШЕН ЛИМИТ 30 КБ" : ""}`);
  }
}
for (const [pack, kb] of Object.entries(packBytes)) {
  console.log(`набор ${pack}: ${kb.toFixed(1)} КБ${kb >= 150 ? "  ← ПРЕВЫШЕН ЛИМИТ 150 КБ" : ""}`);
}
