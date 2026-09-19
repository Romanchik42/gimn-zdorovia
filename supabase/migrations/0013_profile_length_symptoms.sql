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
