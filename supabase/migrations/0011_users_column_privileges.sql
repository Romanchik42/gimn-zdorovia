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
