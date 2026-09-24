/**
 * Проверка админского раздела (GIMN-030).
 *
 * Админка начисляет баллы — то есть раздаёт то, что потом превратится в
 * оплаченные дни подписки. Дыра здесь стоит дороже любой другой: чужой
 * человек выписал бы себе сколько угодно, и заметить это можно было бы
 * только по балансу.
 *
 * Поэтому проверка смотрит не на поведение, а на устройство: каждая
 * админская страница и каждая админская ручка обязаны спросить права на
 * сервере до того, как прочитают хоть строку, и обязаны отвечать чужому
 * «не найдено», а не «нельзя» — второй ответ подтверждает, что адрес
 * существует.
 *
 * Живая база для этого не нужна и не должна быть нужна: проверка, которой
 * нужна база, не запускается никогда.
 *
 * Запуск: npm run check:admin
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { ACTIONS, REVIEW_ACTIONS } from "@/lib/points/feedback-review";
import { POINTS_RULES } from "@/lib/points/service";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(full);
    }
  };
  walk(dir);
  return out;
}

const root = process.cwd();
const rel = (file: string) => path.relative(root, file).replace(/\\/g, "/");

const adminPages = filesUnder(path.join(root, "src/app/admin"));
const adminApi = filesUnder(path.join(root, "src/app/api/admin"));

console.log("Проверка прав — на сервере:");
{
  check("админские страницы найдены", adminPages.length > 0, String(adminPages.length));
  check("админские ручки найдены", adminApi.length > 0, String(adminApi.length));

  const unguarded = [...adminPages, ...adminApi].filter((file) => {
    const src = readFileSync(file, "utf8");
    return !(src.includes('from "@/lib/auth/admin"') && src.includes("isAdmin("));
  });
  check("каждая спрашивает isAdmin", unguarded.length === 0, unguarded.map(rel).join(", "));

  // Права проверяются раньше чтения данных: страница не должна успеть
  // сходить в базу за чужими отзывами, а потом передумать.
  const lateGuard = [...adminPages, ...adminApi].filter((file) => {
    const src = readFileSync(file, "utf8");
    const guard = src.indexOf("await isAdmin(");
    const read = src.search(/await (listFeedback|reviewFeedback|createAdminClient)/);
    return guard >= 0 && read >= 0 && read < guard;
  });
  check("права проверяются до чтения данных", lateGuard.length === 0, lateGuard.map(rel).join(", "));
}

console.log("\nЧужой не должен узнать, что адрес есть:");
{
  const feedbackSurface = [...adminPages, ...adminApi].filter((f) => rel(f).includes("feedback"));
  check("страница и ручки разбора отзывов на месте", feedbackSurface.length === 3, String(feedbackSurface.length));

  const talkative = feedbackSurface.filter((file) => {
    const src = readFileSync(file, "utf8");
    const hidden = src.includes("notFound()") || src.includes('fail("Не найдено", 404)');
    return !hidden;
  });
  check("отвечают «не найдено», а не «нет прав»", talkative.length === 0, talkative.map(rel).join(", "));

  // Ищем именно ответ, а не число: в комментариях 403 упоминается как раз
  // затем, чтобы объяснить, почему его тут нет.
  const leaky = feedbackSurface.filter((file) => /,\s*403\s*\)/.test(readFileSync(file, "utf8")));
  check("никто не отвечает 403", leaky.length === 0, leaky.map(rel).join(", "));
}

console.log("\nКлиент админку не решает:");
{
  // Флаг администратора в компоненте браузера — это приглашение
  // подставить его самому через инструменты разработчика.
  const clientFiles = filesUnder(path.join(root, "src/components")).filter((file) =>
    readFileSync(file, "utf8").startsWith('"use client"'),
  );
  const leaks = clientFiles.filter((file) => {
    const src = readFileSync(file, "utf8");
    return src.includes("is_admin") || src.includes("isAdmin");
  });
  check("в клиентских компонентах нет признака админа", leaks.length === 0, leaks.map(rel).join(", "));
}

console.log("\nКнопки разбора:");
{
  check("четыре действия", REVIEW_ACTIONS.length === 4, REVIEW_ACTIONS.join(", "));

  const missing = REVIEW_ACTIONS.filter((a) => !ACTIONS[a]);
  check("у каждого действия есть описание", missing.length === 0, missing.join(", "));

  // Суммы — из общей таблицы начислений, а не набраны заново: иначе
  // в разделе «За что начисляем» и на кнопке админа стояли бы разные числа.
  check("подтверждённый баг даёт столько же, сколько обещано", ACTIONS.confirm_bug.points === POINTS_RULES.BUG_CONFIRMED);
  check("принятая идея — столько же", ACTIONS.accept_idea.points === POINTS_RULES.IDEA_ACCEPTED);
  check("хорошая идея — столько же", ACTIONS.good_idea.points === POINTS_RULES.IDEA_GOOD);
  check("отклонение не начисляет", ACTIONS.reject.points === 0);

  check(
    "отклонённый отзыв не считается разобранным в плюс",
    ACTIONS.reject.status === "rejected" && ACTIONS.accept_idea.status === "in_plan",
  );

  const statuses = REVIEW_ACTIONS.map((a) => ACTIONS[a].status);
  check("ни одно действие не оставляет отзыв новым", !statuses.includes("new"), statuses.join(", "));

  check("у каждой кнопки есть подпись", REVIEW_ACTIONS.every((a) => ACTIONS[a].label.trim().length > 0));
}

console.log("\nДважды за один отзыв не начисляем:");
{
  // Защита живёт в базе — уникальный индекс uniq_points_ref по
  // (user_id, reference_type, reference_id). Она работает, только если
  // начисление действительно ссылается на отзыв; ссылку и проверяем.
  const src = readFileSync(path.join(root, "src/lib/points/feedback-review.ts"), "utf8");
  check('начисление ссылается на отзыв ("feedback")', src.includes('"feedback", item.id'));

  const migration = readFileSync(path.join(root, "supabase/migrations/0020_points_system.sql"), "utf8");
  check(
    "уникальный индекс на месте",
    migration.includes("uniq_points_ref") && migration.includes("ON points_history(user_id, reference_type, reference_id)"),
  );

  // Порядок: сначала баллы, потом статус. Наоборот — упавшее начисление
  // оставило бы отзыв помеченным разобранным, и найти его было бы негде.
  check(
    "баллы начисляются до смены статуса",
    src.indexOf("awardPoints(") < src.indexOf('.update({ status:'),
  );
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
