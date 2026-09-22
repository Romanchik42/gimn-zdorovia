/**
 * Резолвер для запуска исходников из scripts (GIMN-022).
 *
 * Node с 24-й версии сам снимает типы с .ts, но не знает двух вещей,
 * которые знает сборщик Next: алиас `@/` и пакет `server-only`. Хук учит
 * его обеим — этого хватает, чтобы дёргать модули подбора напрямую,
 * без тестового раннера и без сборки.
 *
 * Использование: node --import ./scripts/lib/ts-resolve-hook.mjs scripts/<файл>.mts
 */
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const srcDir = path.join(root, "src");

/** `server-only` кидает при импорте вне сервера React — здесь он пустышка. */
const EMPTY = pathToFileURL(path.join(root, "scripts", "lib", "empty-module.mjs")).href;

function resolveFile(base) {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { url: EMPTY, shortCircuit: true };
    if (specifier.startsWith("@/")) {
      const file = resolveFile(path.join(srcDir, specifier.slice(2)));
      if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
