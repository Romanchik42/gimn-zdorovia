-- 0023 (GIMN-028): дозировка упражнений и факт выполнения.
--
-- До сих пор упражнение описывалось как «столько-то секунд» или
-- «столько-то повторов», и этого хватало для гимнастики: сделал круг и
-- пошёл дальше. Силовая работа так не описывается — там подходы, отдых
-- между ними и вес. Без этих полей занятие в зале нельзя ни назначить,
-- ни честно посчитать по времени.
--
-- Две таблицы, потому что это разные вещи:
--   exercise_dosage — что делать (справочник, одинаков для всех);
--   workout_sets    — что человек сделал (его данные, основа прогрессии).
--
-- Дозировка зависит от уровня и режима: новичку 3 подхода по 8, среднему
-- 4 по 8, продвинутому 5 по 5. Поэтому ключ — тройка (упражнение, уровень,
-- режим), а не одно упражнение.

CREATE TABLE IF NOT EXISTS exercise_dosage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  level VARCHAR(20) NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),

  -- Гимнастика: один круг, время или повторы.
  duration_sec INT CHECK (duration_sec IS NULL OR duration_sec > 0),
  repetitions INT CHECK (repetitions IS NULL OR repetitions > 0),
  rest_sec INT CHECK (rest_sec IS NULL OR rest_sec >= 0),

  -- Силовые: подходы, повторы в подходе, отдых между подходами.
  sets INT CHECK (sets IS NULL OR sets BETWEEN 1 AND 10),
  reps_per_set INT CHECK (reps_per_set IS NULL OR reps_per_set BETWEEN 1 AND 50),
  rest_between_sets_sec INT CHECK (rest_between_sets_sec IS NULL OR rest_between_sets_sec BETWEEN 0 AND 600),
  -- Доля от одноповторного максимума. NULL — вес подбирается по самочувствию.
  weight_pct_1rm REAL CHECK (weight_pct_1rm IS NULL OR weight_pct_1rm BETWEEN 0 AND 1),
  -- С чего начать, если истории ещё нет: пустой гриф, лёгкая гантель.
  weight_kg_default REAL CHECK (weight_kg_default IS NULL OR weight_kg_default >= 0),

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (exercise_id, level, mode),
  -- Строка без дозировки бессмысленна: либо круг, либо подходы.
  CONSTRAINT dosage_has_prescription
    CHECK (duration_sec IS NOT NULL OR repetitions IS NOT NULL OR sets IS NOT NULL)
);

COMMENT ON TABLE exercise_dosage IS 'Что делать: подходы и повторы по уровню и режиму (0023)';
COMMENT ON COLUMN exercise_dosage.weight_kg_default IS 'С чего начать, когда истории ещё нет (0023)';

CREATE INDEX IF NOT EXISTS idx_dosage_lookup ON exercise_dosage(exercise_id, level, mode);

-- ---------------------------------------------------------------------------
-- Факт: что человек реально сделал. Отсюда растёт вес и уровень.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Без ссылки на тренировку: подход можно записать и вне занятия.
  user_workout_id UUID REFERENCES user_workouts(id) ON DELETE SET NULL,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  set_number INT NOT NULL CHECK (set_number BETWEEN 1 AND 20),
  reps INT NOT NULL CHECK (reps BETWEEN 0 AND 100),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg BETWEEN 0 AND 500),
  -- Насколько тяжело по ощущению, 1-10. Нужнее веса: у многих упражнений веса нет.
  rpe INT CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Один и тот же подход не записывается дважды: перезапись — это UPSERT.
  UNIQUE (user_id, exercise_id, date, set_number)
);

COMMENT ON TABLE workout_sets IS 'Факт: подходы, повторы и вес. Основа прогрессии (0023)';
COMMENT ON COLUMN workout_sets.rpe IS 'Тяжесть по ощущению 1-10. Важнее веса там, где веса нет (0023)';

CREATE INDEX IF NOT EXISTS idx_sets_user_date ON workout_sets(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_sets_user_exercise ON workout_sets(user_id, exercise_id, date DESC);

-- ---------------------------------------------------------------------------
-- RLS. Дозировка — справочник, её читают все вошедшие. Подходы — свои.
-- Правка и удаление своих подходов разрешены намеренно: опечатка в весе
-- иначе осталась бы навсегда и тянула бы за собой всю прогрессию.
-- ---------------------------------------------------------------------------
ALTER TABLE exercise_dosage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dosage_read_all" ON exercise_dosage;
CREATE POLICY "dosage_read_all" ON exercise_dosage
  FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "sets_own" ON workout_sets;
CREATE POLICY "sets_own" ON workout_sets
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
