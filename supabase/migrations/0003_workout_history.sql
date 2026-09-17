-- 0003: реальные тренировки, отметки по упражнениям, побочки (SPEC 2.1).

CREATE TABLE IF NOT EXISTS user_workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed', 'skipped')),
  generated_from_sequence_id UUID REFERENCES workout_sequences(id) ON DELETE SET NULL,
  custom_workout_id UUID,
  source VARCHAR(20) NOT NULL DEFAULT 'plan'
    CHECK (source IN ('plan', 'custom', 'template')),
  exercises_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_workouts IS 'Тренировка пользователя. Частично выполненная сохраняется со status=in_progress';
COMMENT ON COLUMN user_workouts.exercises_snapshot IS 'Копия упражнений на момент генерации — справочник может измениться позже';
COMMENT ON COLUMN user_workouts.source IS 'plan — из недельного плана, custom — собрана в конструкторе, template — из сохранённого шаблона';

CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON user_workouts(user_id, scheduled_date DESC);
CREATE INDEX IF NOT EXISTS idx_workouts_user_status ON user_workouts(user_id, status);

CREATE TRIGGER user_workouts_updated_at BEFORE UPDATE ON user_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_workout_id UUID NOT NULL REFERENCES user_workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('done', 'difficult', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Одно упражнение в одной тренировке отмечается один раз (переотметка = UPSERT).
  UNIQUE (user_workout_id, exercise_id)
);

COMMENT ON TABLE workout_feedback IS 'Отметки ✅ done / ⚠️ difficult / ❌ skipped по каждому упражнению';

CREATE INDEX IF NOT EXISTS idx_feedback_user ON workout_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_workout ON workout_feedback(user_workout_id);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS side_effect_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_workout_id UUID REFERENCES user_workouts(id) ON DELETE CASCADE,
  exercise_id UUID REFERENCES exercises(id) ON DELETE SET NULL,
  symptom VARCHAR(30) NOT NULL
    CHECK (symptom IN ('pressure_up', 'headache', 'cramp', 'joint_pain', 'nausea', 'dizziness', 'other')),
  description TEXT,
  action_taken VARCHAR(20) NOT NULL DEFAULT 'paused'
    CHECK (action_taken IN ('continued', 'paused', 'stopped')),
  applied_adjustment VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE side_effect_events IS 'Побочки во время тренировки. 3 события за 7 дней → баннер «покажись врачу» (SPEC 5.2)';
COMMENT ON COLUMN side_effect_events.applied_adjustment IS 'Что система решила применить к следующей тренировке';

CREATE INDEX IF NOT EXISTS idx_side_effects_user_date ON side_effect_events(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE user_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE side_effect_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workouts_own" ON user_workouts FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "feedback_own" ON workout_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "side_effects_own" ON side_effect_events FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
