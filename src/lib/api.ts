import { NextResponse } from "next/server";
import type { ZodType } from "zod";

/** Единый формат ответа всех API-роутов (SPEC БЛОК 3). */

export type ApiOk<T> = { success: true; data: T };
export type ApiErr = { success: false; error: string; details?: unknown };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiOk<T>>({ success: true, data }, init);
}

export function fail(error: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiErr>({ success: false, error, details }, { status });
}

/** Разбор и валидация тела запроса. Возвращает либо данные, либо готовый ответ 400. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { error: fail("Тело запроса должно быть JSON", 400) };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: fail(
        "Данные не прошли валидацию",
        422,
        parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      ),
    };
  }

  return { data: parsed.data };
}

/**
 * Простейший in-memory rate limit (SPEC 5.8).
 * Serverless-инстансы живут недолго и не делят память, поэтому это защита
 * от случайного спама и дребезга кнопок, а не от целенаправленной атаки.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);

  // Не даём карте расти бесконечно в долгоживущем инстансе.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }

  return true;
}
