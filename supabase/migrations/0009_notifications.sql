-- 0009: журнал отправленных уведомлений (SPEC 2.1).

CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL
    CHECK (type IN ('morning_reminder', 'evening_reminder', 'personal_report', 'doctor_advice', 'other')),
  channel VARCHAR(20) NOT NULL DEFAULT 'telegram'
    CHECK (channel IN ('telegram', 'push', 'email')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE notifications_log IS 'Журнал уведомлений. Крон смотрит сюда, чтобы не слать одно и то же дважды за день';

CREATE INDEX IF NOT EXISTS idx_notifications_user_date ON notifications_log(user_id, type, sent_at DESC);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_read_own" ON notifications_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
