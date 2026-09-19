-- 0014: углублённая диагностика, конструктор цветов, фото профиля, отзывы (GIMN-011).

-- 1. Углублённая диагностика. Ответы — JSONB: список вопросов и вариантов
--    живёт в одном месте (src/lib/diagnostics/extended.ts), сервер проверяет
--    их Zod-схемой оттуда же. NULL — человек углублённый опрос не проходил.
ALTER TABLE user_diagnostics ADD COLUMN IF NOT EXISTS extended_answers JSONB;
ALTER TABLE user_diagnostics ADD COLUMN IF NOT EXISTS extended_completed_at TIMESTAMPTZ;

-- 2. Упражнения: положение тела и «щадящее» (микроамплитуда / изометрика).
--    По положению подбор убирает то, что человеку недоступно; щадящие
--    упражнения получают зоны с ограничением подвижности.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS position VARCHAR(20) NOT NULL DEFAULT 'any';
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_position_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_position_check CHECK (position IN (
  'any', 'standing', 'standing_free', 'sitting', 'sitting_floor', 'kneeling', 'quadruped', 'supine', 'prone', 'side'
));
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS gentle BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Категория блюда — для иконки в карточке меню.
ALTER TABLE meals ADD COLUMN IF NOT EXISTS category VARCHAR(20)
  CHECK (category IN ('porridge', 'meat', 'fish', 'vegetables', 'dairy', 'soup', 'eggs', 'fruit'));

-- 4. Оформление: ещё 4 готовые палитры, своя палитра, тон инфо-табличек.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_theme_check;
ALTER TABLE users ADD CONSTRAINT users_theme_check CHECK (theme IN (
  'sage', 'terracotta', 'ocean', 'lavender', 'sand', 'mint', 'graphite'
));
-- {bg, text, card: '#RRGGBB', glow: bool, glow_strength: 0-100}; NULL — только тема.
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_theme JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS info_card_tint VARCHAR(20) NOT NULL DEFAULT 'neutral';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_info_card_tint_check;
ALTER TABLE users ADD CONSTRAINT users_info_card_tint_check CHECK (info_card_tint IN (
  'neutral', 'blue', 'sage', 'coral', 'sand', 'lavender'
));
-- Своё фото профиля. Пишет только сервер после проверки файла (service_role),
-- поэтому права на колонку у authenticated нет.
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

GRANT UPDATE (custom_theme, info_card_tint) ON public.users TO authenticated;

-- 5. Отзывы / ошибки / идеи. Пользователь пишет и видит своё, админ — всё.
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(10) NOT NULL CHECK (type IN ('review', 'bug', 'idea')),
  text TEXT NOT NULL CHECK (char_length(text) BETWEEN 3 AND 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_created_idx ON feedback (created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feedback_insert_own" ON feedback;
CREATE POLICY "feedback_insert_own" ON feedback FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "feedback_select_own" ON feedback;
CREATE POLICY "feedback_select_own" ON feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

REVOKE UPDATE, DELETE ON feedback FROM anon, authenticated;

-- 6. Хранилище фото профиля. Публичное чтение (аватар и так виден в
--    приложении), запись — только сервером после проверки размера и типа.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
