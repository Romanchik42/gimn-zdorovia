-- 0025 (GIMN-028, блок F): предложение перейти на следующий уровень.
--
-- Уровень меняется ТОЛЬКО с согласия человека. Приложение считает данные,
-- видит, что нагрузка стала лёгкой, и предлагает — согласиться или остаться.
-- Автоматического переключения нет и не будет: на среднем уровне появляются
-- сплиты и более тяжёлые веса, и решать, готов ли к ним человек с больной
-- спиной, приложение за него не может.
--
-- Отдельной колонки training_level по-прежнему нет: уровень живёт в
-- user_profiles_general.difficulty (см. 0021). Здесь добавляется только
-- отметка о том, когда предложение показывали.

-- 1. Когда последний раз предлагали повышение. NULL — не предлагали ни разу.
--    Нужна, чтобы не спрашивать одно и то же на каждой тренировке: человек,
--    отказавшийся один раз, услышит вопрос не раньше чем через неделю.
ALTER TABLE user_profiles_general
  ADD COLUMN IF NOT EXISTS level_up_offered_at TIMESTAMPTZ;

COMMENT ON COLUMN user_profiles_general.level_up_offered_at IS
  'Когда предлагали следующий уровень. NULL — ни разу. Защита от повтора чаще раза в неделю (0025)';

-- RLS не трогаем: у user_profiles_general политика FOR ALL на свою строку,
-- колоночных грантов нет (основание записано в 0017 и 0021).

-- 2. Новый тип уведомления. Без него журнал отверг бы запись о повышении,
--    и отправка в Telegram падала бы на логировании — уже после того, как
--    человек получил сообщение.
ALTER TABLE notifications_log DROP CONSTRAINT IF EXISTS notifications_log_type_check;
ALTER TABLE notifications_log ADD CONSTRAINT notifications_log_type_check
  CHECK (type IN (
    'morning_reminder',
    'evening_reminder',
    'personal_report',
    'doctor_advice',
    'level_up',
    'other'
  ));

-- 3. Каналы про запас. Отправку умеет только Telegram; остальные — заглушки
--    в src/lib/notifications/channels.ts. Значения заводятся здесь заранее
--    по той же причине, что и тип выше: канал появится в коде раньше, чем
--    дойдут руки до миграции, и первая же запись в журнал упала бы.
ALTER TABLE notifications_log DROP CONSTRAINT IF EXISTS notifications_log_channel_check;
ALTER TABLE notifications_log ADD CONSTRAINT notifications_log_channel_check
  CHECK (channel IN ('telegram', 'push', 'email', 'sms', 'vk', 'apple', 'google'));

NOTIFY pgrst, 'reload schema';
