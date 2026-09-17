-- 0004: недельный план и сохранённые пользовательские тренировки (SPEC 2.3).

CREATE TABLE IF NOT EXISTS user_week_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  focus VARCHAR(30) NOT NULL,
  duration_min INT NOT NULL CHECK (duration_min BETWEEN 10 AND 120),
  intensity VARCHAR(10) NOT NULL CHECK (intensity IN ('low', 'medium', 'high')),
  is_rest_day BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_of_week)
);

COMMENT ON TABLE user_week_plan IS 'Недельный план: какая группа мышц в какой день. Создаётся автоматически при онбординге, редактируется пользователем';
COMMENT ON COLUMN user_week_plan.is_custom IS 'TRUE если пользователь изменил рекомендованный день вручную';

CREATE TRIGGER user_week_plan_updated_at BEFORE UPDATE ON user_week_plan
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_custom_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  focus VARCHAR(30) NOT NULL,
  duration_min INT NOT NULL,
  intensity VARCHAR(10) NOT NULL CHECK (intensity IN ('low', 'medium', 'high')),
  exercises_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  times_used INT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_custom_workouts IS 'Шаблоны тренировок, собранные пользователем в конструкторе. Лимит 20 на пользователя проверяется в API';
COMMENT ON COLUMN user_custom_workouts.exercises_order IS 'JSON: [{"exercise_id":"uuid","order":1,"duration_sec":30,"repetitions":null}]';

CREATE INDEX IF NOT EXISTS idx_custom_workouts_user ON user_custom_workouts(user_id, last_used_at DESC);

CREATE TRIGGER user_custom_workouts_updated_at BEFORE UPDATE ON user_custom_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
ALTER TABLE user_week_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_custom_workouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "week_plan_own" ON user_week_plan FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "custom_workouts_own" ON user_custom_workouts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
