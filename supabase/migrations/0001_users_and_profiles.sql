-- 0001: профили пользователей, диагностика Бехтерева, анкета общего режима.
-- Источник: SPEC 2.1, 2.2.

-- Общий триггер для updated_at — используется всеми таблицами ниже.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at() IS 'Проставляет updated_at = now() при UPDATE';

-- ---------------------------------------------------------------------------
-- users
-- ВАЖНО: id ссылается на auth.users(id) и НЕ имеет собственного default.
-- Без этого auth.uid() в политиках RLS не совпадёт с users.id, и вся
-- модель доступа (user_id = auth.uid()) в дочерних таблицах не работает.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_id BIGINT UNIQUE,
  telegram_username VARCHAR(100),
  email VARCHAR(200) UNIQUE,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),

  -- Оформление
  theme VARCHAR(20) NOT NULL DEFAULT 'sage'
    CHECK (theme IN ('sage', 'terracotta', 'ocean')),
  auto_theme BOOLEAN NOT NULL DEFAULT FALSE,

  -- Звук
  sounds_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sound_pack VARCHAR(20) NOT NULL DEFAULT 'soft'
    CHECK (sound_pack IN ('soft', 'energetic', 'minimal', 'none')),
  sound_volume INT NOT NULL DEFAULT 70 CHECK (sound_volume BETWEEN 0 AND 100),

  -- Напоминания
  morning_reminder_time TIME NOT NULL DEFAULT '07:00',
  evening_reminder_time TIME NOT NULL DEFAULT '18:00',
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Ознакомительный тур
  tour_completed BOOLEAN NOT NULL DEFAULT FALSE,
  tour_completed_at TIMESTAMPTZ,
  workout_tour_completed BOOLEAN NOT NULL DEFAULT FALSE,

  -- Рефералы
  referral_code VARCHAR(10) NOT NULL UNIQUE,
  referred_by UUID REFERENCES users(id) ON DELETE SET NULL,
  referred_at TIMESTAMPTZ,

  -- Персональный цикл отчётов
  registered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_report_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),

  -- Админ
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Профиль пользователя. id совпадает с auth.users.id';
COMMENT ON COLUMN users.referral_code IS 'Личный код приглашения, 6 символов A-Z0-9 без похожих (0/O, 1/I)';
COMMENT ON COLUMN users.referred_by IS 'Кто пригласил этого пользователя (NULL если пришёл сам)';
COMMENT ON COLUMN users.next_report_date IS 'Дата следующего персонального отчёта: registered_at + N*30 дней';
COMMENT ON COLUMN users.sound_pack IS 'Набор звуков: soft (мягкий), energetic (бодрый), minimal (минимальный), none (без звука)';
COMMENT ON COLUMN users.is_admin IS 'Доступ к /admin/stats. В MVP — только Роман';

CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_next_report ON users(next_report_date) WHERE reminders_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id);

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- user_diagnostics — диагностика при болезни Бехтерева
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shober_test_cm NUMERIC(4,1),
  side_bend_left_cm NUMERIC(4,1),
  side_bend_right_cm NUMERIC(4,1),
  rotation_degrees INT,
  pain_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  stiffness_level VARCHAR(10) CHECK (stiffness_level IN ('low', 'medium', 'high')),
  blood_pressure_ok BOOLEAN,
  calculated_intensity VARCHAR(10) NOT NULL CHECK (calculated_intensity IN ('low', 'medium', 'normal')),
  calculated_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_diagnostics IS 'Результаты диагностики Бехтерева. Каждое прохождение — новая строка, актуальна последняя';
COMMENT ON COLUMN user_diagnostics.pain_areas IS 'JSON-массив зон боли: ["neck","shoulder","spine","hips","legs"]';
COMMENT ON COLUMN user_diagnostics.calculated_intensity IS 'Рассчитанная интенсивность программы (SPEC 3.2)';
COMMENT ON COLUMN user_diagnostics.calculated_focus IS 'JSON-массив приоритетных зон для проработки';

CREATE INDEX IF NOT EXISTS idx_diagnostics_user ON user_diagnostics(user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- user_profiles_general — анкета режима «общая форма»
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_profiles_general (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  weight_kg NUMERIC(5,1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  height_cm NUMERIC(5,1) NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  goal VARCHAR(10) NOT NULL CHECK (goal IN ('lose', 'gain', 'maintain')),
  activity_level VARCHAR(20) NOT NULL
    CHECK (activity_level IN ('sedentary', 'light', 'medium', 'high', 'very_high')),
  difficulty VARCHAR(20) NOT NULL
    CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  training_days JSONB NOT NULL DEFAULT '[1,3,5]'::jsonb,
  calculated_bmr INT NOT NULL,
  calculated_tdee INT NOT NULL,
  calculated_target_calories INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles_general IS 'Анкета общего режима + расчёт калорий по Миффлину-Сан-Жеору (SPEC 5.1)';
COMMENT ON COLUMN user_profiles_general.training_days IS 'JSON-массив дней недели, 1 = понедельник';

CREATE TRIGGER user_profiles_general_updated_at BEFORE UPDATE ON user_profiles_general
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles_general ENABLE ROW LEVEL SECURITY;

-- Проверка админа вынесена в SECURITY DEFINER функцию намеренно:
-- политика на users, читающая users напрямую, даёт бесконечную рекурсию RLS.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((SELECT u.is_admin FROM public.users u WHERE u.id = auth.uid()), FALSE);
$$;

COMMENT ON FUNCTION public.is_admin() IS 'TRUE если текущий пользователь админ. SECURITY DEFINER — обходит RLS, иначе политика на users рекурсивна';

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE POLICY "users_select_own" ON users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Админ видит всех (для /admin/stats)
CREATE POLICY "users_admin_select" ON users FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "diagnostics_own" ON user_diagnostics FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_general_own" ON user_profiles_general FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
