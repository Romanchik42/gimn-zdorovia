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
