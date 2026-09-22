-- ============================================================================
-- ВСЁ ОДНИМ ФАЙЛОМ: миграции 0001-0018 + seed + перезагрузка схемы PostgREST.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
-- Применять ОДИН раз на пустую БД: Supabase → SQL Editor → вставить → Run.
-- ============================================================================

-- >>> 0001_users_and_profiles.sql
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

-- >>> 0002_exercises_and_sequences.sql
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

-- >>> 0003_workout_history.sql
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

-- >>> 0004_custom_workouts.sql
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

-- >>> 0005_nutrition.sql
-- 0005: справочник блюд, меню пользователя, список покупок (SPEC 2.1, 5.3).

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  meal_type VARCHAR(20) NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_kcal INT NOT NULL CHECK (total_kcal > 0),
  total_protein_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  total_fat_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  total_carbs_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  cook_time_min INT NOT NULL DEFAULT 15,
  recipe TEXT NOT NULL,
  contraindications JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE meals IS 'Справочник блюд из топ-30 доступных продуктов (SPEC 5.3)';
COMMENT ON COLUMN meals.ingredients IS 'JSON: [{"product":"Овсянка","grams":60,"kcal":228}]';

CREATE INDEX IF NOT EXISTS idx_meals_type ON meals(meal_type);
CREATE INDEX IF NOT EXISTS idx_meals_kcal ON meals(meal_type, total_kcal);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, meal_type)
);

COMMENT ON TABLE user_meals IS 'Меню пользователя на конкретную дату. Одно блюдо на приём пищи';

CREATE INDEX IF NOT EXISTS idx_user_meals_date ON user_meals(user_id, date);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

COMMENT ON TABLE shopping_list IS 'Список покупок на неделю, агрегированный из меню';
COMMENT ON COLUMN shopping_list.items IS 'JSON: [{"product":"Куриная грудка","grams":1400,"purchased":false}]';

CREATE TRIGGER shopping_list_updated_at BEFORE UPDATE ON shopping_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals_read_all" ON meals FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "user_meals_own" ON user_meals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "shopping_list_own" ON shopping_list FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- >>> 0006_progress_and_reports.sql
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

-- >>> 0007_side_effect_rules.sql
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

-- >>> 0008_referrals.sql
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

-- >>> 0009_notifications.sql
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

-- >>> 0010_meal_portions.sql
-- 0010: порция блюда в меню.
-- Одно блюдо на приём пищи даёт 1000-1800 ккал в день, а норма по Миффлину
-- бывает и 3000+. Попасть в «норма ±5%» (US-07) без масштабирования порций
-- невозможно, поэтому граммы рецепта умножаются на portion.

ALTER TABLE user_meals
  ADD COLUMN IF NOT EXISTS portion NUMERIC(3,2) NOT NULL DEFAULT 1.00
    CHECK (portion BETWEEN 0.50 AND 2.50);

COMMENT ON COLUMN user_meals.portion IS 'Множитель порции: граммы и ккал рецепта умножаются на него. 1.00 = как в рецепте';

-- >>> 0011_users_column_privileges.sql
-- 0011: пользователь может менять только «свои» колонки профиля.
--
-- Политика users_update_own (0001) разрешает UPDATE своей строки целиком.
-- Anon-ключ публичен, поэтому из консоли браузера можно было бы выполнить
--   supabase.from('users').update({ is_admin: true }).eq('id', <свой id>)
-- и получить админку (а с ней — чтение всех пользователей через
-- users_admin_select), или подменить referred_by / referral_code.
--
-- RLS отвечает на вопрос «какие строки», а права на колонки — «какие поля».
-- Поэтому снимаем общее право UPDATE и выдаём его только на поля, которые
-- пользователь правит сам. Всё остальное меняет только service_role
-- (серверные роуты и кроны), который эти ограничения не затрагивают.

REVOKE UPDATE ON public.users FROM anon, authenticated;

GRANT UPDATE (
  name,
  theme,
  auto_theme,
  sounds_enabled,
  sound_pack,
  sound_volume,
  morning_reminder_time,
  evening_reminder_time,
  reminders_enabled,
  tour_completed,
  tour_completed_at,
  workout_tour_completed
) ON public.users TO authenticated;

COMMENT ON POLICY "users_update_own" ON public.users IS
  'Своя строка. Какие колонки можно менять — ограничено GRANT UPDATE (...) в 0011';

-- >>> 0012_telegram_chats.sql
-- 0012: одно «домашнее» сообщение бота на чат.
--
-- Бот держит в чате одно короткое сообщение с кнопкой «Открыть приложение».
-- При повторном /start прежнее удаляется и ставится новое — чат не зарастает
-- приветствиями. Чтобы знать, что удалять, храним id этого сообщения.
--
-- Чат может принадлежать ещё не зарегистрированному человеку, поэтому ключ —
-- chat_id, а не user_id. Пишет и читает только сервер (service_role):
-- RLS включена, политик нет, у anon/authenticated прав нет.

CREATE TABLE IF NOT EXISTS telegram_chats (
  chat_id BIGINT PRIMARY KEY,
  home_message_id BIGINT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON telegram_chats FROM anon, authenticated;

-- >>> 0013_profile_length_symptoms.sql
-- 0013: профиль без почты для входа, длина занятия, «Просто тяжело», чистый чат.

-- 1. «Просто тяжело» не сохранялось: CHECK на symptom не знал just_hard,
--    хотя правила для него в side_effect_rules есть с самого начала.
ALTER TABLE side_effect_events DROP CONSTRAINT IF EXISTS side_effect_events_symptom_check;
ALTER TABLE side_effect_events ADD CONSTRAINT side_effect_events_symptom_check
  CHECK (symptom IN ('pressure_up', 'headache', 'cramp', 'joint_pain', 'nausea', 'dizziness', 'just_hard', 'other'));

-- 2. «В прошлый раз здесь было…» показываем один раз — когда упражнение
--    снова встретится. Отметка ставится в момент показа.
ALTER TABLE side_effect_events ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;

-- 3. Профиль. Вход — только Telegram; почта и телефон — по желанию, для связи.
--    workout_length: short (4-5 упр.), medium (7-8), full (весь план).
--    NULL — ещё не выбирал: берём по диагностике (тяжёлая — short, иначе medium).
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS workout_length VARCHAR(10)
  CHECK (workout_length IN ('short', 'medium', 'full'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(60);

GRANT UPDATE (email, phone, workout_length, avatar) ON public.users TO authenticated;

-- 4. Сообщения бота о тренировке удаляются, когда человек перешёл в приложение
--    (меню — остаются). Храним их id, чтобы знать, что удалять.
ALTER TABLE telegram_chats ADD COLUMN IF NOT EXISTS workout_message_ids BIGINT[] NOT NULL DEFAULT '{}';

-- >>> 0014_diagnostics_theme_feedback.sql
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

-- >>> 0015_user_modes.sql
-- 0015 (GIMN-012): несколько режимов на пользователя, данные режимов раздельно.
--
-- Было: users.mode — единственный режим, все данные лежат на user_id без
-- различения. Переключить режим означало бы смешать программы в одну кучу.
--
-- Стало:
--   * user_modes — какими режимами человек реально занимается;
--   * users.mode — ТЕКУЩИЙ выбранный режим (какой показывается сейчас);
--     имя колонки не меняем: на неё завязано два десятка мест, а смысл
--     «режим, в котором человек сейчас» у неё и был;
--   * колонка mode у режимозависимых данных + уникальные ключи с ней.
--
-- Ничего не удаляем: переключение режима — это смена users.mode, данные
-- обоих режимов лежат рядом. Существующие строки бэкофиллим текущим режимом
-- их владельца ДО NOT NULL, иначе потеряли бы данные двух реальных людей.
--
-- user_progress сознательно оставлен общим: вес, скованность и тест Шобера —
-- замеры тела, а тело у человека одно. График регулярности на той же странице
-- считается из user_workouts и потому режимом уже разделён.
-- user_diagnostics (только Бехтерева) и user_profiles_general (только общий)
-- сами по себе принадлежат режиму — колонка им не нужна.

-- 1. Какими режимами человек занимается.
CREATE TABLE IF NOT EXISTS user_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),
  -- FALSE = режим только посмотрели, анкету не заполняли.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mode)
);

CREATE INDEX IF NOT EXISTS user_modes_user_idx ON user_modes (user_id);

ALTER TABLE user_modes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_modes_select_own" ON user_modes;
CREATE POLICY "user_modes_select_own" ON user_modes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "user_modes_insert_own" ON user_modes;
CREATE POLICY "user_modes_insert_own" ON user_modes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_modes_update_own" ON user_modes;
CREATE POLICY "user_modes_update_own" ON user_modes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Отключить режим = снять is_active. Удалять строку нечем и незачем:
-- вместе с ней потерялась бы дата, с которой человек этим занимается.
REVOKE DELETE ON user_modes FROM anon, authenticated;

COMMENT ON TABLE user_modes IS
  'Режимы, которыми занимается пользователь (GIMN-012). Текущий выбранный — users.mode';

-- 2. Режимозависимые данные получают колонку mode.
--    Порядок важен: добавить NULL-колонку → бэкофилл → NOT NULL.
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'user_workouts', 'user_week_plan', 'user_custom_workouts',
    'user_meals', 'shopping_list', 'personal_reports'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS mode VARCHAR(20)', t);
    EXECUTE format(
      'UPDATE %I d SET mode = u.mode FROM users u WHERE u.id = d.user_id AND d.mode IS NULL', t);
    -- Страховка на случай осиротевшей строки: общий режим — дефолт приложения.
    EXECUTE format('UPDATE %I SET mode = ''general'' WHERE mode IS NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN mode SET NOT NULL', t);
    EXECUTE format('ALTER TABLE %I ALTER COLUMN mode SET DEFAULT ''general''', t);
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', t, t || '_mode_check');
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I CHECK (mode IN (''behtereva'', ''general''))',
      t, t || '_mode_check');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (user_id, mode)', t || '_user_mode_idx', t);
  END LOOP;
END $$;

-- 3. Уникальные ключи: «один на пользователя» становится «один на режим».
--    Без этого план общего режима затёр бы план Бехтерева на тот же день.
--    Повторный прогон не должен падать: apply_all.sql идемпотентен, а у
--    ADD CONSTRAINT нет IF NOT EXISTS — поэтому проверяем по имени.
DO $$
DECLARE
  spec TEXT[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ['user_week_plan',   'user_week_plan_user_id_day_of_week_key',      'user_week_plan_user_mode_day_key',    '(user_id, mode, day_of_week)'],
    ['user_meals',       'user_meals_user_id_date_meal_type_key',       'user_meals_user_mode_date_type_key',  '(user_id, mode, date, meal_type)'],
    ['shopping_list',    'shopping_list_user_id_week_start_date_key',   'shopping_list_user_mode_week_key',    '(user_id, mode, week_start_date)'],
    ['personal_reports', 'personal_reports_user_id_period_number_key',  'personal_reports_user_mode_period_key', '(user_id, mode, period_number)']
  ] LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', spec[1], spec[2]);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = spec[3] AND conrelid = format('public.%I', spec[1])::regclass
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I UNIQUE %s', spec[1], spec[3], spec[4]);
    END IF;
  END LOOP;
END $$;

-- 4. Бэкофилл user_modes: у кого есть строка в users — тот своим режимом
--    уже занимается. Повторный прогон миграции ничего не задваивает.
INSERT INTO user_modes (user_id, mode, is_active)
SELECT id, mode, TRUE FROM users
ON CONFLICT (user_id, mode) DO NOTHING;

-- 5. Новые звуковые наборы (блок B): синтезируются кодом, лицензии не нужны.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_sound_pack_check;
ALTER TABLE users ADD CONSTRAINT users_sound_pack_check CHECK (sound_pack IN (
  'soft', 'energetic', 'minimal', 'nature', 'digital', 'warm', 'none'
));

-- >>> 0016_exercise_images.sql
-- 0016 (GIMN-013): визуал на каждое упражнение.
--
-- Было: картинка только у 8 упражнений из 61 (колонка gif_url), остальные
-- показывали знак своего типа. Стало: живая картинка там, где нашлось точное
-- совпадение движения, и рисованная схема со стрелками — всем остальным.
--
-- Схемы не хранятся в базе: они рисуются кодом по slug
-- (src/components/exercise/exercise-scheme.tsx), поэтому колонок им не нужно.
-- В базу добавляем только адрес живой картинки и подпись об источнике —
-- атрибуция требуется лицензией Pixabay.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_credit VARCHAR(40);

COMMENT ON COLUMN exercises.image_url IS
  'Статичная картинка движения (GIMN-013). Показывается, если нет gif_url';
COMMENT ON COLUMN exercises.image_credit IS
  'Источник картинки для подписи в карточке, например Pixabay';

-- Отобраны вручную и отсмотрены глазами: движение совпадает с нашей техникой.
-- Файлы скачаны в public/exercises/ (хотлинк запрещён лицензией Pixabay),
-- источники — в docs/IMAGE_SOURCES.md.
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp', image_credit = 'Pixabay'
WHERE slug IN ('gen-plank', 'gen-pushup', 'main-hip-abduction', 'stretch-child-pose');

-- >>> 0017_equipment_turnik.sql
-- 0017 (GIMN-014): турник и брусья в общем режиме.
--
-- Было: справочник рассчитан на занятия без снаряда — дома, на коврике.
-- Стало: у упражнения появился признак нужного снаряда, а у анкеты общего
-- режима — вопрос «есть ли турник». Подбор смотрит на оба: без турника
-- турниковые упражнения не показываются вовсе, «могу найти» — показываются
-- последними и с пометкой, что нужен снаряд.
--
-- Почему флаг живёт в user_profiles_general, а не в отдельной таблице
-- настроек: это ответ анкеты общего режима, рядом с целью, активностью
-- и уровнем подготовки. Отдельная таблица на одну колонку означала бы
-- ещё один запрос и ещё один набор RLS-политик без единой выгоды.

-- 1. Нужный снаряд. 'none' — как было у всех 61 упражнения, поэтому DEFAULT
--    именно такой: старые строки остаются доступными всем без бэкофилла.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN ('none', 'pullup_bar', 'dip_bars'));

COMMENT ON COLUMN exercises.equipment IS
  'Нужный снаряд: none — ничего, pullup_bar — турник, dip_bars — брусья (0017)';

CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

-- 2. Ответ анкеты. 'no' по умолчанию — у кого турника нет, ничего не меняется;
--    те, кто анкету уже заполнил, турниковых упражнений не получат, пока
--    сами не ответят «да». Это осознанно: молча выдать подтягивания человеку,
--    который про турник не спрашивал, хуже, чем не выдать.
ALTER TABLE user_profiles_general ADD COLUMN IF NOT EXISTS has_turnik VARCHAR(10) NOT NULL DEFAULT 'no';
ALTER TABLE user_profiles_general DROP CONSTRAINT IF EXISTS user_profiles_general_has_turnik_check;
ALTER TABLE user_profiles_general ADD CONSTRAINT user_profiles_general_has_turnik_check
  CHECK (has_turnik IN ('yes', 'no', 'maybe'));

COMMENT ON COLUMN user_profiles_general.has_turnik IS
  'Есть ли турник: yes — есть, no — нет, maybe — «могу найти» (0017)';

-- RLS не трогаем: политика profiles_general_own стоит FOR ALL на всю строку,
-- колоночных грантов у этой таблицы нет — новая колонка наследует права.

-- >>> 0018_wger_images.sql
-- 0018 (GIMN-015): картинки движения с wger.
--
-- Было: живая картинка у 12 упражнений из 76, остальным — рисованная схема.
-- Стало: ещё 14, в том числе всем шести турниковым, где движение сложное
-- и схема объясняет его хуже фотографии.
--
-- Источник — wger.de, открытая база тренировок: 374 картинки под Creative
-- Commons, публичный API без ключа. Отобраны вручную и отсмотрены глазами:
-- взяты только те, где движение совпадает с нашей техникой. Musclewiki и
-- ExRx не подошли — оба закрыты от машинного доступа, и их условия
-- использования не разрешают брать картинки к себе.
--
-- Лицензия CC BY-SA требует назвать автора, поэтому image_credit хранит
-- «wger, <автор> (CC BY-SA 4.0)» — карточка печатает это под картинкой.
-- Полные ссылки на файлы — в docs/IMAGE_SOURCES.md и в scripts/fetch-wger-images.mjs.
--
-- Файлы скачаны в public/exercises/<slug>.webp: хотлинк на чужой сервер
-- означал бы, что картинки исчезнут в тот день, когда wger переедет.

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger (CC BY-SA 4.0)'
WHERE slug IN ('bar-knee-raise', 'bar-leg-raise', 'gen-jumping-jacks',
               'warmup-neck-tilts', 'warmup-neck-turns', 'main-bridge', 'gen-glute-bridge');

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Imobard (CC BY-SA 4.0)'
WHERE slug = 'bar-pullup-overhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Everkinetic (CC BY-SA 3.0)'
WHERE slug = 'bar-pullup-underhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, cshep442 (CC BY-SA 4.0)'
WHERE slug = 'dip-pushup';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Gavru (CC BY-SA 4.0)'
WHERE slug = 'bar-australian-row';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, utkb (CC BY-SA 4.0)'
WHERE slug = 'main-bird-dog';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Davidgj32 (CC BY-SA 4.0)'
WHERE slug IN ('main-hip-flexor-stretch', 'stretch-piriformis');

-- >>> seed.sql
-- ===========================================================================
-- seed.sql — начальное наполнение справочников.
-- Применяется ПОСЛЕ всех миграций 0001..0009.
-- Идемпотентен: повторный прогон ничего не дублирует (ON CONFLICT DO NOTHING).
--
-- Содержимое упражнений собрано по общедоступным рекомендациям ASAS/EULAR
-- по ЛФК при аксиальном спондилоартрите: низкоударные движения, работа на
-- подвижность и осанку, без осевой нагрузки и без крайних амплитуд.
-- Это вспомогательный материал, не медицинское назначение (SPEC 5.9).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ: режим «Бехтерева» (35)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects) VALUES

-- Дыхание (4)
('breath-diaphragm', 'Диафрагмальное дыхание', 'breathing', 'core', 'behtereva',
 'Успокаивает, задаёт ритм занятия и раскрывает грудную клетку.',
 E'1. Лягте на спину, колени согнуты, стопы на полу.\n2. Одна ладонь на груди, вторая на животе.\n3. Вдох носом 4 счёта — поднимается ладонь на животе, грудь почти неподвижна.\n4. Выдох ртом 6 счётов, живот мягко опускается.\n5. Дышите ровно, без натуживания.',
 180, NULL, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"reduce_intensity"}]'::jsonb),

('breath-chest-expand', 'Дыхание с раскрытием рёбер', 'breathing', 'spine', 'behtereva',
 'Поддерживает подвижность рёберно-позвоночных суставов — при Бехтерева это ключевое.',
 E'1. Сядьте прямо, ладони на нижние рёбра сбоку.\n2. Вдох — направляйте воздух в ладони, рёбра расходятся в стороны.\n3. Выдох — рёбра мягко сходятся.\n4. Плечи остаются опущенными.',
 180, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('breath-square', 'Дыхание по квадрату', 'breathing', 'core', 'behtereva',
 'Снимает напряжение перед основной частью.',
 E'1. Вдох на 4 счёта.\n2. Задержка на 4 счёта.\n3. Выдох на 4 счёта.\n4. Пауза на 4 счёта.\n5. При головокружении уберите задержки.',
 120, NULL, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('breath-cooldown', 'Дыхание на расслабление', 'breathing', 'full_body', 'behtereva',
 'Завершает занятие, переводит тело в режим восстановления.',
 E'1. Лягте на спину, руки вдоль тела ладонями вверх.\n2. Вдох 4 счёта, выдох 8 счётов.\n3. С каждым выдохом отпускайте плечи, челюсть, ладони.',
 180, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Разминка и самомассаж (7)
('warmup-neck-turns', 'Повороты головы', 'warmup', 'neck', 'behtereva',
 'Мягко возвращает подвижность шейному отделу.',
 E'1. Сядьте или встаньте прямо, плечи опущены.\n2. Медленно поверните голову вправо до комфортного предела, задержитесь 2 секунды.\n3. Вернитесь в центр, поверните влево.\n4. Без рывков, амплитуда — до первого натяжения, не до боли.',
 NULL, 10, 'beginner', '["acute_neck_pain"]'::jsonb, '[{"trigger":"dizziness","action":"reduce_intensity"}]'::jsonb),

('warmup-neck-tilts', 'Наклоны головы к плечу', 'warmup', 'neck', 'behtereva',
 'Растягивает боковые мышцы шеи, снимает утреннюю скованность.',
 E'1. Сидя прямо, опустите правое плечо вниз.\n2. Мягко наклоните голову к левому плечу.\n3. Держите 15 секунд, дышите ровно.\n4. Повторите в другую сторону.',
 NULL, 6, 'beginner', '["acute_neck_pain"]'::jsonb, '[]'::jsonb),

('warmup-shoulder-rolls', 'Круги плечами', 'warmup', 'shoulder', 'behtereva',
 'Разогревает плечевой пояс перед основной частью.',
 E'1. Руки свободно опущены.\n2. Поднимите плечи вверх, отведите назад, опустите вниз — круг назад.\n3. Сделайте 10 кругов назад, затем 10 вперёд.\n4. Движение плавное, шея расслаблена.',
 NULL, 20, 'beginner', '[]'::jsonb, '[]'::jsonb),

('warmup-pelvic-tilt', 'Наклоны таза лёжа', 'warmup', 'hips', 'behtereva',
 'Пробуждает поясницу и мышцы кора без нагрузки на позвоночник.',
 E'1. Лягте на спину, колени согнуты.\n2. На выдохе прижмите поясницу к полу, таз чуть подкручивается.\n3. На вдохе отпустите, поясница естественно приподнимается.\n4. Работает только таз, ягодицы не отрываются.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('massage-suboccipital', 'Самомассаж основания черепа', 'massage', 'neck', 'behtereva',
 'Снимает напряжение в месте крепления мышц шеи к черепу.',
 E'1. Положите большие пальцы в ямки под затылочными буграми.\n2. Круговыми движениями массируйте 60 секунд.\n3. Давление — до приятного напряжения, не до боли.',
 60, NULL, 'beginner', '[]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb),

('massage-paravertebral', 'Самомассаж мышц вдоль позвоночника', 'massage', 'spine', 'behtereva',
 'Разогревает паравертебральные мышцы перед мобилизацией.',
 E'1. Костяшками или теннисным мячом у стены пройдите вдоль мышц по обе стороны позвоночника.\n2. Снизу вверх, 60-90 секунд.\n3. Сам позвоночник (остистые отростки) не массируйте.',
 90, NULL, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('massage-glutes-ball', 'Самомассаж ягодичных мячом', 'massage', 'hips', 'behtereva',
 'Расслабляет ягодичные мышцы, которые при Бехтерева часто перенапряжены.',
 E'1. Сядьте на мяч, перенесите вес на одну ягодицу.\n2. Медленно перекатывайтесь, задерживаясь на плотных участках по 10-15 секунд.\n3. По 60 секунд на сторону.',
 120, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Позвоночник: основная работа (10)
('main-cat-cow', 'Кошка-корова', 'main', 'spine', 'behtereva',
 'Базовая мобилизация всего позвоночника в сгибание и разгибание.',
 E'1. Встаньте на четвереньки: ладони под плечами, колени под тазом.\n2. Вдох — прогиб: грудь вперёд, копчик вверх, взгляд чуть вперёд.\n3. Выдох — округление: подбородок к груди, поясница вверх.\n4. Двигайтесь медленно, по одному позвонку.',
 NULL, 12, 'beginner', '["acute_back_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_exercise"}]'::jsonb),

('main-thoracic-rotation', 'Ротация грудного отдела', 'main', 'spine', 'behtereva',
 'Возвращает вращение грудному отделу — первое, что теряется при Бехтерева.',
 E'1. На четвереньках положите правую ладонь на затылок.\n2. Выдох — раскройте локоть вверх, поворачивая грудь к потолку.\n3. Вдох — верните локоть под себя.\n4. По 8 раз на сторону, таз неподвижен.',
 NULL, 16, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-side-bend-standing', 'Боковые наклоны стоя', 'main', 'spine', 'behtereva',
 'Поддерживает боковую подвижность — один из показателей диагностики.',
 E'1. Встаньте прямо, стопы на ширине таза.\n2. Скользите ладонью вдоль бедра вниз, наклоняясь строго вбок.\n3. Не наклоняйтесь вперёд и не разворачивайте корпус.\n4. Задержитесь 3 секунды, вернитесь.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-wall-posture', 'Выравнивание у стены', 'main', 'spine', 'behtereva',
 'Противодействует формированию сутулой осанки.',
 E'1. Встаньте спиной к стене: пятки, таз, лопатки и затылок касаются стены.\n2. Затылок тянется вверх, подбородок чуть к себе.\n3. Удерживайте 30 секунд, дышите ровно.\n4. Если затылок не достаёт — не запрокидывайте голову, оставьте зазор.',
 30, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-prone-extension', 'Разгибание лёжа на животе', 'main', 'spine', 'behtereva',
 'Прямо противодействует наклону корпуса вперёд.',
 E'1. Лягте на живот, ладони под плечами.\n2. На выдохе мягко приподнимите грудь, опираясь на предплечья.\n3. Поясница не проваливается, ягодицы расслаблены.\n4. Задержитесь 5 секунд, опуститесь.',
 NULL, 8, 'beginner', '["acute_back_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_exercise"}]'::jsonb),

('main-swimmer', 'Пловец лёжа', 'main', 'spine', 'behtereva',
 'Укрепляет разгибатели спины без осевой нагрузки.',
 E'1. Лягте на живот, руки вытянуты вперёд.\n2. Поднимите правую руку и левую ногу на 5-10 см.\n3. Задержитесь 3 секунды, опустите.\n4. Смените сторону. Шея продолжает линию позвоночника.',
 NULL, 16, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-bridge', 'Ягодичный мостик', 'main', 'hips', 'behtereva',
 'Укрепляет ягодицы и заднюю цепь, разгружает поясницу.',
 E'1. Лягте на спину, колени согнуты, стопы на ширине таза.\n2. На выдохе поднимите таз до линии колени-таз-плечи.\n3. Задержитесь 3 секунды, медленно опуститесь.\n4. Поднимайте за счёт ягодиц, а не поясницы.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-dead-bug', 'Жук', 'main', 'core', 'behtereva',
 'Учит держать нейтральную поясницу — база для защиты позвоночника.',
 E'1. Лягте на спину, руки вверх, колени над тазом под углом 90 градусов.\n2. Прижмите поясницу к полу.\n3. Выдох — опустите правую руку за голову и левую ногу вперёд.\n4. Вдох — вернитесь. Поясница всё время прижата.',
 NULL, 12, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-bird-dog', 'Птица-собака', 'main', 'core', 'behtereva',
 'Стабилизация корпуса и тренировка равновесия.',
 E'1. На четвереньках вытяните правую руку вперёд и левую ногу назад.\n2. Держите таз ровно, без заваливания.\n3. Удержание 5 секунд, затем смена стороны.',
 NULL, 12, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-knee-to-chest', 'Колени к груди', 'main', 'spine', 'behtereva',
 'Мягко разгружает поясницу, снимает утреннюю скованность.',
 E'1. Лягте на спину.\n2. Подтяните оба колена к груди, обхватив руками.\n3. Покачайтесь вправо-влево 15 секунд.\n4. Дышите свободно, не задерживайте дыхание.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Плечи и руки (5)
('main-shoulder-wall-slide', 'Скольжение руками по стене', 'main', 'shoulder', 'behtereva',
 'Восстанавливает подъём рук и раскрывает грудной отдел.',
 E'1. Встаньте спиной к стене, предплечья прижаты к стене.\n2. Медленно скользите руками вверх, не отрывая предплечья.\n3. Поднимайтесь до предела, где контакт сохраняется.\n4. Медленно вернитесь.',
 NULL, 10, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_joint"}]'::jsonb),

('main-shoulder-external', 'Наружная ротация плеча', 'main', 'shoulder', 'behtereva',
 'Укрепляет вращательную манжету, поддерживает правильную осанку.',
 E'1. Прижмите локти к бокам, предплечья вперёд.\n2. Разведите предплечья наружу, сводя лопатки.\n3. Задержитесь 2 секунды, вернитесь.\n4. С резинкой — при отсутствии боли.',
 NULL, 14, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('main-scapula-squeeze', 'Сведение лопаток', 'main', 'shoulder', 'behtereva',
 'Активирует межлопаточные мышцы, которые ослабевают при сутулости.',
 E'1. Сядьте или встаньте прямо, руки вдоль тела.\n2. Сведите лопатки, как будто держите между ними карандаш.\n3. Удержание 5 секунд, расслабление.\n4. Плечи не поднимаются к ушам.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-arm-circles', 'Круги прямыми руками', 'main', 'shoulder', 'behtereva',
 'Прорабатывает полную амплитуду плечевого сустава.',
 E'1. Разведите прямые руки в стороны на уровне плеч.\n2. Небольшие круги вперёд 15 раз, назад 15 раз.\n3. При усталости опустите руки и продолжите после паузы.',
 NULL, 30, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('main-chest-opener-doorway', 'Раскрытие груди в дверном проёме', 'main', 'shoulder', 'behtereva',
 'Растягивает грудные мышцы, которые тянут плечи вперёд.',
 E'1. Встаньте в дверной проём, предплечья на косяках, локти на уровне плеч.\n2. Сделайте небольшой шаг вперёд до натяжения в груди.\n3. Держите 30 секунд, дышите ровно.\n4. Не прогибайтесь в пояснице.',
 60, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

-- Ноги и таз (5)
('main-hip-flexor-stretch', 'Растяжка подвздошно-поясничной', 'main', 'hips', 'behtereva',
 'Укороченные сгибатели бедра усиливают наклон корпуса вперёд.',
 E'1. Встаньте в выпад: одно колено на полу, второе впереди под 90 градусов.\n2. Подкрутите таз под себя, ягодицу задней ноги напрягите.\n3. Мягко подайтесь вперёд до натяжения спереди бедра.\n4. 30 секунд на сторону.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('main-hip-abduction', 'Отведение ноги лёжа на боку', 'main', 'hips', 'behtereva',
 'Укрепляет средние ягодичные — стабилизаторы таза при ходьбе.',
 E'1. Лягте на бок, нижняя нога согнута для устойчивости.\n2. Поднимите верхнюю прямую ногу на 30-40 см.\n3. Опускайте медленно, не роняя.\n4. По 12 раз на сторону.',
 NULL, 24, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-mini-squat', 'Неглубокий присед у опоры', 'main', 'legs', 'behtereva',
 'Поддерживает силу ног без осевой нагрузки на позвоночник.',
 E'1. Держитесь за спинку стула.\n2. Присядьте на 30-40 градусов, колени по направлению стоп.\n3. Спина прямая, вес на пятках.\n4. Вернитесь, не выпрямляя колени до упора.',
 NULL, 12, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('main-heel-raises', 'Подъёмы на носки', 'main', 'legs', 'behtereva',
 'Улучшает кровообращение в голенях и укрепляет стопу.',
 E'1. Встаньте у опоры, стопы на ширине таза.\n2. Поднимитесь на носки, задержитесь 2 секунды.\n3. Медленно опуститесь.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-hamstring-stretch', 'Растяжка задней поверхности бедра', 'main', 'legs', 'behtereva',
 'Освобождает таз — укороченные мышцы задней поверхности тянут его назад.',
 E'1. Лягте на спину, одну ногу поднимите вверх.\n2. Обхватите бедро руками или используйте ремень.\n3. Тяните ногу к себе прямой до натяжения, 30 секунд.\n4. Вторая нога остаётся на полу.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Растяжка и завершение (4)
('stretch-child-pose', 'Поза ребёнка', 'stretch', 'spine', 'behtereva',
 'Мягко вытягивает поясницу после основной части.',
 E'1. Сядьте на пятки, колени разведите.\n2. Наклонитесь вперёд, вытяните руки.\n3. Лоб на полу или на подушке.\n4. Дышите в спину 60 секунд.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('stretch-supine-twist', 'Скручивание лёжа', 'stretch', 'spine', 'behtereva',
 'Ротационная растяжка позвоночника в разгруженном положении.',
 E'1. Лягте на спину, руки в стороны.\n2. Согните колени и мягко опустите их вправо.\n3. Голову поверните влево.\n4. 30 секунд, затем в другую сторону.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('stretch-piriformis', 'Растяжка грушевидной мышцы', 'stretch', 'hips', 'behtereva',
 'Снимает напряжение в глубине ягодицы, частое при Бехтерева.',
 E'1. Лягте на спину, положите щиколотку правой ноги на левое колено.\n2. Обхватите левое бедро и подтяните к себе.\n3. 30 секунд на сторону, без рывков.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('stretch-full-body', 'Вытяжение всего тела', 'stretch', 'full_body', 'behtereva',
 'Финальное вытяжение, закрепляет ощущение роста в длину.',
 E'1. Лягте на спину, руки за голову.\n2. Потянитесь руками вверх, стопами вниз.\n3. Держите 10 секунд, расслабьтесь. Повторите 3 раза.',
 45, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ: режим «Общая форма» (15)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects) VALUES

('gen-jumping-jacks', 'Прыжки со сменой рук и ног', 'warmup', 'full_body', 'general',
 'Быстро поднимает пульс и разогревает всё тело.',
 E'1. Встаньте прямо, руки вдоль тела.\n2. В прыжке разведите ноги и поднимите руки над головой.\n3. Вторым прыжком вернитесь в исходное.\n4. Приземляйтесь мягко на носок.',
 NULL, 30, 'beginner', '["knee_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('gen-arm-swings', 'Махи руками', 'warmup', 'shoulder', 'general',
 'Разогревает плечевой пояс перед силовой частью.',
 E'1. Встаньте прямо, руки в стороны.\n2. Скрестите руки перед грудью, затем разведите назад.\n3. Темп средний, без рывков.',
 NULL, 20, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-squat', 'Приседания', 'main', 'legs', 'general',
 'Базовое упражнение на ноги и ягодицы.',
 E'1. Стопы на ширине плеч, носки чуть наружу.\n2. Отведите таз назад и присядьте до параллели бёдер с полом.\n3. Колени идут по направлению носков.\n4. Спина прямая, пятки на полу.',
 NULL, 15, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-lunges', 'Выпады', 'main', 'legs', 'general',
 'Нагружает ноги по одной, развивает равновесие.',
 E'1. Сделайте шаг вперёд.\n2. Опуститесь, пока оба колена не согнутся под 90 градусов.\n3. Переднее колено не выходит за носок.\n4. Оттолкнитесь передней ногой и вернитесь.',
 NULL, 20, 'intermediate', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-pushup', 'Отжимания', 'main', 'shoulder', 'general',
 'Базовое упражнение на грудь, плечи и трицепс.',
 E'1. Упор лёжа, ладони чуть шире плеч.\n2. Корпус прямой от пяток до макушки.\n3. Опуститесь до угла 90 градусов в локтях.\n4. Новичкам — с колен или от опоры.',
 NULL, 12, 'intermediate', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('gen-plank', 'Планка', 'main', 'core', 'general',
 'Статическая нагрузка на весь корпус.',
 E'1. Упор на предплечья и носки.\n2. Тело в одну линию, таз не проваливается и не задирается.\n3. Живот подтянут, дыхание ровное.\n4. Держите заданное время.',
 45, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-side-plank', 'Боковая планка', 'main', 'core', 'general',
 'Прорабатывает косые мышцы живота.',
 E'1. Лягте на бок, упор на предплечье под плечом.\n2. Поднимите таз, тело в одну линию.\n3. Удержание по 30 секунд на сторону.',
 60, NULL, 'intermediate', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('gen-crunch', 'Скручивания на пресс', 'main', 'core', 'general',
 'Прорабатывает прямую мышцу живота.',
 E'1. Лягте на спину, колени согнуты, руки у висков.\n2. На выдохе оторвите лопатки от пола.\n3. Поясница прижата, шея не тянется руками.\n4. Медленно опуститесь.',
 NULL, 20, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('gen-superman', 'Лодочка', 'main', 'spine', 'general',
 'Укрепляет мышцы-разгибатели спины.',
 E'1. Лягте на живот, руки вытянуты вперёд.\n2. Одновременно поднимите руки, грудь и ноги.\n3. Задержитесь 3 секунды и опуститесь.',
 NULL, 12, 'intermediate', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('gen-glute-bridge', 'Ягодичный мостик (общий)', 'main', 'hips', 'general',
 'Основное упражнение на ягодицы.',
 E'1. Лягте на спину, колени согнуты, стопы на ширине таза.\n2. На выдохе поднимите таз до прямой линии колени-таз-плечи.\n3. Сожмите ягодицы вверху на 2 секунды.\n4. Опуститесь, не касаясь пола до конца.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-row-band', 'Тяга резинки к поясу', 'main', 'shoulder', 'general',
 'Прорабатывает широчайшие и середину спины.',
 E'1. Закрепите резинку на уровне пояса, возьмите концы.\n2. Тяните локти назад, сводя лопатки.\n3. Плечи опущены, корпус неподвижен.\n4. Медленно вернитесь.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-mountain-climbers', 'Скалолаз', 'main', 'full_body', 'general',
 'Кардио и нагрузка на корпус одновременно.',
 E'1. Упор лёжа, корпус прямой.\n2. Поочерёдно подтягивайте колени к груди в темпе.\n3. Таз не задирайте.',
 40, NULL, 'intermediate', '["knee_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('gen-step-touch', 'Приставные шаги', 'main', 'full_body', 'general',
 'Лёгкое кардио для дней с низкой интенсивностью.',
 E'1. Шаг вправо, приставьте левую ногу.\n2. Шаг влево, приставьте правую.\n3. Добавьте движения руками.\n4. Держите ровный темп.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-stretch-quads', 'Растяжка передней поверхности бедра', 'stretch', 'legs', 'general',
 'Восстановление после нагрузки на ноги.',
 E'1. Стоя у опоры, согните ногу и возьмите стопу рукой.\n2. Подтяните пятку к ягодице, колени рядом.\n3. 30 секунд на сторону.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-stretch-full', 'Общая растяжка', 'stretch', 'full_body', 'general',
 'Завершает тренировку и снижает крепатуру.',
 E'1. Наклон вперёд к прямым ногам — 30 секунд.\n2. Растяжка груди в проёме — 30 секунд.\n3. Скручивание лёжа — по 30 секунд на сторону.',
 120, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- DECISION TREE: правила реакции на побочки (SPEC 5.2)
-- Правило с меньшим priority выигрывает среди подходящих по conditions.
-- ---------------------------------------------------------------------------

INSERT INTO side_effect_rules (symptom, conditions, advice, next_workout_adjustment, skip_exercise, require_doctor_visit_threshold, priority) VALUES

('pressure_up', '{}'::jsonb,
 '[{"order":1,"text":"Прерви тренировку на 5 минут."},
   {"order":2,"text":"Сядь с приподнятой головой, не ложись плашмя."},
   {"order":3,"text":"Измерь давление, если есть тонометр."},
   {"order":4,"text":"Пей воду мелкими глотками."},
   {"order":5,"text":"Если через 15 минут не легчает — заканчивай занятие."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('pressure_up', '{"exercise_type":"breathing"}'::jsonb,
 '[{"order":1,"text":"Убери задержки дыхания — оставь только вдох и выдох."},
   {"order":2,"text":"Дыши в обычном ритме 2 минуты."},
   {"order":3,"text":"Продолжай, только если стало легче."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 5),

('headache', '{}'::jsonb,
 '[{"order":1,"text":"Отдохни 3 минуты."},
   {"order":2,"text":"Проверь осанку: плечи опущены, шея не запрокинута."},
   {"order":3,"text":"Самомассаж основания черепа (точка GB20) — 1 минута."},
   {"order":4,"text":"Пей воду."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('headache', '{"target_joint":"neck"}'::jsonb,
 '[{"order":1,"text":"Останови упражнения на шею на сегодня."},
   {"order":2,"text":"Уменьши амплитуду поворотов вдвое в следующий раз."},
   {"order":3,"text":"Самомассаж основания черепа — 1 минута."}]'::jsonb,
 'skip_joint', TRUE, 3, 5),

('cramp', '{}'::jsonb,
 '[{"order":1,"text":"Прерви упражнение."},
   {"order":2,"text":"Медленно растяни сведённую мышцу и держи 30 секунд."},
   {"order":3,"text":"Пей воду, лучше с электролитами."},
   {"order":4,"text":"Проверь технику — судорога часто от перенапряжения."}]'::jsonb,
 'lighter_only', FALSE, 3, 10),

('cramp', '{"target_joint":"legs"}'::jsonb,
 '[{"order":1,"text":"Потяни икру: носок на себя, нога прямая, 30 секунд."},
   {"order":2,"text":"Разотри мышцу ладонью снизу вверх."},
   {"order":3,"text":"Следующую тренировку начни с более длинной разминки."}]'::jsonb,
 'lighter_only', FALSE, 3, 5),

('joint_pain', '{}'::jsonb,
 '[{"order":1,"text":"Останови это упражнение."},
   {"order":2,"text":"Острая боль — это сигнал стоп, а не повод потерпеть."},
   {"order":3,"text":"Мы исключим его из следующей тренировки."},
   {"order":4,"text":"Если боль держится дольше суток — покажись врачу."}]'::jsonb,
 'skip_exercise', TRUE, 2, 10),

('joint_pain', '{"target_joint":"shoulder"}'::jsonb,
 '[{"order":1,"text":"Останови упражнение и опусти руки."},
   {"order":2,"text":"Плечо не любит работу через боль."},
   {"order":3,"text":"Следующую тренировку проведём без нагрузки на плечи."}]'::jsonb,
 'skip_joint', TRUE, 2, 5),

('joint_pain', '{"target_joint":"spine"}'::jsonb,
 '[{"order":1,"text":"Останови упражнение, ляг на спину с согнутыми коленями."},
   {"order":2,"text":"Полежи 2 минуты, дыши в живот."},
   {"order":3,"text":"Следующая тренировка будет мягче."}]'::jsonb,
 'reduce_intensity_20', TRUE, 2, 5),

('nausea', '{}'::jsonb,
 '[{"order":1,"text":"Останови тренировку."},
   {"order":2,"text":"Отдохни 15 минут, дыши медленно и ровно."},
   {"order":3,"text":"Проветри комнату."},
   {"order":4,"text":"Если не проходит — обратись к врачу."}]'::jsonb,
 'lighter_only', FALSE, 2, 10),

('dizziness', '{}'::jsonb,
 '[{"order":1,"text":"Сядь или ляг, не вставай резко."},
   {"order":2,"text":"Подыши ровно 2 минуты без задержек."},
   {"order":3,"text":"Выпей воды."},
   {"order":4,"text":"Продолжай только если полностью прошло."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('dizziness', '{"exercise_type":"breathing"}'::jsonb,
 '[{"order":1,"text":"Это частая реакция на непривычное дыхание."},
   {"order":2,"text":"Вернись к обычному ритму, убери задержки и счёт."},
   {"order":3,"text":"В следующий раз сократи дыхательный блок вдвое."}]'::jsonb,
 'reduce_intensity_10', FALSE, 4, 5),

('just_hard', '{}'::jsonb,
 '[{"order":1,"text":"Нормально, если тяжело — значит работаешь."},
   {"order":2,"text":"Снизим нагрузку в следующий раз."},
   {"order":3,"text":"Отдохни 60 секунд и продолжай в своём темпе."}]'::jsonb,
 'reduce_intensity_10', FALSE, 99, 10),

('just_hard', '{"exercise_type":"main"}'::jsonb,
 '[{"order":1,"text":"Сделай меньше повторов, но с правильной техникой."},
   {"order":2,"text":"Качество важнее количества."},
   {"order":3,"text":"В следующий раз начнём с меньшего объёма."}]'::jsonb,
 'reduce_intensity_10', FALSE, 99, 5),

('other', '{}'::jsonb,
 '[{"order":1,"text":"Прерви занятие и оцени самочувствие."},
   {"order":2,"text":"Если что-то ощущается неправильно — останови тренировку."},
   {"order":3,"text":"Опиши симптом в заметке, это поможет в отчёте."}]'::jsonb,
 'reduce_intensity_10', FALSE, 3, 10);

-- ---------------------------------------------------------------------------
-- ШАБЛОНЫ ПОСЛЕДОВАТЕЛЬНОСТЕЙ: 7 дней × 2 режима (SPEC 5.4)
-- exercises_order ссылается на exercises.slug — стабильно между окружениями.
-- Поле intensity здесь базовое; генератор подгоняет его под диагностику
-- пользователя, поэтому строка на день недели одна (SPEC 3.3).
-- Структура дня Бехтерева: дыхание → разминка и массаж → основное → растяжка.
-- ---------------------------------------------------------------------------

INSERT INTO workout_sequences (slug, mode, day_of_week, focus_joint, intensity, total_duration_min, exercises_order) VALUES

('beh-mon-spine', 'behtereva', 1, 'spine', 'normal', 45, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-neck-turns","repetitions":10},
  {"order":3,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":4,"slug":"massage-paravertebral","duration_sec":90},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-thoracic-rotation","repetitions":16},
  {"order":7,"slug":"main-side-bend-standing","repetitions":12},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"main-prone-extension","repetitions":8},
  {"order":10,"slug":"main-bird-dog","repetitions":12},
  {"order":11,"slug":"stretch-child-pose","duration_sec":60},
  {"order":12,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":13,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-tue-shoulders', 'behtereva', 2, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"breath-chest-expand","duration_sec":180},
  {"order":2,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":3,"slug":"warmup-neck-tilts","repetitions":6},
  {"order":4,"slug":"massage-suboccipital","duration_sec":60},
  {"order":5,"slug":"main-shoulder-wall-slide","repetitions":10},
  {"order":6,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":7,"slug":"main-shoulder-external","repetitions":14},
  {"order":8,"slug":"main-arm-circles","repetitions":30},
  {"order":9,"slug":"main-wall-posture","duration_sec":30},
  {"order":10,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":11,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":12,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-wed-thoracic', 'behtereva', 3, 'spine_thoracic', 'normal', 40, '[
  {"order":1,"slug":"breath-chest-expand","duration_sec":180},
  {"order":2,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":3,"slug":"massage-paravertebral","duration_sec":90},
  {"order":4,"slug":"main-cat-cow","repetitions":12},
  {"order":5,"slug":"main-thoracic-rotation","repetitions":16},
  {"order":6,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":7,"slug":"main-swimmer","repetitions":16},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"stretch-child-pose","duration_sec":60},
  {"order":10,"slug":"stretch-full-body","duration_sec":45},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-thu-legs-hips', 'behtereva', 4, 'hips', 'normal', 40, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":3,"slug":"massage-glutes-ball","duration_sec":120},
  {"order":4,"slug":"main-bridge","repetitions":12},
  {"order":5,"slug":"main-hip-abduction","repetitions":24},
  {"order":6,"slug":"main-mini-squat","repetitions":12},
  {"order":7,"slug":"main-heel-raises","repetitions":15},
  {"order":8,"slug":"main-hip-flexor-stretch","duration_sec":60},
  {"order":9,"slug":"main-hamstring-stretch","duration_sec":60},
  {"order":10,"slug":"stretch-piriformis","duration_sec":60},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-fri-lumbar', 'behtereva', 5, 'spine_lumbar', 'normal', 40, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":3,"slug":"massage-paravertebral","duration_sec":90},
  {"order":4,"slug":"main-knee-to-chest","duration_sec":60},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-dead-bug","repetitions":12},
  {"order":7,"slug":"main-bridge","repetitions":12},
  {"order":8,"slug":"main-prone-extension","repetitions":8},
  {"order":9,"slug":"stretch-piriformis","duration_sec":60},
  {"order":10,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-sat-combined', 'behtereva', 6, 'full_body', 'low', 35, '[
  {"order":1,"slug":"breath-square","duration_sec":120},
  {"order":2,"slug":"warmup-neck-turns","repetitions":10},
  {"order":3,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":4,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-side-bend-standing","repetitions":12},
  {"order":7,"slug":"main-bridge","repetitions":12},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"stretch-child-pose","duration_sec":60},
  {"order":10,"slug":"stretch-full-body","duration_sec":45},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-sun-rest', 'behtereva', 7, 'breathing', 'low', 12, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"breath-chest-expand","duration_sec":180},
  {"order":3,"slug":"main-knee-to-chest","duration_sec":60},
  {"order":4,"slug":"stretch-full-body","duration_sec":45},
  {"order":5,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('gen-mon-legs', 'general', 1, 'legs', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-squat","repetitions":15},
  {"order":4,"slug":"gen-lunges","repetitions":20},
  {"order":5,"slug":"gen-glute-bridge","repetitions":15},
  {"order":6,"slug":"main-heel-raises","repetitions":15},
  {"order":7,"slug":"gen-stretch-quads","duration_sec":60},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-tue-back', 'general', 2, 'spine', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-row-band","repetitions":15},
  {"order":4,"slug":"gen-superman","repetitions":12},
  {"order":5,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"stretch-child-pose","duration_sec":60},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-wed-chest', 'general', 3, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-pushup","repetitions":12},
  {"order":4,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":5,"slug":"main-shoulder-external","repetitions":14},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-thu-cardio-core', 'general', 4, 'core', 'normal', 35, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-mountain-climbers","duration_sec":40},
  {"order":3,"slug":"gen-crunch","repetitions":20},
  {"order":4,"slug":"gen-side-plank","duration_sec":60},
  {"order":5,"slug":"gen-plank","duration_sec":45},
  {"order":6,"slug":"main-dead-bug","repetitions":12},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-fri-shoulders', 'general', 5, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"gen-arm-swings","repetitions":20},
  {"order":2,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":3,"slug":"main-arm-circles","repetitions":30},
  {"order":4,"slug":"gen-row-band","repetitions":15},
  {"order":5,"slug":"main-shoulder-external","repetitions":14},
  {"order":6,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-sat-full', 'general', 6, 'full_body', 'normal', 45, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-squat","repetitions":15},
  {"order":3,"slug":"gen-pushup","repetitions":12},
  {"order":4,"slug":"gen-row-band","repetitions":15},
  {"order":5,"slug":"gen-mountain-climbers","duration_sec":40},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"gen-glute-bridge","repetitions":15},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-sun-rest', 'general', 7, 'stretch', 'low', 20, '[
  {"order":1,"slug":"gen-step-touch","duration_sec":60},
  {"order":2,"slug":"gen-stretch-quads","duration_sec":60},
  {"order":3,"slug":"main-hamstring-stretch","duration_sec":60},
  {"order":4,"slug":"stretch-piriformis","duration_sec":60},
  {"order":5,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":6,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- БЛЮДА (40): 10 завтраков, 12 обедов, 10 ужинов, 8 полдников.
-- Только продукты из топ-30 (SPEC 5.3). КБЖУ — на порцию.
-- ---------------------------------------------------------------------------

INSERT INTO meals (slug, name, meal_type, ingredients, total_kcal, total_protein_g, total_fat_g, total_carbs_g, cook_time_min, recipe, contraindications) VALUES

-- ЗАВТРАКИ (10)
('br-oatmeal-banana', 'Овсянка на молоке с бананом', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Молоко 1.5%","grams":200,"kcal":90},{"product":"Банан","grams":100,"kcal":89}]'::jsonb,
 407, 15.0, 8.0, 68.0, 10,
 E'1. Залейте 60 г овсянки 200 мл молока.\n2. Варите на среднем огне 5-7 минут, помешивая.\n3. Снимите с огня, дайте постоять 2 минуты.\n4. Добавьте нарезанный банан.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-cottage-cheese-apple', 'Творог с яблоком и орехами', 'breakfast',
 '[{"product":"Творог 5%","grams":200,"kcal":242},{"product":"Яблоко","grams":150,"kcal":71},{"product":"Орехи","grams":15,"kcal":98}]'::jsonb,
 411, 36.0, 17.0, 29.0, 5,
 E'1. Выложите 200 г творога в тарелку.\n2. Нарежьте яблоко кубиками и добавьте к творогу.\n3. Измельчите орехи и посыпьте сверху.\n4. Перемешайте.',
 '["lactose_intolerance","nut_allergy"]'::jsonb),

('br-scrambled-eggs-veg', 'Яичница с помидорами и шпинатом', 'breakfast',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Шпинат","grams":50,"kcal":12},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 308, 21.0, 22.0, 6.0, 10,
 E'1. Разогрейте сковороду с чайной ложкой масла.\n2. Обжарьте нарезанные помидоры 2 минуты.\n3. Добавьте шпинат, потомите 1 минуту.\n4. Влейте взбитые яйца и готовьте на слабом огне до схватывания.',
 '["egg_allergy"]'::jsonb),

('br-buckwheat-egg', 'Гречка с яйцом', 'breakfast',
 '[{"product":"Гречка","grams":70,"kcal":218},{"product":"Яйца","grams":100,"kcal":155},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 418, 21.0, 16.0, 47.0, 20,
 E'1. Промойте 70 г гречки, залейте 150 мл воды.\n2. Доведите до кипения и варите под крышкой 15 минут.\n3. Отварите или пожарьте 2 яйца.\n4. Подавайте вместе, сбрызнув маслом.',
 '["egg_allergy"]'::jsonb),

('br-cottage-pancakes', 'Сырники из творога', 'breakfast',
 '[{"product":"Творог 5%","grams":200,"kcal":242},{"product":"Яйца","grams":50,"kcal":78},{"product":"Овсянка","grams":30,"kcal":114},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 479, 38.0, 20.0, 34.0, 20,
 E'1. Измельчите овсянку в муку.\n2. Смешайте творог, яйцо и овсяную муку до однородности.\n3. Сформируйте сырники.\n4. Обжарьте на слабом огне по 3-4 минуты с каждой стороны под крышкой.',
 '["lactose_intolerance","egg_allergy","gluten_intolerance"]'::jsonb),

('br-oatmeal-berries', 'Овсянка с ягодами', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Молоко 1.5%","grams":150,"kcal":68},{"product":"Сезонные ягоды","grams":100,"kcal":45}]'::jsonb,
 341, 13.0, 7.0, 57.0, 10,
 E'1. Сварите овсянку на молоке 5-7 минут.\n2. Дайте постоять 2 минуты под крышкой.\n3. Добавьте ягоды перед подачей, не варите их.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-omelet-cheese-veg', 'Омлет с овощами', 'breakfast',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Молоко 1.5%","grams":50,"kcal":23},{"product":"Кабачки","grams":100,"kcal":24},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 325, 21.0, 22.0, 8.0, 15,
 E'1. Нарежьте кабачок тонкими ломтиками и обжарьте 4 минуты.\n2. Взбейте яйца с молоком.\n3. Залейте овощи яичной смесью.\n4. Готовьте под крышкой на слабом огне 6-8 минут.',
 '["egg_allergy","lactose_intolerance"]'::jsonb),

('br-rice-milk-porridge', 'Рисовая каша на молоке', 'breakfast',
 '[{"product":"Рис белый","grams":70,"kcal":242},{"product":"Молоко 1.5%","grams":200,"kcal":90},{"product":"Яблоко","grams":100,"kcal":47}]'::jsonb,
 379, 12.0, 6.0, 71.0, 25,
 E'1. Промойте рис, залейте 100 мл воды и варите 10 минут.\n2. Влейте молоко и варите ещё 10 минут, помешивая.\n3. Добавьте тёртое яблоко и дайте настояться 3 минуты.',
 '["lactose_intolerance"]'::jsonb),

('br-kefir-oat-jar', 'Овсянка на кефире (с вечера)', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Кефир 1%","grams":200,"kcal":80},{"product":"Груша","grams":120,"kcal":68}]'::jsonb,
 376, 16.0, 7.0, 64.0, 5,
 E'1. Вечером засыпьте овсянку в банку и залейте кефиром.\n2. Уберите в холодильник на ночь.\n3. Утром добавьте нарезанную грушу и перемешайте.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-eggs-toast-veg', 'Яйца всмятку с овощным салатом', 'breakfast',
 '[{"product":"Яйца","grams":100,"kcal":155},{"product":"Огурцы","grams":100,"kcal":15},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 278, 14.0, 21.0, 7.0, 10,
 E'1. Опустите яйца в кипящую воду на 5 минут.\n2. Нарежьте огурцы и помидоры крупно.\n3. Заправьте салат маслом.\n4. Подавайте вместе.',
 '["egg_allergy"]'::jsonb),

-- ОБЕДЫ (12)
('ln-chicken-buckwheat', 'Куриная грудка с гречкой и овощами', 'lunch',
 '[{"product":"Куриная грудка","grams":180,"kcal":297},{"product":"Гречка","grams":80,"kcal":249},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 687, 55.0, 18.0, 62.0, 30,
 E'1. Отварите гречку 15 минут в 160 мл воды.\n2. Нарежьте грудку и обжарьте на среднем огне 8-10 минут.\n3. Брокколи отварите или приготовьте на пару 5 минут.\n4. Соберите тарелку, сбрызните маслом.',
 '[]'::jsonb),

('ln-beef-rice-veg', 'Говядина с бурым рисом', 'lunch',
 '[{"product":"Говядина постная","grams":160,"kcal":250},{"product":"Рис бурый","grams":80,"kcal":278},{"product":"Морковь","grams":100,"kcal":35},{"product":"Лук","grams":50,"kcal":20}]'::jsonb,
 583, 46.0, 14.0, 65.0, 45,
 E'1. Залейте бурый рис 180 мл воды и варите 30 минут.\n2. Нарежьте говядину полосками, обжарьте 5 минут.\n3. Добавьте лук и морковь, тушите под крышкой 15 минут.\n4. Подавайте с рисом.',
 '[]'::jsonb),

('ln-cod-potato', 'Треска с картофелем и овощами', 'lunch',
 '[{"product":"Треска","grams":200,"kcal":164},{"product":"Картофель","grams":200,"kcal":154},{"product":"Капуста цветная","grams":150,"kcal":38},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 446, 42.0, 12.0, 41.0, 35,
 E'1. Отварите картофель 20 минут.\n2. Цветную капусту приготовьте на пару 7 минут.\n3. Треску запекайте при 180 градусах 15 минут.\n4. Сбрызните маслом перед подачей.',
 '["fish_allergy"]'::jsonb),

('ln-turkey-pasta', 'Индейка с цельнозерновыми макаронами', 'lunch',
 '[{"product":"Индейка","grams":180,"kcal":250},{"product":"Макароны цельнозерновые","grams":80,"kcal":275},{"product":"Помидоры","grams":150,"kcal":27},{"product":"Чеснок","grams":5,"kcal":7}]'::jsonb,
 559, 50.0, 10.0, 62.0, 25,
 E'1. Отварите макароны согласно упаковке.\n2. Нарежьте индейку и обжарьте 8 минут.\n3. Добавьте помидоры и чеснок, тушите 7 минут.\n4. Смешайте с макаронами.',
 '["gluten_intolerance"]'::jsonb),

('ln-lentil-soup', 'Суп из чечевицы с овощами', 'lunch',
 '[{"product":"Чечевица","grams":100,"kcal":353},{"product":"Морковь","grams":80,"kcal":28},{"product":"Лук","grams":50,"kcal":20},{"product":"Картофель","grams":100,"kcal":77},{"product":"Подсолнечное масло","grams":10,"kcal":90}]'::jsonb,
 568, 28.0, 13.0, 84.0, 40,
 E'1. Промойте чечевицу, залейте 800 мл воды, варите 20 минут.\n2. Обжарьте лук и морковь 5 минут.\n3. Добавьте зажарку и картофель в кастрюлю.\n4. Варите ещё 15 минут до мягкости.',
 '[]'::jsonb),

('ln-chicken-thigh-rice', 'Куриное бедро с рисом', 'lunch',
 '[{"product":"Куриное бедро","grams":180,"kcal":387},{"product":"Рис белый","grams":80,"kcal":277},{"product":"Кабачки","grams":150,"kcal":36}]'::jsonb,
 700, 42.0, 24.0, 68.0, 35,
 E'1. Отварите рис 12 минут.\n2. Запекайте бедро при 190 градусах 25 минут.\n3. Кабачки обжарьте 6 минут.\n4. Соберите тарелку.',
 '[]'::jsonb),

('ln-hake-buckwheat', 'Хек с гречкой', 'lunch',
 '[{"product":"Хек","grams":200,"kcal":172},{"product":"Гречка","grams":80,"kcal":249},{"product":"Морковь","grams":100,"kcal":35},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 546, 42.0, 14.0, 57.0, 30,
 E'1. Отварите гречку 15 минут.\n2. Хек потушите с морковью под крышкой 15 минут.\n3. Подавайте вместе, сбрызнув маслом.',
 '["fish_allergy"]'::jsonb),

('ln-beans-veg-stew', 'Фасоль тушёная с овощами', 'lunch',
 '[{"product":"Фасоль","grams":120,"kcal":396},{"product":"Помидоры","grams":150,"kcal":27},{"product":"Лук","grams":50,"kcal":20},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 533, 27.0, 13.0, 75.0, 40,
 E'1. Замочите фасоль на ночь, отварите 40 минут.\n2. Обжарьте лук 4 минуты, добавьте помидоры.\n3. Соедините с фасолью и тушите 10 минут.',
 '[]'::jsonb),

('ln-chicken-potato-bake', 'Курица с картофелем в духовке', 'lunch',
 '[{"product":"Куриная грудка","grams":180,"kcal":297},{"product":"Картофель","grams":200,"kcal":154},{"product":"Лук","grams":50,"kcal":20},{"product":"Подсолнечное масло","grams":10,"kcal":90}]'::jsonb,
 561, 43.0, 15.0, 44.0, 45,
 E'1. Нарежьте картофель дольками, лук кольцами.\n2. Выложите в форму вместе с грудкой, сбрызните маслом.\n3. Запекайте при 190 градусах 35 минут.',
 '[]'::jsonb),

('ln-pollock-veg', 'Минтай с овощным рагу', 'lunch',
 '[{"product":"Минтай","grams":200,"kcal":144},{"product":"Кабачки","grams":150,"kcal":36},{"product":"Морковь","grams":100,"kcal":35},{"product":"Картофель","grams":150,"kcal":116},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 421, 38.0, 12.0, 41.0, 35,
 E'1. Нарежьте овощи кубиком и тушите 20 минут под крышкой.\n2. Минтай выложите сверху на последние 12 минут.\n3. Сбрызните маслом.',
 '["fish_allergy"]'::jsonb),

('ln-turkey-buckwheat', 'Индейка с гречкой и капустой', 'lunch',
 '[{"product":"Индейка","grams":180,"kcal":250},{"product":"Гречка","grams":80,"kcal":249},{"product":"Капуста белокочанная","grams":150,"kcal":41}]'::jsonb,
 540, 51.0, 9.0, 62.0, 30,
 E'1. Отварите гречку 15 минут.\n2. Индейку обжарьте 8 минут.\n3. Капусту потушите 12 минут.\n4. Подавайте вместе.',
 '[]'::jsonb),

('ln-chicken-pasta-broccoli', 'Курица с макаронами и брокколи', 'lunch',
 '[{"product":"Куриная грудка","grams":160,"kcal":264},{"product":"Макароны цельнозерновые","grams":80,"kcal":275},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Чеснок","grams":5,"kcal":7}]'::jsonb,
 597, 48.0, 8.0, 66.0, 25,
 E'1. Отварите макароны.\n2. За 4 минуты до готовности добавьте брокколи в ту же воду.\n3. Обжарьте грудку с чесноком 8 минут.\n4. Смешайте всё.',
 '["gluten_intolerance"]'::jsonb),

-- УЖИНЫ (10)
('dn-chicken-salad', 'Куриная грудка с овощным салатом', 'dinner',
 '[{"product":"Куриная грудка","grams":150,"kcal":248},{"product":"Огурцы","grams":100,"kcal":15},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 371, 34.0, 14.0, 7.0, 20,
 E'1. Отварите или запеките грудку 18 минут.\n2. Нарежьте овощи крупно.\n3. Заправьте салат маслом.\n4. Подавайте тёплым.',
 '[]'::jsonb),

('dn-cod-veg', 'Треска на пару с овощами', 'dinner',
 '[{"product":"Треска","grams":200,"kcal":164},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Морковь","grams":80,"kcal":28},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 288, 40.0, 8.0, 14.0, 20,
 E'1. Выложите рыбу и овощи в пароварку.\n2. Готовьте 15 минут.\n3. Сбрызните маслом перед подачей.',
 '["fish_allergy"]'::jsonb),

('dn-cottage-veg', 'Творог с овощами и зеленью', 'dinner',
 '[{"product":"Творог 0%","grams":200,"kcal":142},{"product":"Огурцы","grams":150,"kcal":23},{"product":"Помидоры","grams":100,"kcal":18}]'::jsonb,
 183, 34.0, 1.0, 10.0, 5,
 E'1. Нарежьте овощи мелким кубиком.\n2. Смешайте с творогом.\n3. Посолите по вкусу и подавайте.',
 '["lactose_intolerance"]'::jsonb),

('dn-omelet-spinach', 'Омлет со шпинатом', 'dinner',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Шпинат","grams":100,"kcal":23},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 301, 21.0, 22.0, 4.0, 12,
 E'1. Потомите шпинат на сковороде 2 минуты.\n2. Взбейте яйца и залейте шпинат.\n3. Готовьте под крышкой 6 минут.',
 '["egg_allergy"]'::jsonb),

('dn-turkey-cabbage', 'Индейка с тушёной капустой', 'dinner',
 '[{"product":"Индейка","grams":160,"kcal":222},{"product":"Капуста белокочанная","grams":200,"kcal":54},{"product":"Лук","grams":50,"kcal":20},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 341, 40.0, 11.0, 15.0, 30,
 E'1. Нашинкуйте капусту и лук.\n2. Тушите под крышкой 20 минут.\n3. Индейку обжарьте отдельно 8 минут и добавьте к капусте.',
 '[]'::jsonb),

('dn-hake-salad', 'Хек с салатом из капусты', 'dinner',
 '[{"product":"Хек","grams":200,"kcal":172},{"product":"Капуста белокочанная","grams":150,"kcal":41},{"product":"Морковь","grams":80,"kcal":28},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 331, 36.0, 12.0, 15.0, 20,
 E'1. Запеките хек при 180 градусах 15 минут.\n2. Нашинкуйте капусту с морковью, помните руками.\n3. Заправьте маслом.',
 '["fish_allergy"]'::jsonb),

('dn-eggs-veg-stew', 'Овощное рагу с яйцом', 'dinner',
 '[{"product":"Кабачки","grams":200,"kcal":48},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Яйца","grams":100,"kcal":155},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 311, 16.0, 22.0, 12.0, 25,
 E'1. Тушите кабачки с помидорами 15 минут.\n2. Сделайте углубления и вбейте яйца.\n3. Накройте крышкой и готовьте 6 минут.',
 '["egg_allergy"]'::jsonb),

('dn-pollock-cauliflower', 'Минтай с цветной капустой', 'dinner',
 '[{"product":"Минтай","grams":200,"kcal":144},{"product":"Капуста цветная","grams":200,"kcal":50},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 284, 37.0, 12.0, 10.0, 25,
 E'1. Разберите капусту на соцветия и отварите 7 минут.\n2. Минтай запеките 15 минут при 180 градусах.\n3. Подавайте вместе.',
 '["fish_allergy"]'::jsonb),

('dn-chicken-zucchini', 'Курица с кабачками', 'dinner',
 '[{"product":"Куриная грудка","grams":150,"kcal":248},{"product":"Кабачки","grams":200,"kcal":48},{"product":"Чеснок","grams":5,"kcal":7},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 393, 34.0, 15.0, 11.0, 25,
 E'1. Нарежьте грудку и кабачки кубиком.\n2. Обжарьте грудку 6 минут, добавьте кабачки и чеснок.\n3. Тушите под крышкой ещё 10 минут.',
 '[]'::jsonb),

('dn-kefir-cottage', 'Творог с кефиром на ночь', 'dinner',
 '[{"product":"Творог 0%","grams":150,"kcal":107},{"product":"Кефир 1%","grams":200,"kcal":80},{"product":"Сезонные ягоды","grams":80,"kcal":36}]'::jsonb,
 223, 30.0, 3.0, 21.0, 3,
 E'1. Смешайте творог с кефиром.\n2. Добавьте ягоды.\n3. Ешьте не позже чем за час до сна.',
 '["lactose_intolerance"]'::jsonb),

-- ПОЛДНИКИ (8)
('sn-kefir-apple', 'Кефир с яблоком', 'snack',
 '[{"product":"Кефир 1%","grams":250,"kcal":100},{"product":"Яблоко","grams":150,"kcal":71}]'::jsonb,
 171, 9.0, 3.0, 28.0, 2,
 E'1. Налейте кефир в стакан.\n2. Яблоко съешьте целиком или нарежьте дольками.',
 '["lactose_intolerance"]'::jsonb),

('sn-cottage-berries', 'Творог с ягодами', 'snack',
 '[{"product":"Творог 5%","grams":150,"kcal":182},{"product":"Сезонные ягоды","grams":100,"kcal":45}]'::jsonb,
 227, 25.0, 8.0, 14.0, 3,
 E'1. Выложите творог в тарелку.\n2. Добавьте ягоды и перемешайте.',
 '["lactose_intolerance"]'::jsonb),

('sn-yogurt-nuts', 'Йогурт с орехами', 'snack',
 '[{"product":"Йогурт натуральный","grams":200,"kcal":120},{"product":"Орехи","grams":20,"kcal":131}]'::jsonb,
 251, 12.0, 15.0, 16.0, 2,
 E'1. Измельчите орехи.\n2. Добавьте в йогурт и перемешайте.',
 '["lactose_intolerance","nut_allergy"]'::jsonb),

('sn-boiled-eggs', 'Яйца вкрутую с огурцом', 'snack',
 '[{"product":"Яйца","grams":100,"kcal":155},{"product":"Огурцы","grams":150,"kcal":23}]'::jsonb,
 178, 14.0, 11.0, 4.0, 12,
 E'1. Варите яйца 9 минут после закипания.\n2. Остудите, очистите.\n3. Подавайте с нарезанным огурцом.',
 '["egg_allergy"]'::jsonb),

('sn-banana-nuts', 'Банан с орехами', 'snack',
 '[{"product":"Банан","grams":120,"kcal":107},{"product":"Орехи","grams":20,"kcal":131}]'::jsonb,
 238, 6.0, 13.0, 29.0, 2,
 E'1. Очистите банан.\n2. Ешьте вместе с горстью орехов.',
 '["nut_allergy"]'::jsonb),

('sn-orange-yogurt', 'Апельсин с йогуртом', 'snack',
 '[{"product":"Апельсин","grams":200,"kcal":94},{"product":"Йогурт натуральный","grams":150,"kcal":90}]'::jsonb,
 184, 9.0, 3.0, 30.0, 3,
 E'1. Очистите апельсин и разделите на дольки.\n2. Подавайте с йогуртом.',
 '["lactose_intolerance"]'::jsonb),

('sn-cottage-cucumber', 'Творог с огурцом', 'snack',
 '[{"product":"Творог 0%","grams":150,"kcal":107},{"product":"Огурцы","grams":150,"kcal":23}]'::jsonb,
 130, 26.0, 1.0, 6.0, 3,
 E'1. Нарежьте огурец кубиком.\n2. Смешайте с творогом, посолите по вкусу.',
 '["lactose_intolerance"]'::jsonb),

('sn-pear-kefir', 'Груша с кефиром', 'snack',
 '[{"product":"Груша","grams":180,"kcal":102},{"product":"Кефир 1%","grams":250,"kcal":100}]'::jsonb,
 202, 9.0, 3.0, 35.0, 2,
 E'1. Нарежьте грушу.\n2. Подавайте со стаканом кефира.',
 '["lactose_intolerance"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- КАРТИНКИ УПРАЖНЕНИЙ (GIMN-010): public/exercises/<slug>.gif.
-- Только там, где движение на картинке совпадает с нашей техникой. Источники
-- и лицензии (public domain / CC0) — docs/IMAGE_SOURCES.md. Остальным
-- карточка показывает знак типа упражнения. Тексты упражнений не трогаем.
-- ---------------------------------------------------------------------------
UPDATE exercises SET gif_url = '/exercises/' || slug || '.gif'
WHERE slug IN (
  'breath-diaphragm',
  'gen-crunch',
  'gen-lunges',
  'gen-squat',
  'gen-stretch-quads',
  'gen-superman',
  'main-heel-raises',
  'warmup-pelvic-tilt'
);
-- ---------------------------------------------------------------------------
-- ЩАДЯЩИЕ УПРАЖНЕНИЯ (GIMN-011): микроамплитуда и изометрика — напряжение
-- без движения. Их получают зоны с ограниченной подвижностью по углублённой
-- диагностике: ограничение — повод мягко развивать, а не убирать зону.
-- Составлено по общим принципам ASAS/EULAR (регулярность, без боли, малая
-- амплитуда при обострении). Существующие тексты не менялись.
-- ---------------------------------------------------------------------------
INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects, position, gentle) VALUES

('neck-micro-turns', 'Микроповороты головы', 'warmup', 'neck', 'both',
 'Бережно будит подвижность шеи, когда повороты даются с трудом.',
 E'1. Сядьте прямо, плечи опущены, взгляд вперёд.\n2. Очень медленно поверните голову вправо на 10-15 градусов — как начало движения «нет».\n3. Вернитесь в центр, затем так же влево.\n4. Амплитуда маленькая, до первого натяжения, без боли.',
 NULL, 8, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"stop"}]'::jsonb, 'sitting', TRUE),

('neck-micro-nods', 'Микрокивки', 'warmup', 'neck', 'both',
 'Мягко разрабатывает наклон головы вперёд и назад малой амплитудой.',
 E'1. Сядьте прямо, макушка тянется вверх.\n2. Медленно кивните — подбородок опускается на 2-3 см, как «да».\n3. Вернитесь в исходное положение, голову назад не запрокидывайте.\n4. Дышите ровно, движение без рывков.',
 NULL, 8, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"stop"}]'::jsonb, 'sitting', TRUE),

('neck-chin-tuck', 'Втягивание подбородка', 'main', 'neck', 'both',
 'Укрепляет глубокие мышцы шеи и выравнивает положение головы.',
 E'1. Сядьте прямо, плечи опущены, взгляд вперёд.\n2. Мягко отведите подбородок назад, как будто делаете «двойной подбородок». Голова не наклоняется.\n3. Задержитесь на 3 секунды, вернитесь.\n4. Движение маленькое, напряжение лёгкое.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('neck-iso-front', 'Изометрия шеи вперёд', 'main', 'neck', 'both',
 'Укрепляет мышцы шеи без движения — подходит, когда шея почти не двигается.',
 E'1. Сядьте прямо, положите ладонь на лоб.\n2. Мягко давите лбом в ладонь, ладонь не пускает — голова остаётся на месте.\n3. Сила — примерно треть от возможной, держите 5 секунд.\n4. Расслабьтесь на 5 секунд. Дыхание не задерживайте.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('neck-iso-side', 'Изометрия шеи вбок', 'main', 'neck', 'both',
 'Укрепляет боковые мышцы шеи без наклона головы.',
 E'1. Сядьте прямо, ладонь правой руки — на правый висок.\n2. Мягко давите головой в ладонь, голова не наклоняется.\n3. Треть силы, 5 секунд, затем отдых 5 секунд.\n4. Повторите в другую сторону.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('neck-iso-rotation', 'Изометрия шеи на поворот', 'main', 'neck', 'both',
 'Готовит мышцы к поворотам головы, не поворачивая её.',
 E'1. Сядьте прямо, ладонь правой руки — на правую скулу.\n2. Попробуйте повернуть голову вправо, ладонь не даёт — голова на месте.\n3. Треть силы, 5 секунд, отдых 5 секунд.\n4. Повторите в другую сторону.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('shoulder-iso-wall', 'Изометрия плеча у стены', 'main', 'shoulder', 'both',
 'Укрепляет плечо, когда рука поднимается плохо: мышца работает без движения.',
 E'1. Встаньте боком к стене, рука согнута в локте под прямым углом.\n2. Тыльной стороной кисти мягко давите в стену, как будто отводите руку в сторону.\n3. Рука не двигается, треть силы, 5 секунд, отдых 5 секунд.\n4. Слабой рукой — чуть меньше силы и повторов.',
 NULL, 5, 'beginner', '[]'::jsonb, '[]'::jsonb, 'standing', TRUE),

('spine-iso-chair', 'Прижатие спины к стулу', 'main', 'spine', 'both',
 'Включает мышцы спины без наклонов и прогибов.',
 E'1. Сядьте на стул со спинкой, стопы на полу.\n2. Мягко прижмите лопатки и верх спины к спинке стула.\n3. Держите 5 секунд, спина не прогибается, дыхание ровное.\n4. Расслабьтесь на 5 секунд.',
 NULL, 6, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('spine-micro-rotation', 'Микроповороты корпуса сидя', 'main', 'spine', 'both',
 'Бережно возвращает повороты грудного отдела малой амплитудой.',
 E'1. Сядьте прямо, руки скрещены на груди.\n2. Медленно поверните корпус вправо на 10-15 градусов, таз неподвижен.\n3. Вернитесь в центр, затем влево.\n4. Только до первого натяжения, без боли.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('legs-quad-set', 'Напряжение бедра сидя', 'main', 'legs', 'both',
 'Укрепляет переднюю поверхность бедра без нагрузки на суставы.',
 E'1. Сядьте на стул, одну ногу вытяните вперёд, пятка на полу.\n2. Напрягите бедро, прижимая колено вниз, носок на себя.\n3. Держите 5 секунд, расслабьтесь.\n4. Повторите на другой ноге.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('hips-iso-squeeze', 'Сжатие полотенца коленями', 'main', 'hips', 'both',
 'Включает мышцы таза без разведения ног.',
 E'1. Сядьте на стул, между коленями — свёрнутое полотенце или мягкий мяч.\n2. Мягко сожмите его коленями, держите 5 секунд.\n3. Расслабьтесь на 5 секунд.\n4. Спина прямая, дыхание не задерживайте.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE)

ON CONFLICT (slug) DO NOTHING;

-- Положение тела у существующих упражнений (по первой строке техники).
UPDATE exercises SET position = 'prone'
  WHERE slug IN ('gen-superman', 'main-prone-extension', 'main-swimmer');
UPDATE exercises SET position = 'quadruped'
  WHERE slug IN ('main-bird-dog', 'main-cat-cow', 'main-thoracic-rotation', 'gen-plank', 'gen-pushup', 'gen-mountain-climbers');
UPDATE exercises SET position = 'supine'
  WHERE slug IN ('breath-cooldown', 'breath-diaphragm', 'gen-crunch', 'gen-glute-bridge', 'main-bridge', 'main-dead-bug',
                 'main-hamstring-stretch', 'main-knee-to-chest', 'stretch-full-body', 'stretch-piriformis',
                 'stretch-supine-twist', 'warmup-pelvic-tilt');
UPDATE exercises SET position = 'side' WHERE slug IN ('gen-side-plank', 'main-hip-abduction');
UPDATE exercises SET position = 'kneeling' WHERE slug IN ('main-hip-flexor-stretch', 'stretch-child-pose');
UPDATE exercises SET position = 'sitting' WHERE slug IN ('breath-chest-expand', 'warmup-neck-tilts', 'massage-glutes-ball');
UPDATE exercises SET position = 'standing_free' WHERE slug IN ('gen-jumping-jacks', 'gen-lunges', 'gen-step-touch', 'gen-squat');
UPDATE exercises SET position = 'standing'
  WHERE slug IN ('gen-arm-swings', 'gen-row-band', 'gen-stretch-quads', 'main-arm-circles', 'main-chest-opener-doorway',
                 'main-heel-raises', 'main-mini-squat', 'main-shoulder-external', 'main-shoulder-wall-slide',
                 'main-side-bend-standing', 'main-wall-posture', 'massage-paravertebral', 'gen-stretch-full');

-- Щадящие среди существующих: дыхание, мягкие разминочные движения, самомассаж.
UPDATE exercises SET gentle = TRUE
  WHERE type = 'breathing'
     OR slug IN ('warmup-pelvic-tilt', 'warmup-neck-tilts', 'warmup-neck-turns', 'warmup-shoulder-rolls',
                 'massage-suboccipital', 'main-scapula-squeeze', 'main-wall-posture');

-- Категория блюда — для иконки в меню (GIMN-011).
UPDATE meals SET category = 'porridge'
  WHERE slug IN ('br-oatmeal-banana', 'br-oatmeal-berries', 'br-rice-milk-porridge', 'br-kefir-oat-jar', 'br-buckwheat-egg');
UPDATE meals SET category = 'dairy'
  WHERE slug IN ('br-cottage-cheese-apple', 'br-cottage-pancakes', 'dn-cottage-veg', 'dn-kefir-cottage',
                 'sn-cottage-berries', 'sn-cottage-cucumber', 'sn-yogurt-nuts');
UPDATE meals SET category = 'eggs'
  WHERE slug IN ('br-scrambled-eggs-veg', 'br-omelet-cheese-veg', 'br-eggs-toast-veg', 'dn-omelet-spinach',
                 'dn-eggs-veg-stew', 'sn-boiled-eggs');
UPDATE meals SET category = 'meat'
  WHERE slug IN ('ln-chicken-buckwheat', 'ln-beef-rice-veg', 'ln-turkey-pasta', 'ln-chicken-thigh-rice',
                 'ln-chicken-potato-bake', 'ln-turkey-buckwheat', 'ln-chicken-pasta-broccoli', 'dn-chicken-salad',
                 'dn-turkey-cabbage', 'dn-chicken-zucchini');
UPDATE meals SET category = 'fish'
  WHERE slug IN ('ln-cod-potato', 'ln-hake-buckwheat', 'ln-pollock-veg', 'dn-cod-veg', 'dn-hake-salad', 'dn-pollock-cauliflower');
UPDATE meals SET category = 'soup' WHERE slug IN ('ln-lentil-soup');
UPDATE meals SET category = 'vegetables' WHERE slug IN ('ln-beans-veg-stew');
UPDATE meals SET category = 'fruit'
  WHERE slug IN ('sn-kefir-apple', 'sn-banana-nuts', 'sn-orange-yogurt', 'sn-pear-kefir');

-- Картинки движения с Pixabay (GIMN-013). Отобраны вручную и отсмотрены:
-- движение совпадает с нашей техникой. Файлы лежат в public/exercises/
-- (хотлинк запрещён лицензией), источники — в docs/IMAGE_SOURCES.md.
-- Остальным упражнениям визуал даёт схема движения, она рисуется кодом
-- по slug и в базе не хранится.
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp', image_credit = 'Pixabay'
  WHERE slug IN ('gen-plank', 'gen-pushup', 'main-hip-abduction', 'stretch-child-pose');

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ НА ТУРНИКЕ И БРУСЬЯХ (GIMN-014, 15 штук) — только общий режим.
--
-- Порядок в списке — от самого простого к самому тяжёлому: вис, шраги,
-- австралийские, негативные, полные подтягивания. Так человек без опыта
-- получает висы и шраги, а подтягивания приходят с ростом уровня.
--
-- Режим «Бехтерева» их не получает, и это намеренно: вис под собственным
-- весом при анкилозирующем спондилите — вопрос к врачу, а не к приложению.
-- Механика запрета общая для всех режимов: подбор берёт из соседнего режима
-- только дыхание, разминку и растяжку уровня «начальный».
--
-- equipment: подбор покажет эти упражнения, только если в анкете отмечен
-- турник (has_turnik = 'yes'), а при «могу найти» — последними и с пометкой.
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects, position, gentle, equipment) VALUES

-- Висы: с них начинают, они же — растяжка позвоночника после силовой части.
('bar-dead-hang', 'Мёртвый вис', 'stretch', 'spine', 'general',
 'Вытягивает позвоночник под собственным весом и разгружает поясницу.',
 E'1. Возьмитесь за турник прямым хватом на ширине плеч.\n2. Полностью повисните: руки прямые, плечи расслаблены, ноги не касаются пола.\n3. Дышите ровно, не раскачивайтесь.\n4. Слезайте мягко, не спрыгивая.',
 30, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-hang-posture', 'Вис для осанки', 'stretch', 'spine', 'general',
 'Мягкое вытяжение в конце занятия: раскрывает грудную клетку и снимает сутулость.',
 E'1. Повисните на турнике прямым хватом, стопы могут слегка касаться пола — так легче.\n2. Расслабьте спину и плечи, дайте телу вытянуться вниз.\n3. Макушкой тянитесь вверх, подбородок не задирайте.\n4. Держите столько, сколько спокойно держится хват.',
 40, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-active-hang', 'Активный вис', 'main', 'shoulder', 'general',
 'Учит держать плечи включёнными — база для подтягиваний.',
 E'1. Повисните на прямых руках прямым хватом.\n2. Не сгибая локти, опустите плечи вниз и сведите лопатки — тело чуть поднимется.\n3. Держите это положение, грудь раскрыта.\n4. Дышите ровно, не задерживайте дыхание.',
 20, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-shrug', 'Шраги на турнике', 'main', 'shoulder', 'general',
 'Пожимание плечами в висе — укрепляет лопаточные мышцы перед подтягиваниями.',
 E'1. Повисните на турнике прямым хватом, руки прямые.\n2. Не сгибая локти, опустите плечи вниз и сведите лопатки.\n3. Плавно отпустите — плечи поднимаются к ушам.\n4. Работают только лопатки, локти всё время прямые.',
 NULL, 10, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Подтягивания: от облегчённых к полным.
('bar-australian-row', 'Австралийские подтягивания', 'main', 'shoulder', 'general',
 'Подтягивание к низкой перекладине из наклонного виса — облегчённый вариант для спины.',
 E'1. Возьмитесь за низкую перекладину (на уровне пояса) прямым хватом шире плеч.\n2. Выпрямите тело в линию, пятки на полу, руки прямые.\n3. Подтяните грудь к перекладине, сводя лопатки.\n4. Медленно опуститесь. Чем ближе стопы к перекладине, тем легче.',
 NULL, 12, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-negative-pullup', 'Негативные подтягивания', 'main', 'shoulder', 'general',
 'Медленный спуск из верхней точки — так учатся подтягиваться с нуля.',
 E'1. Встаньте на опору так, чтобы подбородок был над перекладиной, возьмитесь прямым хватом.\n2. Уберите ноги с опоры и удерживайте верхнее положение.\n3. Опускайтесь вниз медленно, на счёт 3-5, до полностью прямых рук.\n4. Вернитесь на опору и повторите.',
 NULL, 5, 'intermediate', '["shoulder_pain"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-overhand', 'Подтягивание прямым хватом', 'main', 'shoulder', 'general',
 'Базовое подтягивание: широчайшие мышцы спины, плечи, руки.',
 E'1. Возьмитесь за турник прямым хватом (ладони от себя) на ширине плеч.\n2. Из виса на прямых руках подтянитесь, пока подбородок не окажется над перекладиной.\n3. Опускайтесь подконтрольно до прямых рук, без падения вниз.\n4. Не раскачивайтесь и не помогайте себе рывком ног.',
 NULL, 6, 'intermediate', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-underhand', 'Подтягивание обратным хватом', 'main', 'shoulder', 'general',
 'Ладони к себе — больше работы достаётся бицепсам, подтягиваться легче.',
 E'1. Возьмитесь за турник обратным хватом (ладони к себе) на ширине плеч.\n2. Подтянитесь, пока подбородок не окажется над перекладиной, локти идут вниз вдоль тела.\n3. Опускайтесь медленно до прямых рук.\n4. Плечи держите опущенными, не втягивайте голову.',
 NULL, 6, 'intermediate', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-wide', 'Подтягивание широким хватом', 'main', 'shoulder', 'general',
 'Хват шире плеч — акцент на широчайшие, самый тяжёлый вариант.',
 E'1. Возьмитесь прямым хватом заметно шире плеч.\n2. Подтянитесь грудью к перекладине, сводя лопатки, локти идут в стороны и вниз.\n3. Опускайтесь подконтрольно до прямых рук.\n4. Берите этот вариант, только когда обычные подтягивания даются легко.',
 NULL, 5, 'advanced', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Пресс в висе.
('bar-knee-raise', 'Подъём коленей в висе', 'main', 'core', 'general',
 'Пресс в висе: колени к груди, поясница не прогибается.',
 E'1. Повисните на турнике прямым хватом, плечи опущены.\n2. Подтяните колени к груди, округляя низ живота.\n3. Опустите ноги медленно, не раскачиваясь.\n4. Движение делайте прессом, а не махом ног.',
 NULL, 10, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-leg-raise', 'Подъём ног к груди в висе', 'main', 'core', 'general',
 'Тот же подъём, но с прямыми ногами — заметно тяжелее.',
 E'1. Повисните на турнике прямым хватом, ноги прямые.\n2. Поднимите прямые ноги до уровня таза или выше, к груди.\n3. Опускайте медленно, без раскачки.\n4. Не можете с прямыми — согните колени, это тот же подъём полегче.',
 NULL, 8, 'advanced', '["acute_back_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-l-hang', 'Вис в L-сидении', 'main', 'core', 'general',
 'Удержание прямых ног под углом 90 градусов — статика на пресс.',
 E'1. Повисните на турнике прямым хватом, плечи опущены.\n2. Поднимите прямые ноги до угла 90 градусов с телом.\n3. Держите положение, дышите ровно, носки тяните на себя.\n4. Тяжело — держите согнутые колени, это тот же угол полегче.',
 15, NULL, 'advanced', '["acute_back_pain"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-hang-twist', 'Маятник в висе', 'main', 'core', 'general',
 'Колени вбок из виса — косые мышцы живота.',
 E'1. Повисните на турнике прямым хватом, колени подтянуты к груди.\n2. Не опуская колени, отведите их вбок, скручиваясь в пояснице.\n3. Вернитесь в центр и повторите в другую сторону.\n4. Амплитуда небольшая, движение медленное.',
 NULL, 10, 'intermediate', '["acute_back_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Брусья. Отдельный снаряд: турник есть чаще, чем брусья.
('dip-support-hold', 'Удержание в упоре на брусьях', 'main', 'core', 'general',
 'Стойка на прямых руках между брусьями — учит держать корпус и плечи.',
 E'1. Встаньте между брусьями, обопритесь на прямые руки, локти выпрямлены.\n2. Оторвите ноги от пола, тело вертикально, плечи опущены от ушей.\n3. Держите положение, напрягая живот и ягодицы.\n4. Опускайтесь на пол мягко.',
 20, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'dip_bars'),

('dip-pushup', 'Отжимания на брусьях', 'main', 'shoulder', 'general',
 'Грудь, передние дельты и трицепс под полным весом тела.',
 E'1. Встаньте в упор на прямых руках между брусьями.\n2. Опуститесь, сгибая локти примерно до 90 градусов, корпус чуть наклонён вперёд.\n3. Выжмите себя вверх до прямых рук.\n4. Плечи не проваливайте к ушам; болит плечо — уменьшите глубину.',
 NULL, 8, 'advanced', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"},{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'dip_bars')

ON CONFLICT (slug) DO NOTHING;

-- Картинки движения с wger (GIMN-015). Отобраны вручную и отсмотрены:
-- движение совпадает с нашей техникой. Лицензия CC BY-SA требует назвать
-- автора — он в image_credit, полные ссылки в docs/IMAGE_SOURCES.md.
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger (CC BY-SA 4.0)'
WHERE slug IN ('bar-knee-raise', 'bar-leg-raise', 'gen-jumping-jacks',
               'warmup-neck-tilts', 'warmup-neck-turns', 'main-bridge', 'gen-glute-bridge');

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Imobard (CC BY-SA 4.0)'
WHERE slug = 'bar-pullup-overhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Everkinetic (CC BY-SA 3.0)'
WHERE slug = 'bar-pullup-underhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, cshep442 (CC BY-SA 4.0)'
WHERE slug = 'dip-pushup';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Gavru (CC BY-SA 4.0)'
WHERE slug = 'bar-australian-row';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, utkb (CC BY-SA 4.0)'
WHERE slug = 'main-bird-dog';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Davidgj32 (CC BY-SA 4.0)'
WHERE slug IN ('main-hip-flexor-stretch', 'stretch-piriformis');

-- Чтобы API сразу увидел новые таблицы:
NOTIFY pgrst, 'reload schema';
