-- 0015 (GIMN-012): несколько режимов на пользователя, данные режимов раздельно.
--
-- Было: users.mode — единственный режим, все данные лежат на user_id без
-- различения. Переключить режим означало бы смешать программы в одну кучу.
--
-- Стало:
--   * user_modes — какими режимами человек реально занимается;
--   * users.mode — ТЕКУЩИЙ выбранный режим (какой показывается сейчас);
--     имя колонки не меняем: на неё завязано два десятка мест, а смысл
--     «режим, в котором человек сейчас» у неё и был;
--   * колонка mode у режимозависимых данных + уникальные ключи с ней.
--
-- Ничего не удаляем: переключение режима — это смена users.mode, данные
-- обоих режимов лежат рядом. Существующие строки бэкофиллим текущим режимом
-- их владельца ДО NOT NULL, иначе потеряли бы данные двух реальных людей.
--
-- user_progress сознательно оставлен общим: вес, скованность и тест Шобера —
-- замеры тела, а тело у человека одно. График регулярности на той же странице
-- считается из user_workouts и потому режимом уже разделён.
-- user_diagnostics (только Бехтерева) и user_profiles_general (только общий)
-- сами по себе принадлежат режиму — колонка им не нужна.

-- 1. Какими режимами человек занимается.
CREATE TABLE IF NOT EXISTS user_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),
  -- FALSE = режим только посмотрели, анкету не заполняли.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mode)
);

CREATE INDEX IF NOT EXISTS user_modes_user_idx ON user_modes (user_id);

ALTER TABLE user_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_modes_select_own" ON user_modes;
CREATE POLICY "user_modes_select_own" ON user_modes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "user_modes_insert_own" ON user_modes;
CREATE POLICY "user_modes_insert_own" ON user_modes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_modes_update_own" ON user_modes;
CREATE POLICY "user_modes_update_own" ON user_modes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Отключить режим = снять is_active. Удалять строку нечем и незачем:
-- вместе с ней потерялась бы дата, с которой человек этим занимается.
REVOKE DELETE ON user_modes FROM anon, authenticated;

COMMENT ON TABLE user_modes IS
  'Режимы, которыми занимается пользователь (GIMN-012). Текущий выбранный — users.mode';

-- 2. Режимозависимые данные получают колонку mode.
--    Порядок важен: добавить NULL-колонку → бэкофилл → NOT NULL.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_workouts', 'user_week_plan', 'user_custom_workouts',
    'user_meals', 'shopping_list', 'personal_reports'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS mode VARCHAR(20)', t);
    EXECUTE format(
      'UPDATE %I d SET mode = u.mode FROM users u WHERE u.id = d.user_id AND d.mode IS NULL', t);
    -- Страховка на случай осиротевшей строки: общий режим — дефолт приложения.
    EXECUTE format('UPDATE %I SET mode = ''general'' WHERE mode IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN mode SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN mode SET DEFAULT ''general''', t);
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_mode_check');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (mode IN (''behtereva'', ''general''))',
      t, t || '_mode_check');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (user_id, mode)', t || '_user_mode_idx', t);
  END LOOP;
END $$;

-- 3. Уникальные ключи: «один на пользователя» становится «один на режим».
--    Без этого план общего режима затёр бы план Бехтерева на тот же день.
--    Повторный прогон не должен падать: apply_all.sql идемпотентен, а у
--    ADD CONSTRAINT нет IF NOT EXISTS — поэтому проверяем по имени.
DO $$
DECLARE
  spec TEXT[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ['user_week_plan',   'user_week_plan_user_id_day_of_week_key',      'user_week_plan_user_mode_day_key',    '(user_id, mode, day_of_week)'],
    ['user_meals',       'user_meals_user_id_date_meal_type_key',       'user_meals_user_mode_date_type_key',  '(user_id, mode, date, meal_type)'],
    ['shopping_list',    'shopping_list_user_id_week_start_date_key',   'shopping_list_user_mode_week_key',    '(user_id, mode, week_start_date)'],
    ['personal_reports', 'personal_reports_user_id_period_number_key',  'personal_reports_user_mode_period_key', '(user_id, mode, period_number)']
  ] LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', spec[1], spec[2]);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = spec[3] AND conrelid = format('public.%I', spec[1])::regclass
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE %s', spec[1], spec[3], spec[4]);
    END IF;
  END LOOP;
END $$;

-- 4. Бэкофилл user_modes: у кого есть строка в users — тот своим режимом
--    уже занимается. Повторный прогон миграции ничего не задваивает.
INSERT INTO user_modes (user_id, mode, is_active)
SELECT id, mode, TRUE FROM users
ON CONFLICT (user_id, mode) DO NOTHING;

-- 5. Новые звуковые наборы (блок B): синтезируются кодом, лицензии не нужны.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_sound_pack_check;
ALTER TABLE users ADD CONSTRAINT users_sound_pack_check CHECK (sound_pack IN (
  'soft', 'energetic', 'minimal', 'nature', 'digital', 'warm', 'none'
));
