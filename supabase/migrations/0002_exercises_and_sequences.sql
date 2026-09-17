-- 0002: справочники упражнений и шаблонов последовательностей (SPEC 2.1).
-- Это read-only справочники: пишет в них только service_role (он обходит RLS).

CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('breathing', 'warmup', 'main', 'stretch', 'massage')),
  target_joint VARCHAR(20) NOT NULL
    CHECK (target_joint IN ('spine', 'shoulder', 'neck', 'legs', 'hips', 'core', 'full_body')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general', 'both')),
  description TEXT NOT NULL,
  technique TEXT NOT NULL,
  gif_url TEXT,
  duration_sec INT CHECK (duration_sec IS NULL OR duration_sec > 0),
  repetitions INT CHECK (repetitions IS NULL OR repetitions > 0),
  level VARCHAR(20) NOT NULL DEFAULT 'beginner'
    CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  contraindications JSONB NOT NULL DEFAULT '[]'::jsonb,
  side_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Упражнение задаётся либо временем, либо повторами, но хотя бы чем-то одним.
  CONSTRAINT exercises_duration_or_reps CHECK (duration_sec IS NOT NULL OR repetitions IS NOT NULL)
);

COMMENT ON TABLE exercises IS 'Справочник упражнений. Пополняется через Supabase Studio или seed';
COMMENT ON COLUMN exercises.slug IS 'Стабильный человекочитаемый ключ — на него ссылается seed последовательностей';
COMMENT ON COLUMN exercises.contraindications IS 'JSON-массив меток: ["high_blood_pressure","shoulder_pain",...]';
COMMENT ON COLUMN exercises.side_effects IS 'JSON: [{"trigger":"pressure_up","action":"reduce_intensity"}]';
COMMENT ON COLUMN exercises.gif_url IS 'GIF/картинка. Пока NULL — карточка показывает плейсхолдер и текстовую технику';

CREATE INDEX IF NOT EXISTS idx_exercises_mode ON exercises(mode);
CREATE INDEX IF NOT EXISTS idx_exercises_joint ON exercises(target_joint);
CREATE INDEX IF NOT EXISTS idx_exercises_type ON exercises(type);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS workout_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  focus_joint VARCHAR(30) NOT NULL,
  intensity VARCHAR(10) NOT NULL CHECK (intensity IN ('low', 'medium', 'normal')),
  exercises_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_duration_min INT NOT NULL CHECK (total_duration_min BETWEEN 5 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE workout_sequences IS 'Шаблоны последовательностей на день (SPEC 5.4). Подбираются по mode + day_of_week + intensity';
COMMENT ON COLUMN workout_sequences.exercises_order IS 'JSON: [{"slug":"...","order":1,"duration_sec":30,"repetitions":null}]';

CREATE INDEX IF NOT EXISTS idx_sequences_lookup ON workout_sequences(mode, day_of_week, intensity);

-- ---------------------------------------------------------------------------
-- RLS: справочники читают все залогиненные, пишет только service_role.
-- ---------------------------------------------------------------------------
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercises_read_all" ON exercises FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "sequences_read_all" ON workout_sequences FOR SELECT TO authenticated USING (TRUE);
