-- ============================================================================
-- ДОБАВКА К УЖЕ ПРИМЕНЁННОЙ БАЗЕ: миграции 0017-0018 + seed.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
--
-- Когда брать этот файл, а не apply_all.sql: база уже живёт, миграции до
-- 0017 в ней есть. Повторный прогон безопасен — миграции написаны
-- идемпотентно (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS), seed тоже.
--
-- Supabase → SQL Editor → вставить → Run.
-- ============================================================================

-- >>> 0017_equipment_turnik.sql
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

-- >>> 0018_wger_images.sql
-- 0018 (GIMN-015): картинки движения с wger.
--
-- Было: живая картинка у 12 упражнений из 76, остальным — рисованная схема.
-- Стало: ещё 14, в том числе всем шести турниковым, где движение сложное
-- и схема объясняет его хуже фотографии.
--
-- Источник — wger.de, открытая база тренировок: 374 картинки под Creative
-- Commons, публичный API без ключа. Отобраны вручную и отсмотрены глазами:
-- взяты только те, где движение совпадает с нашей техникой. Musclewiki и
-- ExRx не подошли — оба закрыты от машинного доступа, и их условия
-- использования не разрешают брать картинки к себе.
--
-- Лицензия CC BY-SA требует назвать автора, поэтому image_credit хранит
-- «wger, <автор> (CC BY-SA 4.0)» — карточка печатает это под картинкой.
-- Полные ссылки на файлы — в docs/IMAGE_SOURCES.md и в scripts/fetch-wger-images.mjs.
--
-- Файлы скачаны в public/exercises/<slug>.webp: хотлинк на чужой сервер
-- означал бы, что картинки исчезнут в тот день, когда wger переедет.

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger (CC BY-SA 4.0)'
WHERE slug IN ('bar-knee-raise', 'bar-leg-raise', 'gen-jumping-jacks',
               'warmup-neck-tilts', 'warmup-neck-turns', 'main-bridge', 'gen-glute-bridge');

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Imobard (CC BY-SA 4.0)'
WHERE slug = 'bar-pullup-overhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Everkinetic (CC BY-SA 3.0)'
WHERE slug = 'bar-pullup-underhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, cshep442 (CC BY-SA 4.0)'
WHERE slug = 'dip-pushup';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Gavru (CC BY-SA 4.0)'
WHERE slug = 'bar-australian-row';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, utkb (CC BY-SA 4.0)'
WHERE slug = 'main-bird-dog';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Davidgj32 (CC BY-SA 4.0)'
WHERE slug IN ('main-hip-flexor-stretch', 'stretch-piriformis');

-- Дальше отдельным заходом: вставить supabase/seed.sql целиком.
NOTIFY pgrst, 'reload schema';
