-- 0007: Decision Tree реакции на побочки (SPEC 5.2).
-- Правила живут в БД, а НЕ в коде — чтобы Роман правил их без деплоя.

CREATE TABLE IF NOT EXISTS side_effect_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symptom VARCHAR(30) NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  advice JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_workout_adjustment VARCHAR(30) NOT NULL
    CHECK (next_workout_adjustment IN (
      'none', 'reduce_intensity_10', 'reduce_intensity_20',
      'skip_joint', 'skip_exercise', 'lighter_only'
    )),
  skip_exercise BOOLEAN NOT NULL DEFAULT FALSE,
  require_doctor_visit_threshold INT NOT NULL DEFAULT 3,
  priority INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE side_effect_rules IS 'Decision Tree: симптом → советы + коррекция следующей тренировки (SPEC 5.2)';
COMMENT ON COLUMN side_effect_rules.conditions IS 'Доп. условия сопоставления: {"exercise_type":"main","target_joint":"spine"}. Пустой объект = правило общее';
COMMENT ON COLUMN side_effect_rules.advice IS 'JSON: [{"order":1,"text":"Прерви на 5 минут"}] — показывается пользователю по порядку';
COMMENT ON COLUMN side_effect_rules.require_doctor_visit_threshold IS 'Сколько событий за 7 дней до баннера «покажись врачу»';
COMMENT ON COLUMN side_effect_rules.priority IS 'Меньше — важнее. Выбирается правило с наименьшим priority среди подходящих';

CREATE INDEX IF NOT EXISTS idx_side_effect_rules_symptom ON side_effect_rules(symptom, priority);

ALTER TABLE side_effect_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "side_effect_rules_read_all" ON side_effect_rules FOR SELECT TO authenticated USING (TRUE);
