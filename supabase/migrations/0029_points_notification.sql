-- 0029 (GIMN-030): уведомление о начислении баллов.
--
-- Начисление стало сообщать о себе в Telegram: человек нашёл баг, его
-- подтвердили — и раньше он узнавал об этом, только если сам заглядывал
-- в «Мои баллы». Журналу уведомлений нужен свой тип для таких сообщений,
-- иначе запись отвергается проверкой и отправка не остаётся в истории:
-- сообщение ушло, а по журналу его как будто не было.
--
-- Тип добавляем ровно так же, как 0025 добавляла level_up.

ALTER TABLE notifications_log DROP CONSTRAINT IF EXISTS notifications_log_type_check;
ALTER TABLE notifications_log ADD CONSTRAINT notifications_log_type_check
  CHECK (type IN (
    'morning_reminder',
    'evening_reminder',
    'personal_report',
    'doctor_advice',
    'level_up',
    'points_awarded',
    'other'
  ));

NOTIFY pgrst, 'reload schema';
