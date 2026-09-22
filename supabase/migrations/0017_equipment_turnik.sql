-- 0017 (GIMN-014): турник и брусья в общем режиме.
--
-- Было: справочник рассчитан на занятия без снаряда — дома, на коврике.
-- Стало: у упражнения появился признак нужного снаряда, а у анкеты общего
-- режима — вопрос «есть ли турник». Подбор смотрит на оба: без турника
-- турниковые упражнения не показываются вовсе, «могу найти» — показываются
-- последними и с пометкой, что нужен снаряд.
--
-- Почему флаг живёт в user_profiles_general, а не в отдельной таблице
-- настроек: это ответ анкеты общего режима, рядом с целью, активностью
-- и уровнем подготовки. Отдельная таблица на одну колонку означала бы
-- ещё один запрос и ещё один набор RLS-политик без единой выгоды.

-- 1. Нужный снаряд. 'none' — как было у всех 61 упражнения, поэтому DEFAULT
--    именно такой: старые строки остаются доступными всем без бэкофилла.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN ('none', 'pullup_bar', 'dip_bars'));

COMMENT ON COLUMN exercises.equipment IS
  'Нужный снаряд: none — ничего, pullup_bar — турник, dip_bars — брусья (0017)';

CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

-- 2. Ответ анкеты. 'no' по умолчанию — у кого турника нет, ничего не меняется;
--    те, кто анкету уже заполнил, турниковых упражнений не получат, пока
--    сами не ответят «да». Это осознанно: молча выдать подтягивания человеку,
--    который про турник не спрашивал, хуже, чем не выдать.
ALTER TABLE user_profiles_general ADD COLUMN IF NOT EXISTS has_turnik VARCHAR(10) NOT NULL DEFAULT 'no';
ALTER TABLE user_profiles_general DROP CONSTRAINT IF EXISTS user_profiles_general_has_turnik_check;
ALTER TABLE user_profiles_general ADD CONSTRAINT user_profiles_general_has_turnik_check
  CHECK (has_turnik IN ('yes', 'no', 'maybe'));

COMMENT ON COLUMN user_profiles_general.has_turnik IS
  'Есть ли турник: yes — есть, no — нет, maybe — «могу найти» (0017)';

-- RLS не трогаем: политика profiles_general_own стоит FOR ALL на всю строку,
-- колоночных грантов у этой таблицы нет — новая колонка наследует права.
