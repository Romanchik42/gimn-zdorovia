-- 0008: реферальная система (SPEC 2.3, 5.7).

CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  referral_code VARCHAR(10) NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('link', 'qr', 'telegram', 'share', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE referrals IS 'Кто кого пригласил. Одна запись на приглашённого';
COMMENT ON COLUMN referrals.source IS 'Откуда пришёл: link (ссылка), qr (QR-код), telegram (бот), share (системный share)';

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id, created_at DESC);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code VARCHAR(10) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'link',
  user_agent TEXT,
  converted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE referral_clicks IS 'Переходы по реферальным ссылкам. IP НЕ сохраняем (152-ФЗ, минимизация ПДн)';

CREATE INDEX IF NOT EXISTS idx_referral_clicks_code ON referral_clicks(referral_code, created_at DESC);

-- ---------------------------------------------------------------------------
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_clicks ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только тех, кого пригласил САМ
CREATE POLICY "referrals_read_own" ON referrals FOR SELECT TO authenticated
  USING (referrer_id = auth.uid());

-- Админ видит всё
CREATE POLICY "referrals_admin_all" ON referrals FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "referral_clicks_admin" ON referral_clicks FOR SELECT TO authenticated
  USING (public.is_admin());
