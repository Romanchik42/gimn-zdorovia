-- 0020 (GIMN-027): баллы за баги и идеи + статус отзыва.
--
-- Во время тестового периода приложение бесплатно, а вклад тестеров
-- копится баллами: подтверждённый баг, принятая идея, приглашённый друг.
-- К запуску платного тарифа баллы превращаются в дни подписки.
--
-- Почему две таблицы, а не одна колонка в users: нужен не только остаток,
-- но и за что начислено — человек должен видеть историю, иначе баллы
-- выглядят как число с потолка. Остаток держим отдельно, чтобы не считать
-- сумму по всей истории на каждый показ.

CREATE TABLE IF NOT EXISTS user_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_points IS 'Остаток баллов (0020). История — в points_history';

CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Отрицательное — списание при обмене на дни подписки.
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN points_history.amount IS 'Плюс — начисление, минус — обмен на дни подписки (0020)';

CREATE INDEX IF NOT EXISTS idx_points_history_user
  ON points_history(user_id, created_at DESC);

-- Защита от двойного начисления: за один и тот же отзыв или одного и того же
-- приглашённого баллы дают один раз. Частичный индекс — чтобы ручные
-- начисления без ссылки (бонусы) не мешали друг другу.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_ref
  ON points_history(user_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- RLS: свои баллы человек видит, менять их может только служебный ключ.
-- Политик на INSERT/UPDATE намеренно нет: начисление идёт с сервера.
-- ---------------------------------------------------------------------------
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_points" ON user_points;
CREATE POLICY "users_read_own_points" ON user_points
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "users_read_own_history" ON points_history;
CREATE POLICY "users_read_own_history" ON points_history
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Отзыв получает статус: пока он не подтверждён, баллы не начисляются.
-- points_awarded хранит, сколько уже дали, — чтобы пересмотр статуса
-- не начислил второй раз.
-- ---------------------------------------------------------------------------
ALTER TABLE feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS points_awarded INTEGER NOT NULL DEFAULT 0;

ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_status_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_status_check
  CHECK (status IN ('new', 'confirmed', 'in_plan', 'rejected'));

COMMENT ON COLUMN feedback.status IS
  'new — не разобрано, confirmed — баг подтверждён, in_plan — идея принята, rejected — отклонено (0020)';

NOTIFY pgrst, 'reload schema';
