-- 0006: снимки прогресса и персональные отчёты (SPEC 2.3, 5.5).

CREATE TABLE IF NOT EXISTS user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC(5,1),
  shober_test_cm NUMERIC(4,1),
  stiffness_level INT CHECK (stiffness_level IS NULL OR stiffness_level BETWEEN 1 AND 10),
  workouts_this_week INT NOT NULL DEFAULT 0,
  streak_days INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

COMMENT ON TABLE user_progress IS 'Снимок прогресса. Снимается раз в неделю и при ручном вводе замеров';

CREATE INDEX IF NOT EXISTS idx_progress_user_date ON user_progress(user_id, date DESC);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personal_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_number INT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  flexibility_change_percent NUMERIC(5,2),
  weight_change_kg NUMERIC(5,2),
  stiffness_change INT,
  total_workouts INT NOT NULL DEFAULT 0,
  custom_workouts INT NOT NULL DEFAULT 0,
  side_effects_count INT NOT NULL DEFAULT 0,
  recommendation TEXT NOT NULL,
  adjustment_applied VARCHAR(30) NOT NULL,
  sent_to_telegram BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_number)
);

COMMENT ON TABLE personal_reports IS 'Персональные отчёты каждые 30 дней от даты регистрации пользователя, НЕ по календарным месяцам';
COMMENT ON COLUMN personal_reports.period_number IS 'Порядковый номер периода: 1 = первые 30 дней после регистрации';

CREATE INDEX IF NOT EXISTS idx_reports_user ON personal_reports(user_id, period_number DESC);

-- ---------------------------------------------------------------------------
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "progress_own" ON user_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "reports_read_own" ON personal_reports FOR SELECT TO authenticated
  USING (user_id = auth.uid());
