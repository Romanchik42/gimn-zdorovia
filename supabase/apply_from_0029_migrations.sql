-- ============================================================================
-- ДОБАВКА К УЖЕ ПРИМЕНЁННОЙ БАЗЕ: миграции 0029-0030 + seed.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
--
-- Когда брать этот файл, а не apply_all.sql: база уже живёт, миграции до
-- 0029 в ней есть. Повторный прогон безопасен — миграции написаны
-- идемпотентно (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS), seed тоже.
--
-- Supabase → SQL Editor → вставить → Run.
-- ============================================================================

-- >>> 0029_points_notification.sql
-- 0029 (GIMN-030): уведомление о начислении баллов.
--
-- Начисление стало сообщать о себе в Telegram: человек нашёл баг, его
-- подтвердили — и раньше он узнавал об этом, только если сам заглядывал
-- в «Мои баллы». Журналу уведомлений нужен свой тип для таких сообщений,
-- иначе запись отвергается проверкой и отправка не остаётся в истории:
-- сообщение ушло, а по журналу его как будто не было.
--
-- Тип добавляем ровно так же, как 0025 добавляла level_up.

ALTER TABLE notifications_log DROP CONSTRAINT IF EXISTS notifications_log_type_check;
ALTER TABLE notifications_log ADD CONSTRAINT notifications_log_type_check
  CHECK (type IN (
    'morning_reminder',
    'evening_reminder',
    'personal_report',
    'doctor_advice',
    'level_up',
    'points_awarded',
    'other'
  ));

NOTIFY pgrst, 'reload schema';

-- >>> 0030_family.sql
-- 0030 (GIMN-030): семейный тариф — до четырёх профилей в одном аккаунте.
--
-- Тариф «Семейный» висел в витрине с ценой и обещанием «до 4 профилей»,
-- но подключить второй профиль было нечем. Здесь появляется механизм:
-- глава семьи создаёт ссылку, по ней присоединяется один человек.
--
-- Профили остаются раздельными — у каждого свой план, замеры, меню и
-- история. Общая только оплата. Поэтому связь лежит отдельной таблицей,
-- а не колонкой в users: выход из семьи не должен трогать ничьи данные,
-- и удаление строки здесь — это ровно расставание, ничего больше.

CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(owner_id, member_id)
);

COMMENT ON TABLE family_members IS
  'Кто в чьей семье (0030). Владельца тут нет — он подразумевается как owner_id';

-- Человек состоит максимум в одной семье: иначе непонятно, чья оплата его
-- покрывает. Уникальность по member_id и есть это правило.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_family_member ON family_members(member_id);
CREATE INDEX IF NOT EXISTS idx_family_owner ON family_members(owner_id);

-- Потолок «не больше трёх приглашённых» проверяется в коде
-- (src/lib/family/rules.ts), а не констрейнтом: считать пришлось бы
-- триггером, а триггер и наполнение тестовыми данными ломает, и молчит
-- там, где человеку нужно объяснение, почему больше нельзя.

CREATE TABLE IF NOT EXISTS family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_by UUID REFERENCES users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ
);

COMMENT ON TABLE family_invites IS
  'Ссылки-приглашения (0030). Одноразовые, живут 7 дней — срок в expires_at';

CREATE INDEX IF NOT EXISTS idx_invites_code ON family_invites(invite_code);
CREATE INDEX IF NOT EXISTS idx_invites_owner ON family_invites(owner_id);

-- ---------------------------------------------------------------------------
-- RLS.
--
-- Читать состав семьи может и владелец, и любой её участник: «моя семья»
-- должна быть видна всем, кто в ней. Писать нельзя никому — приглашения
-- разбирает сервер служебным ключом, проверив и срок, и потолок. Без
-- этого любой подставил бы себе строку в чужую семью прямо из браузера.
-- ---------------------------------------------------------------------------
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family_members_read_own" ON family_members;
CREATE POLICY "family_members_read_own" ON family_members
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR member_id = auth.uid());

-- Приглашение видит только тот, кто его создал. Тому, кто по нему пришёл,
-- строка не нужна: страница приглашения читается сервером по коду.
DROP POLICY IF EXISTS "family_invites_read_own" ON family_invites;
CREATE POLICY "family_invites_read_own" ON family_invites
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON family_members FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON family_invites FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- Дальше отдельным заходом: вставить supabase/seed.sql целиком.
NOTIFY pgrst, 'reload schema';
