/**
 * Проверка семейного тарифа (GIMN-030).
 *
 * Семья — это про деньги: одна оплата на четыре профиля. Ошибка в потолке
 * или в сроке ссылки не падает и не ругается, она просто тихо раздаёт
 * доступ, и заметить это можно будет только по счёту.
 *
 * Потолок «четыре профиля» живёт в коде, а не констрейнтом в базе
 * (основание записано в миграции 0030), — значит, проверять его должен
 * кто-то ещё. Здесь.
 *
 * Живая база не нужна и не должна быть нужна: проверка, которой нужна
 * база, не запускается никогда.
 *
 * Запуск: npm run check:family
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import {
  FAMILY_MAX_MEMBERS,
  FAMILY_MAX_PROFILES,
  INVITE_CODE_LENGTH,
  INVITE_STATE_MESSAGES,
  INVITE_TTL_DAYS,
  canInvite,
  familySize,
  generateInviteCode,
  inviteExpiresAt,
  inviteState,
  isValidInviteCode,
  joinRefusal,
} from "@/lib/family/rules";

let failed = 0;

function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    console.log(`  ok   ${name}`);
    return;
  }
  failed += 1;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

const OWNER = "11111111-1111-1111-1111-111111111111";
const JOINER = "22222222-2222-2222-2222-222222222222";

console.log("Потолок — четыре профиля:");
{
  check("владелец плюс трое", FAMILY_MAX_PROFILES === 4 && FAMILY_MAX_MEMBERS === 3);
  check("владелец считается в составе", familySize(0) === 1 && familySize(3) === FAMILY_MAX_PROFILES);

  const allowed = [0, 1, 2, 3, 4].map((n) => canInvite(n));
  check("позвать можно, пока приглашённых меньше трёх", allowed.join() === "true,true,true,false,false", allowed.join());

  const full = joinRefusal({ ownerId: OWNER, joinerId: JOINER, memberCount: 3, joinerHasFamily: false });
  check("четвёртого приглашённого не пускают", full !== null, String(full));
  check("в отказе названо число профилей", full?.includes(String(FAMILY_MAX_PROFILES)) === true, String(full));

  const third = joinRefusal({ ownerId: OWNER, joinerId: JOINER, memberCount: 2, joinerHasFamily: false });
  check("третьего пускают", third === null, String(third));
}

console.log("\nКого нельзя пускать:");
{
  const self = joinRefusal({ ownerId: OWNER, joinerId: OWNER, memberCount: 0, joinerHasFamily: false });
  check("по своей же ссылке не присоединиться", self !== null, String(self));

  // Иначе непонятно, чья оплата человека покрывает, — и в базе это же
  // правило стоит уникальным индексом по member_id.
  const taken = joinRefusal({ ownerId: OWNER, joinerId: JOINER, memberCount: 0, joinerHasFamily: true });
  check("в двух семьях сразу не состоят", taken !== null, String(taken));

  const ok = joinRefusal({ ownerId: OWNER, joinerId: JOINER, memberCount: 0, joinerHasFamily: false });
  check("свободного человека пускают", ok === null, String(ok));
}

console.log("\nСрок ссылки — семь дней:");
{
  check("срок объявлен", INVITE_TTL_DAYS === 7);

  const from = new Date("2026-09-24T12:00:00.000Z");
  const expires = inviteExpiresAt(from);
  const days = (new Date(expires).getTime() - from.getTime()) / 86_400_000;
  check("ссылка живёт ровно семь суток", days === 7, `${days} дн.`);

  const invite = { expiresAt: expires, usedBy: null };
  check("в день выдачи ссылка жива", inviteState(invite, from) === "active");
  check(
    "за минуту до срока ещё жива",
    inviteState(invite, new Date(new Date(expires).getTime() - 60_000)) === "active",
  );
  check("в момент срока уже нет", inviteState(invite, new Date(expires)) === "expired");
  check("через восемь дней нет", inviteState(invite, new Date("2026-10-02T12:00:00.000Z")) === "expired");
}

console.log("\nПо ссылке приходит один человек:");
{
  const used = { expiresAt: inviteExpiresAt(new Date()), usedBy: JOINER };
  check("использованная ссылка больше не работает", inviteState(used) === "used");

  // «Использовано» важнее «просрочено»: по ссылке, которой уже
  // воспользовались, человек должен получить понятный ответ, а не рассказ
  // про срок, который тут ни при чём.
  const both = { expiresAt: "2020-01-01T00:00:00.000Z", usedBy: JOINER };
  check("использованная и просроченная — «использована»", inviteState(both) === "used");

  check(
    "у каждого отказа есть человеческий текст",
    INVITE_STATE_MESSAGES.used.length > 10 && INVITE_STATE_MESSAGES.expired.length > 10,
  );
  check("в тексте про срок назван сам срок", INVITE_STATE_MESSAGES.expired.includes(String(INVITE_TTL_DAYS)));
}

console.log("\nКод приглашения:");
{
  check("восемь символов", INVITE_CODE_LENGTH === 8);

  const codes = Array.from({ length: 200 }, () => generateInviteCode());
  check("всегда нужной длины", codes.every((c) => c.length === INVITE_CODE_LENGTH));
  check("все свои коды проходят проверку", codes.every(isValidInviteCode));
  check("повторов нет", new Set(codes).size === codes.length, `уникальных ${new Set(codes).size} из ${codes.length}`);

  // Регистр значим: приглашение открывает доступ к чужой оплате, и
  // «привести к верхнему», как у реферального кода, здесь нельзя.
  const mixed = codes.join("");
  check("алфавит со строчными буквами", /[a-z]/.test(mixed) && /[A-Z]/.test(mixed));

  check("пустая строка — не код", !isValidInviteCode(""));
  check("короткий — не код", !isValidInviteCode("abc"));
  check("длинный — не код", !isValidInviteCode("abcdefghi"));
  check("с посторонним символом — не код", !isValidInviteCode("abcdef-h"));
  // Похожие символы в алфавит не входят: 0/O/1/l/I путают при пересылке
  // текстом, и ссылка «почти та же» вела бы в никуда.
  check("похожие символы в код не попадают", !/[0O1lI]/.test(mixed));
}

console.log("\nЗапись — только служебным ключом:");
{
  const migration = readFileSync(path.join(process.cwd(), "supabase/migrations/0030_family.sql"), "utf8");

  check("RLS включена у обеих таблиц", (migration.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length === 2);
  check(
    "писать из браузера нельзя",
    migration.includes("REVOKE INSERT, UPDATE, DELETE ON family_members") &&
      migration.includes("REVOKE INSERT, UPDATE, DELETE ON family_invites"),
  );
  check("состав семьи виден и владельцу, и участнику", migration.includes("owner_id = auth.uid() OR member_id = auth.uid()"));
  check("человек состоит в одной семье", migration.includes("uniq_family_member ON family_members(member_id)"));
  check("политик на запись не заведено", !/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/.test(migration));

  // Ручки семьи обязаны спрашивать, кто пришёл: состав и приглашения —
  // не публичные данные.
  const apiDir = path.join(process.cwd(), "src/app/api/family");
  const routes: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "route.ts") routes.push(full);
    }
  };
  walk(apiDir);

  check("четыре ручки", routes.length === 4, String(routes.length));
  const anonymous = routes.filter((file) => {
    const src = readFileSync(file, "utf8");
    return !(src.includes("auth.getUser()") && src.includes('fail("Нужно войти", 401)'));
  });
  check(
    "каждая требует входа",
    anonymous.length === 0,
    anonymous.map((f) => path.relative(process.cwd(), f).replace(/\\/g, "/")).join(", "),
  );
}

console.log("\nВыход из семьи не трогает данные:");
{
  // Главная мина этого блока: снял человека с оплаты — и стёр ему
  // историю занятий. Удаляться должна ровно одна строка связи.
  const service = readFileSync(path.join(process.cwd(), "src/lib/family/service.ts"), "utf8");
  const deletes = [...service.matchAll(/\.from\("([a-z_]+)"\)\s*\.delete\(\)/g)].map((m) => m[1]);
  check(
    "удаляем только связи и приглашения",
    deletes.every((t) => t === "family_members" || t === "family_invites"),
    deletes.join(", "),
  );
  check("чужих таблиц не касаемся", !/user_workouts|user_progress|user_week_plan|user_meals/.test(service));
}

console.log(failed === 0 ? "\nВсё сошлось." : `\nНе сошлось: ${failed}.`);
process.exit(failed === 0 ? 0 : 1);
