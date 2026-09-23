-- 0024 (GIMN-028): обхваты, процент жира и пульс покоя.
--
-- Отдельная таблица body_measurements НЕ заводится: замеры уже есть —
-- user_progress с весом, тестом Шобера и скованностью, по одной строке на
-- день и уникальным ключом (пользователь, дата). Вторая таблица означала
-- бы вес в двух местах: графики прогресса читают user_progress и новых
-- замеров просто не увидели бы, а человек не понимал бы, почему вес,
-- введённый в одном разделе, не виден в другом.
--
-- Поэтому к существующей строке добавляются недостающие колонки.
-- Все необязательные: большинство людей взвешивается, но сантиметром
-- себя не меряет, и требовать обхваты ради записи веса незачем.

ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS chest_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS waist_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS hips_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS bicep_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS thigh_cm NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS body_fat_pct NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS resting_hr INT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Границы такие же, как в форме: значение вне их — почти наверняка
-- опечатка, а не рекорд. Пропускать такое в базу нельзя: на замерах
-- строятся графики и прогрессия.
ALTER TABLE user_progress DROP CONSTRAINT IF EXISTS user_progress_measurements_check;
ALTER TABLE user_progress ADD CONSTRAINT user_progress_measurements_check CHECK (
  (chest_cm IS NULL OR chest_cm BETWEEN 40 AND 200) AND
  (waist_cm IS NULL OR waist_cm BETWEEN 40 AND 200) AND
  (hips_cm IS NULL OR hips_cm BETWEEN 40 AND 200) AND
  (bicep_cm IS NULL OR bicep_cm BETWEEN 15 AND 80) AND
  (thigh_cm IS NULL OR thigh_cm BETWEEN 25 AND 120) AND
  (body_fat_pct IS NULL OR body_fat_pct BETWEEN 3 AND 60) AND
  (resting_hr IS NULL OR resting_hr BETWEEN 30 AND 140)
);

COMMENT ON COLUMN user_progress.body_fat_pct IS 'Процент жира, если человек его знает (0024)';
COMMENT ON COLUMN user_progress.resting_hr IS 'Пульс покоя утром, ударов в минуту (0024)';
COMMENT ON COLUMN user_progress.notes IS 'Заметка к замеру: самочувствие, обстоятельства (0024)';

NOTIFY pgrst, 'reload schema';
