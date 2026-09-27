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
import {
  awardPoints,
  spendPointsOnPayment,
  EXCHANGE_DAYS,
  EXCHANGE_RATES,
  MAX_FREE_DAYS_PER_YEAR,
} from "@/lib/points/service";
import { pointsAwardedMessage, pointsWord } from "@/lib/points/format";
import {
  MAX_POINTS_PERCENT,
  POINT_KOPECKS,
  applyPoints,
  pointsDiscountRub,
  pointsWorthRub,
} from "@/lib/points/pricing";

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

console.log("\nСообщение о начислении (GIMN-030):");
{
  // Уведомление — единственное, что человек про начисление видит: в
  // приложение за баллами специально не ходят. Поэтому сверяем весь текст,
  // а не факт отправки.
  const text = pointsAwardedMessage({
    name: "Роман",
    amount: 50,
    reason: "подтверждённый баг «QR не сохраняется на iPhone»",
    balance: 350,
  });

  check("обращается по имени", text.startsWith("🎁 Роман, вам начислено +50 баллов!"), text.split("\n")[0]);
  check("говорит, за что", text.includes("За что: подтверждённый баг «QR не сохраняется на iPhone»"));
  check("показывает остаток", text.includes("Ваш баланс: 350 баллов"));
  check(
    "предупреждает, что тариф ещё не запущен",
    text.includes("Баллы применятся при выборе тарифа") &&
      text.includes("после запуска платного режима."),
  );

  const noName = pointsAwardedMessage({ name: null, amount: 1, reason: "отзыв", balance: 1 });
  check("без имени не выдумывает его", noName.startsWith("🎁 Вам начислено +1 балл!"), noName.split("\n")[0]);
  check(
    "пустое имя — тоже без имени",
    pointsAwardedMessage({ name: "  ", amount: 5, reason: "-", balance: 5 }) ===
      pointsAwardedMessage({ amount: 5, reason: "-", balance: 5 }),
  );

  // Склонение живёт в одном месте на сервер и на браузер: раньше таблица
  // окончаний была своей копией в разделе «Мои баллы».
  const forms = [1, 2, 5, 11, 14, 21, 22, 25, 100, 101].map((n) => `${n} ${pointsWord(n)}`);
  check(
    "склонение слова «балл»",
    forms.join(", ") ===
      "1 балл, 2 балла, 5 баллов, 11 баллов, 14 баллов, 21 балл, 22 балла, 25 баллов, 100 баллов, 101 балл",
    forms.join(", "),
  );
}

console.log("\nЧастичная оплата баллами (GIMN-030):");
{
  const PLUS = 799;

  // Цена балла округлена от таблицы обмена (2000 баллов = 799 ₽, то есть
  // 39.95 копейки). Расхождение допустимо, но только в нашу пользу и
  // только на сотые: иначе один и тот же балл стоит по-разному в обмене
  // на дни и в частичной оплате.
  const fromTable = (PLUS * 100) / EXCHANGE_RATES.MONTH_PLUS;
  check("цена балла сверена с таблицей обмена", POINT_KOPECKS >= fromTable && POINT_KOPECKS - fromTable < 0.1, `${POINT_KOPECKS} против ${fromTable}`);

  check("пример из батча: 350 баллов = 140 ₽", pointsWorthRub(350) === 140, String(pointsWorthRub(350)));

  const example = applyPoints(PLUS, 350, 350);
  check("к оплате картой 659 ₽", example.payRub === 659, String(example.payRub));
  check("скидка 140 ₽", example.discountRub === 140, String(example.discountRub));

  // Потолок доли: больше 30% суммы баллами не закрыть, иначе тестер
  // получал бы подписку бесплатно навсегда.
  const rich = applyPoints(PLUS, 100_000, 100_000);
  check("богатый баланс упирается в потолок доли", rich.maxPoints === 599, String(rich.maxPoints));
  check(
    `скидка не больше ${MAX_POINTS_PERCENT}% от суммы`,
    rich.discountRub * 100 <= PLUS * MAX_POINTS_PERCENT,
    `${rich.discountRub} ₽ из ${PLUS} ₽`,
  );
  check("баллами нельзя закрыть всю сумму", rich.payRub > 0 && rich.payRub === PLUS - rich.discountRub);

  // Округление вниз до рубля: копейки в пользу приложения, а не человека,
  // — иначе на каждой оплате терялось бы по рублю.
  check("округление вниз: 3 балла — рубль, не два", pointsDiscountRub(3) === 1, String(pointsDiscountRub(3)));
  check("2 балла — ноль рублей", pointsDiscountRub(2) === 0, String(pointsDiscountRub(2)));
  check("скидка всегда целая", [1, 7, 13, 99, 351].every((n) => Number.isInteger(pointsDiscountRub(n))));

  // Слайдер может прийти с любым числом — из старой вкладки, из
  // подставленного запроса. Прижимаем, а не падаем.
  check("больше остатка не применить", applyPoints(PLUS, 100, 500).points === 100);
  check("отрицательное — ноль", applyPoints(PLUS, 100, -50).points === 0);
  check("дробное округляется вниз", applyPoints(PLUS, 100, 10.9).points === 10);
  check("мусор вместо числа — ноль", applyPoints(PLUS, 100, Number.NaN).points === 0);
  check("нулевая цена — применять нечего", applyPoints(0, 1000, 1000).maxPoints === 0);
  check("пустой баланс — применять нечего", applyPoints(PLUS, 0, 100).maxPoints === 0);

  // Дешёвый тариф: потолок считается от его цены, а не от «Плюса».
  const basic = applyPoints(399, 100_000, 100_000);
  check("у Базового свой потолок", basic.maxPoints === 299, String(basic.maxPoints));
  check(
    "и он тоже не выше доли",
    basic.discountRub * 100 <= 399 * MAX_POINTS_PERCENT,
    `${basic.discountRub} ₽ из 399 ₽`,
  );
}

console.log("\nСписание при частичной оплате:");
{
  const db = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = db.client as any;

  await awardPoints(USER, 350, "Начисление", undefined, undefined, c);
  const paid = await spendPointsOnPayment(USER, 799, 350, c);

  check("списание прошло", paid.ok === true, paid.error ?? "");
  check("скидка 140 ₽", paid.discountRub === 140, String(paid.discountRub));
  check("к оплате 659 ₽", paid.payRub === 659, String(paid.payRub));
  check("остаток обнулился", db.balance(USER) === 0, `сейчас ${db.balance(USER)}`);

  // Списываем прижатое к пределу, а не запрошенное: запрос мог прийти из
  // вкладки, открытой до того, как баллы потратили.
  const db2 = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c2 = db2.client as any;
  await awardPoints(USER, 100, "Начисление", undefined, undefined, c2);
  const clamped = await spendPointsOnPayment(USER, 799, 5000, c2);
  check("больше остатка не списали", clamped.ok === true && db2.balance(USER) === 0);
  check("скидка по фактическому остатку", clamped.points === 100 && clamped.discountRub === 40, String(clamped.discountRub));

  const empty = fakeClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c3 = empty.client as any;
  const nothing = await spendPointsOnPayment(USER, 799, 100, c3);
  check("без баллов списание отказывает", nothing.ok === false, nothing.error ?? "");
  check("и баланс не уходит в минус", empty.balance(USER) === 0);
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
