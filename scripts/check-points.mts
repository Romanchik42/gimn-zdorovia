/**
 * Проверка защиты баллов от двойного начисления (GIMN-027).
 *
 * Главное обещание awardPoints: за один и тот же отзыв или одного и того же
 * приглашённого баллы дают ровно один раз, сколько бы раз ни позвали. Держится
 * оно на уникальном индексе uniq_points_ref — база отвечает 23505, и функция
 * обязана это распознать и НЕ трогать остаток. Если распознавание сломается,
 * повторный вызов раздует баланс, не оставив следа в истории.
 *
 * Клиент базы здесь поддельный: живая база для этой проверки не нужна, а
 * проверка, которой нужна живая база, не запускается никогда.
 *
 * Запуск: node --import ./scripts/lib/ts-resolve-hook.mjs scripts/check-points.mts
 */
import { awardPoints, EXCHANGE_DAYS, EXCHANGE_RATES, MAX_FREE_DAYS_PER_YEAR } from "@/lib/points/service";

/* ------------------------- поддельный клиент базы ------------------------- */

type Row = { user_id: string; amount: number; reference_type: string | null; reference_id: string | null };

/** Повторяет ровно то, что нужно awardPoints: insert, select+eq+maybeSingle, upsert. */
function fakeClient() {
  const history: Row[] = [];
  const balances = new Map<string, number>();
  let insertAttempts = 0;

  const client = {
    from(table: string) {
      if (table === "points_history") {
        return {
          insert(row: Row) {
            insertAttempts += 1;
            // Уникальный индекс: (user_id, reference_type, reference_id), только когда ссылка есть.
            const clash =
              row.reference_id !== null &&
              history.some(
                (h) =>
                  h.user_id === row.user_id &&
                  h.reference_type === row.reference_type &&
                  h.reference_id === row.reference_id,
              );
            if (clash) {
              return Promise.resolve({ error: { code: "23505", message: "duplicate key" } });
            }
            history.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select() {
          return {
            eq(_col: string, userId: string) {
              return {
                maybeSingle() {
                  const points = balances.get(userId);
                  return Promise.resolve({ data: points === undefined ? null : { points } });
                },
              };
            },
          };
        },
        upsert(row: { user_id: string; points: number }) {
          balances.set(row.user_id, row.points);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return {
    client,
    history,
    insertAttempts: () => insertAttempts,
    balance: (userId: string) => balances.get(userId) ?? 0,
  };
}

/* -------------------------------- проверки -------------------------------- */

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const USER = "11111111-1111-1111-1111-111111111111";
const FEEDBACK = "22222222-2222-2222-2222-222222222222";

console.log("Двойное начисление за одну и ту же ссылку:");
{
  const db = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = db.client as any;

  const first = await awardPoints(USER, 50, "Баг подтверждён", "feedback", FEEDBACK, c);
  check("первое начисление проходит", first.ok && !first.alreadyAwarded);
  check("баланс стал 50", db.balance(USER) === 50, `сейчас ${db.balance(USER)}`);

  const second = await awardPoints(USER, 50, "Баг подтверждён", "feedback", FEEDBACK, c);
  check("повтор помечен как уже начисленный", second.ok === true && second.alreadyAwarded === true);
  check("баланс НЕ вырос", db.balance(USER) === 50, `сейчас ${db.balance(USER)}`);
  check("в истории одна запись", db.history.length === 1, `записей ${db.history.length}`);

  const third = await awardPoints(USER, 50, "Баг подтверждён", "feedback", FEEDBACK, c);
  check("третий вызов тоже не начисляет", third.alreadyAwarded === true && db.balance(USER) === 50);
}

console.log("\nНачисления без ссылки не мешают друг другу:");
{
  const db = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = db.client as any;

  await awardPoints(USER, 20, "Хорошая идея", undefined, undefined, c);
  await awardPoints(USER, 20, "Хорошая идея", undefined, undefined, c);
  check("два ручных начисления сложились", db.balance(USER) === 40, `сейчас ${db.balance(USER)}`);
  check("обе записи в истории", db.history.length === 2, `записей ${db.history.length}`);
}

console.log("\nРазные ссылки — разные начисления:");
{
  const db = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = db.client as any;

  await awardPoints(USER, 50, "Баг", "feedback", FEEDBACK, c);
  await awardPoints(USER, 50, "Другой баг", "feedback", "33333333-3333-3333-3333-333333333333", c);
  check("оба начисления прошли", db.balance(USER) === 100, `сейчас ${db.balance(USER)}`);
}

console.log("\nСписание:");
{
  const db = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = db.client as any;

  await awardPoints(USER, 100, "Начисление", undefined, undefined, c);
  await awardPoints(USER, -100, "Обмен на 1 дн. подписки", "DAY_PLUS", undefined, c);
  check("остаток обнулился", db.balance(USER) === 0, `сейчас ${db.balance(USER)}`);
  check("баланс не уходит в минус", db.balance(USER) >= 0);
}

console.log("\nТаблица обмена:");
{
  const bad = (Object.keys(EXCHANGE_RATES) as (keyof typeof EXCHANGE_RATES)[]).filter(
    (k) => !(k in EXCHANGE_DAYS),
  );
  check("у каждого варианта обмена известна длительность", bad.length === 0, bad.join(", "));
  check(
    `годовой потолок ${MAX_FREE_DAYS_PER_YEAR} дн. меньше года подписки`,
    MAX_FREE_DAYS_PER_YEAR < EXCHANGE_DAYS.YEAR_PLUS,
  );
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
