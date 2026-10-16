-- 0031_payments.sql — приём оплат через ЮKassa (GIMN-payments).
--
-- Источник платежа различаем полем `app`: ЮKassa-магазин может быть общим с
-- другим проектом (Кузня), поэтому и в метаданных платежа, и здесь в базе
-- явно помечаем, что это Гимн и кто/за что платил — «кто откуда оплатил».
--
-- Применяет Роман в Supabase SQL Editor, затем: NOTIFY pgrst, 'reload schema';

create table if not exists payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  app                 text not null default 'gimn',       -- источник платежа (различать проекты в общем магазине)
  provider            text not null default 'yookassa',
  provider_payment_id text unique,                        -- id платежа в ЮKassa (вебхук + идемпотентность)
  tariff              text not null,                      -- basic | plus | family
  period              text not null default 'month',      -- month | year
  amount_rub          numeric(10, 2) not null,
  points_spent        integer not null default 0,         -- частичная оплата баллами
  email               text,                               -- почту просим на оплате (для чека ЮKassa)
  status              text not null default 'pending',    -- pending | succeeded | canceled
  created_at          timestamptz not null default now(),
  paid_at             timestamptz
);

create index if not exists payments_user_idx on payments (user_id, created_at desc);
create index if not exists payments_provider_idx on payments (provider_payment_id);

-- Действующая подписка пользователя (активируется вебхуком после успешной оплаты).
alter table users add column if not exists subscription_tariff text;        -- basic | plus | family | null
alter table users add column if not exists subscription_until  timestamptz; -- до какой даты оплачено

-- RLS как во всём проекте: включён без политик — пишет только сервер (service_role).
alter table payments enable row level security;
