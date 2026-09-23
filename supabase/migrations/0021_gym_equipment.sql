-- 0021 (GIMN-028): снаряжение зала и место тренировок.
--
-- Было: снаряд — это турник и брусья, а вопрос анкеты один, про турник.
-- Стало: перечень снаряжения, который человек отмечает сам, и место
-- занятий — дом, дом с турником, зал или и то и другое.
--
-- has_turnik НЕ удаляем: по нему работает подбор у тех, кто уже заполнил
-- анкету, и на нём держатся проверки check:equipment. Пока gym_equipment
-- пуст, подбор читает старый ответ; как только человек отметит снаряжение,
-- источником становится новый список. Так старые профили не ломаются и не
-- требуют обязательного перезаполнения анкеты.
--
-- Уровень подготовки отдельной колонкой НЕ заводим: он уже есть —
-- user_profiles_general.difficulty со значениями beginner/intermediate/
-- advanced, и именно его читает подбор (levelCap в генераторе, maxLevel
-- в конструкторе). Вторая колонка с теми же значениями осталась бы
-- пустой полкой, а подбор продолжил бы смотреть на старую.

-- 1. Снаряды зала. Значения совпадают с типом Equipment в коде.
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN (
    'none',
    'pullup_bar',
    'dip_bars',
    'dumbbell',
    'barbell',
    'bench',
    'kettlebell',
    'resistance_band',
    'cable',
    'machine',
    'squat_rack'
  ));

COMMENT ON COLUMN exercises.equipment IS
  'Нужный снаряд (0017, расширен в 0021): none, турник, брусья, гантели, штанга, '
  'скамья, гиря, резинки, блок, тренажёр, стойка';

-- 2. Где человек занимается и что у него есть.
ALTER TABLE user_profiles_general
  ADD COLUMN IF NOT EXISTS training_location VARCHAR(20) NOT NULL DEFAULT 'home',
  ADD COLUMN IF NOT EXISTS gym_equipment JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_profiles_general DROP CONSTRAINT IF EXISTS user_profiles_general_location_check;
ALTER TABLE user_profiles_general ADD CONSTRAINT user_profiles_general_location_check
  CHECK (training_location IN ('home', 'home_bar', 'gym', 'home_and_gym'));

COMMENT ON COLUMN user_profiles_general.training_location IS
  'Где занимается: home | home_bar | gym | home_and_gym (0021)';
COMMENT ON COLUMN user_profiles_general.gym_equipment IS
  'JSON-массив отмеченного снаряжения: ["pullup_bar","dumbbell"]. Пусто — читаем has_turnik (0021)';

-- 3. Перенос старых ответов. Пустой gym_equipment означает «анкету про
--    снаряжение ещё не проходили», поэтому трогаем только место занятий:
--    у кого был турник, тому ставим home_bar, остальным остаётся home.
UPDATE user_profiles_general
   SET training_location = 'home_bar'
 WHERE has_turnik = 'yes'
   AND training_location = 'home';

-- RLS не трогаем — по тому же основанию, что записано в 0017: политика
-- profiles_general_own стоит FOR ALL на всю строку, колоночных грантов у
-- этой таблицы нет, новые колонки наследуют права. Колоночный GRANT здесь
-- был бы шумом: поколоночные права заведены только у users (0011).

NOTIFY pgrst, 'reload schema';
