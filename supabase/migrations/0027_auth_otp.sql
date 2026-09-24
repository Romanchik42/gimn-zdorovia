-- 0027 (GIMN-029): одноразовые коды для входа по телефону и почте.
--
-- До сих пор вход был один — Telegram. Он удобен, но не у всех есть
-- Telegram, и человек, которому дали ссылку на приложение, упирался в
-- единственную кнопку. Здесь появляется второй и третий путь: код в SMS
-- и код на почту.
--
-- Хранится ХЭШ кода, а не код. Разница практическая: таблица с шестью
-- цифрами в открытом виде — это список готовых ключей от чужих аккаунтов
-- на пять минут вперёд. Соль у каждой строки своя, поэтому одинаковые
-- коды дают разные хэши и по таблице нельзя понять, где код повторился.

CREATE TABLE IF NOT EXISTS auth_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Телефон в формате +7XXXXXXXXXX или почта в нижнем регистре.
  identifier TEXT NOT NULL,
  channel VARCHAR(10) NOT NULL CHECK (channel IN ('sms', 'email')),
  -- «соль:хэш», scrypt. Самого кода здесь нет и быть не должно.
  code_hash TEXT NOT NULL,
  -- Неудачные попытки ввода. На третьей строка становится негодной.
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE auth_otp IS 'Одноразовые коды входа (0027). Живут пять минут, хранятся хэшем';
COMMENT ON COLUMN auth_otp.code_hash IS 'scrypt в виде «соль:хэш». Код в открытом виде не хранится';
COMMENT ON COLUMN auth_otp.attempts IS 'Неудачные попытки ввода: на третьей код сгорает';

-- Поиск идёт всегда по идентификатору и свежести.
CREATE INDEX IF NOT EXISTS idx_otp_identifier ON auth_otp(identifier, created_at DESC);
-- По нему же чистятся просроченные.
CREATE INDEX IF NOT EXISTS idx_otp_expires ON auth_otp(expires_at);

-- RLS включена, политик НЕТ — и это не забывчивость.
--
-- Таблицу читает и пишет только сервер служебным ключом, который RLS
-- обходит. Ни одна политика здесь не нужна, а любая — опасна: политика
-- «свои строки» невозможна в принципе, потому что на момент запроса кода
-- человек ещё не вошёл и своего user_id не имеет. Включённая RLS без
-- политик означает «из браузера — никак», ровно то, что требуется.
ALTER TABLE auth_otp ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
