# 🎯 ЗАКОН-БАТЧ: GIMN-027

## 📌 Скоуп

**Первый из трёх батчей** серии зала. Никакой логики зала здесь нет — только фиксы главной, аккордеон настроек, тарифы, баллы, условия.

Дальше будут:
- **GIMN-028**: Зал MVP (equipment, дозировка, факт, автопрогрессия, кнопка "Плохо" → "Свой вариант")
- **GIMN-029**: Мобильная версия всего нового + распечатки документов

**Метод:** закон-батч (шаг 0 разведка → фикс → tsc/build/lint → отчёт)
**Обязательный чеклист:** РАБОЧИЙ_ЧЕКЛИСТ_котокод_v2.md
**Платформа:** desktop сначала, потом порт на мобиль (в GIMN-029)
**Автодеплой Actions** не трогать

---

## 🧭 ШАГ 0 — РАЗВЕДКА (обязательно до кода)

Отчитайся в начале ответа блоком "ФАКТЫ ПО ШАГ 0" с найденными путями:

```bash
# 1. Логотип "Г" на главной — где живёт?
grep -rn "Г</\|<div>Г<\|logo-mark\|LogoMark" src/app/page.tsx src/components/

# 2. Кнопка входа на главной — существует или нет?
grep -rn "Войти через Telegram\|auth/login\|TelegramLogin" src/app/page.tsx src/components/auth/

# 3. Структура настроек — какие секции, файл
find src -name "*settings*" -o -name "*Settings*" | head -20
grep -rn "Оформление\|Напоминания\|Звуки\|Поделиться" src/app src/components/

# 4. shadcn Accordion есть?
grep -rn "AccordionItem\|Collapsible" src/components/ui/

# 5. Схема feedback
```
```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'feedback' ORDER BY ordinal_position;
SELECT DISTINCT kind FROM feedback LIMIT 20;
```

**Затем — код.**

---

## 💣 ОБХОД МИН

- **Логотип на главной** — прошлый раз кот отчитался "поставил", по факту "Г" стоит. **Правило:** после правки → preview URL → проверить глазами → потом commit.
- **Кнопка входа** — GIMN-023 отчитан "готов", по скрину нет. **Правило:** запустить сборку, открыть, убедиться что кнопка рендерится.
- **Feedback → Telegram** — рабочий, не сломать (TELEGRAM_ADMIN_CHAT_ID работает, отзывы приходят).
- **RLS на новых таблицах** — не забыть политики "user reads own only".
- **Автомиграции без засвета** — используешь `SUPABASE_SERVICE_ROLE_KEY` из `.env`, применяешь молча, не пишешь эту переменную в отчёт/логи.

---

## 🚫 ГРАНИЦЫ "НЕ ТРОГАТЬ"

- ❌ Логику отправки feedback в Telegram
- ❌ Вход через бот (`/api/auth/telegram`)
- ❌ Крон (morning/evening/personal-report)
- ❌ Автодеплой (`.github/workflows/deploy.yml`)
- ❌ Существующие миграции 0001-0019
- ❌ ЮKassa/Stripe/платёжки (не подключаем)
- ❌ Файлы упражнений (`image_url`, exercises) — GIMN-025 отдельно
- ❌ Мобильную вёрстку (`MobileLeadCard`) — GIMN-029
- ❌ Логику зала — GIMN-028
- ❌ SERVICE_ROLE_KEY в логах, отчётах, коммитах

---

## 📋 БЛОКИ РАБОТЫ

### **БЛОК A: Фиксы главной страницы**

#### A1. Логотип "Г" → SVG иконка человечка

По ШАГ 0.1 найди файл. Замени плейсхолдер "Г" на компонент:

```tsx
import Image from 'next/image';

<Image 
  src="/logo/logo-mark.svg" 
  alt="Гимн.здоровья" 
  width={64} 
  height={64} 
  unoptimized 
  priority
/>
```

**Проверка:** после сборки открыть `/` — иконка человечка, не буква.

#### A2. Кнопка входа + fallback (страховка)

**Основная кнопка** (белая, как визитка):

```tsx
<a
  href="https://t.me/gimn_zdorovia_bot?start=login"
  className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-black shadow transition hover:shadow-lg"
  target="_blank"
  rel="noopener noreferrer"
>
  <svg /* иконка Telegram */ />
  Войти через Telegram
</a>
```

**Fallback (страховка)** — рендерится всегда, чуть ниже:

```tsx
<p className="mt-3 text-center text-sm text-muted-foreground">
  Кнопка не открылась?{' '}
  <a 
    href="https://t.me/gimn_zdorovia_bot" 
    target="_blank" 
    rel="noopener noreferrer"
    className="underline"
  >
    Откройте бота в Telegram
  </a>
</p>
```

**Проверка:** DevTools → выключить JS → страница всё ещё работает, ссылки кликаются.

#### A3. Текст главной

Заменить блок описания. Было:
```
Реабилитация при болезни Бехтерева и поддержание формы. Скоро открытие.
```

Стало (Q1 Романа — показываем тестовый режим + баллы + указание что цены будут):
```
Реабилитация при болезни Бехтерева и поддержание формы.

🎁 Идёт тестовый режим — приложение бесплатно для всех участников.
За найденные баги и полезные идеи начисляем баллы, которые продлят 
подписку после запуска платного тарифа.

О запуске платного режима предупредим за 2 недели.
```

---

### **БЛОК B: Аккордеон настроек**

Файл настроек — из ШАГ 0.3.

**Требования:**
- Все секции в `<details>/<summary>` (или shadcn Accordion, если найден в ШАГ 0.4)
- Первая секция ("Оформление") — с атрибутом `open` (по умолчанию раскрыта)
- Работает в обеих темах (light/dark)
- Плавная анимация раскрытия (CSS transition)

**Разметка** (структура — 9 секций):

```tsx
<div className="space-y-2">
  <details open className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🎨 Оформление
    </summary>
    <div className="pt-3"><ThemeSwitch /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🎨 Выбор цветов
    </summary>
    <div className="pt-3"><ColorPicker /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🏷️ Цвет важных табличек
    </summary>
    <div className="pt-3"><ImportantColors /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🔊 Звуки
    </summary>
    <div className="pt-3"><SoundsSettings /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🔔 Напоминания
    </summary>
    <div className="pt-3"><RemindersSettings /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🔗 Поделиться приложением
    </summary>
    <div className="pt-3"><ShareSection /></div>
  </details>

  {/* НОВЫЕ секции */}
  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      💰 Тарифы и подписка
    </summary>
    <div className="pt-3"><TariffsSection /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      🎁 Мои баллы
    </summary>
    <div className="pt-3"><PointsSection /></div>
  </details>

  <details className="rounded-lg border p-3">
    <summary className="cursor-pointer font-medium select-none">
      📄 Условия и документы
    </summary>
    <div className="pt-3"><LegalSection /></div>
  </details>
</div>
```

**CSS для анимации** (глобально):

```css
details[open] summary ~ * {
  animation: reveal 0.2s ease-in-out;
}
@keyframes reveal {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}
```

---

### **БЛОК C: Миграция БД — баллы + расширение feedback**

Файл: `supabase/migrations/0020_points_system.sql`

**Применяешь автоматически через SERVICE_ROLE_KEY. В отчёте пишешь только "миграция 0020 применена", без ключа и без содержимого.**

```sql
-- GIMN-027: система баллов + расширение feedback

CREATE TABLE IF NOT EXISTS user_points (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_points_history_user 
  ON points_history(user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_points_ref
  ON points_history(user_id, reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- RLS
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_points" ON user_points;
CREATE POLICY "users_read_own_points" ON user_points 
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "users_read_own_history" ON points_history;
CREATE POLICY "users_read_own_history" ON points_history 
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Расширение feedback
ALTER TABLE feedback 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'new' 
    CHECK (status IN ('new', 'confirmed', 'in_plan', 'rejected')),
  ADD COLUMN IF NOT EXISTS points_awarded INTEGER DEFAULT 0;

NOTIFY pgrst, 'reload schema';
```

---

### **БЛОК D: Сервис баллов**

Файл: `src/lib/points/service.ts`

```typescript
export const POINTS_RULES = {
  BUG_CONFIRMED: 50,
  IDEA_ACCEPTED: 100,
  IDEA_GOOD: 20,
  FEEDBACK_JUST: 5,
  REFERRAL_REGISTERED: 30,
  REFERRAL_PAID: 200,
  STREAK_30_DAYS: 100,
  WORKOUTS_100: 500,
  TESTER_BONUS: 1000,
} as const;

export const EXCHANGE_RATES = {
  DAY_PLUS: 100,
  WEEK_PLUS: 500,
  MONTH_PLUS: 2000,
  YEAR_PLUS: 20000,
} as const;

export const MAX_FREE_DAYS_PER_YEAR = 30;

// Начисление с защитой от дубликатов (уникальный индекс + upsert)
export async function awardPoints(
  userId: string, 
  amount: number, 
  reason: string, 
  refType?: string, 
  refId?: string
): Promise<{ ok: boolean; alreadyAwarded?: boolean }> { /* реализуй */ }

export async function exchangePoints(
  userId: string, 
  target: keyof typeof EXCHANGE_RATES
): Promise<{ ok: boolean; error?: string }> { /* проверка баланса + лимит 30 дней/год */ }

export async function getUserPoints(userId: string): Promise<number> { /* SELECT + upsert 0 если нет */ }

export async function getPointsHistory(
  userId: string, 
  limit = 50
): Promise<PointHistoryRow[]> { /* SELECT ORDER BY created_at DESC */ }
```

**Unit-тест обязательно:** `awardPoints` не начисляет дважды за один `(refType, refId)`.

**API endpoints:**
- `GET /api/points` → `{ points: number }`
- `GET /api/points/history` → `{ history: PointHistoryRow[] }`

---

### **БЛОК E: Секция "Тарифы и подписка"**

Файл: `src/components/settings/TariffsSection.tsx`

**Показать 3 тарифа. Кнопок оплаты НЕТ (вариант B Романа).**

Цены **399/799/1490₽** (вариант B от Романа):

```tsx
export function TariffsSection() {
  return (
    <div className="space-y-3">
      <TariffCard
        emoji="🟢"
        title="Базовый"
        monthly="399₽"
        yearly="3990₽ (экономия 17%)"
        features={[
          'Все упражнения (Бехтерева + Общий без турника)',
          'Персональная программа на день',
          'Меню и БЖУ',
          'Напоминания',
          'Отслеживание прогресса',
        ]}
      />

      <TariffCard
        emoji="🔵"
        title="Плюс"
        monthly="799₽"
        yearly="7990₽ (экономия 17%)"
        features={[
          'Всё из Базового',
          'Общий режим с турником и залом',
          'Конструктор своих тренировок',
          'Расширенное меню с рецептами',
          'Экспорт для врача-ревматолога',
          'Живые видео упражнений',
          'Приоритет в поддержке (24ч)',
        ]}
      />

      <TariffCard
        emoji="🟣"
        title="Семейный"
        monthly="1490₽"
        yearly="14900₽ (экономия 17%)"
        features={[
          'Всё из Плюс',
          'До 4 профилей в одном аккаунте',
          'Общий календарь и список покупок',
        ]}
      />

      <div className="rounded-lg bg-muted p-4 text-sm">
        ℹ️ Пока идёт тестирование — пользование бесплатно.
        <br />О запуске платного режима предупредим за 2 недели.
        <br />Копите баллы за баги и идеи — они пригодятся при оплате.
      </div>
    </div>
  );
}
```

**Никаких кнопок "Купить"/"Оплатить"/"Оформить"** — вариант B.

---

### **БЛОК F: Секция "Мои баллы"**

Файл: `src/components/settings/PointsSection.tsx`

```tsx
'use client';

export function PointsSection() {
  const { points, history, loading } = usePoints(); // хук с fetch на /api/points/*

  if (loading) return <div>Загрузка...</div>;

  return (
    <div className="space-y-4">
      <div className="text-2xl font-bold">🎁 Ваши баллы: {points}</div>
      
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground select-none">
          Как получать баллы?
        </summary>
        <ul className="mt-2 space-y-1 text-sm">
          <li>🐛 Баг подтверждён — 50 баллов</li>
          <li>💡 Идея принята в план — 100 баллов</li>
          <li>👍 Просто хорошая идея — 20 баллов</li>
          <li>📝 Отзыв — 5 баллов</li>
          <li>👤 Приглашённый друг зарегистрировался — 30</li>
          <li>💳 Приглашённый друг оплатил подписку — 200</li>
          <li>🔥 30 дней тренировок подряд — 100</li>
          <li>🏆 100 тренировок всего — 500</li>
        </ul>
      </details>

      <div className="rounded bg-muted p-3 text-sm">
        📅 Баллы начисляем к моменту запуска платного режима, 
        чтобы вы могли сразу применить их при выборе тарифа.
      </div>

      <div>
        <h4 className="font-medium">История</h4>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Пока пусто. Отправьте отзыв или сообщите о баге — начислим баллы после проверки!
          </p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id}>
                {h.amount > 0 ? '+' : ''}{h.amount} — {h.reason}{' '}
                <span className="text-muted-foreground">
                  ({formatDate(h.created_at)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

---

### **БЛОК G: Секция "Условия и документы"**

Файл: `src/components/settings/LegalSection.tsx`

Три раскрывающихся элемента + шаблоны полных документов.

```tsx
<div className="space-y-2 text-sm">
  <details className="rounded border p-2">
    <summary className="cursor-pointer select-none">
      📜 Пользовательское соглашение
    </summary>
    <div className="pt-2 prose prose-sm max-w-none">
      <UserAgreement />
    </div>
  </details>

  <details className="rounded border p-2">
    <summary className="cursor-pointer select-none">
      🔒 Политика конфиденциальности
    </summary>
    <div className="pt-2 prose prose-sm max-w-none">
      <PrivacyPolicy />
    </div>
  </details>

  <details className="rounded border p-2">
    <summary className="cursor-pointer select-none">
      ✅ Согласие на обработку персональных данных
    </summary>
    <div className="pt-2 prose prose-sm max-w-none">
      <DataConsent />
    </div>
  </details>

  <div className="pt-3 text-xs text-muted-foreground">
    ⚠️ Согласие с этими документами будет запрашиваться при оформлении подписки.
  </div>
</div>
```

**Тексты документов** (Роман просил полные с доками):

Кот делает файлы в `src/legal/`:
- `user-agreement.tsx` — Пользовательское соглашение (полный текст, шаблон РФ, ≥1500 слов)
- `privacy-policy.tsx` — Политика конфиденциальности (152-ФЗ РФ, GDPR-совместимая, ≥1500 слов)
- `data-consent.tsx` — Согласие на обработку персональных данных (по 152-ФЗ, ≥800 слов)

Использовать шаблон медицинского приложения РФ. **Обязательно указать в конце каждого документа:**
- Владелец: ФИО Романа
- Контакт: @gimn_zdorovia_bot
- Дата вступления в силу: [дата запуска платного, ставим placeholder `[ДАТА_ЗАПУСКА]`]

Роман потом:
- Согласует с юристом
- Заменит placeholder на реальную дату
- Заменит контакт если появится юрадрес

**Также сгенерировать PDF-версии** этих документов через `pdfkit` или `puppeteer`:
- `public/legal/user-agreement.pdf`
- `public/legal/privacy-policy.pdf`
- `public/legal/data-consent.pdf`

В `LegalSection.tsx` добавить рядом с каждым разделом:
```tsx
<a href="/legal/user-agreement.pdf" download className="text-xs underline">
  Скачать PDF для распечатки
</a>
```

---

### **БЛОК H: Шаблон стартового бонуса (НЕ применяется сейчас)**

Файл: `supabase/migrations/YYYYMMDD_tester_bonus.sql.template` (без даты, чтобы не применилась случайно)

```sql
-- ПРИМЕНИТЬ ЗА НЕДЕЛЮ ДО ЗАПУСКА ПЛАТНОГО ТАРИФА
-- Начисление 1000 баллов всем зарегистрированным тестерам

INSERT INTO user_points (user_id, points)
SELECT id, 1000 FROM users
ON CONFLICT (user_id) 
DO UPDATE SET points = user_points.points + 1000, updated_at = now();

INSERT INTO points_history (user_id, amount, reason, reference_type)
SELECT id, 1000, 'Стартовый бонус тестера', 'bonus' FROM users;

-- После применения — рассылка через бота:
-- "Роман, за участие в тестовом периоде — 1000 баллов на ваш счёт.
--  Их можно применить при выборе тарифа. Подробнее в настройках."
```

Файл `README.md` проекта — секция "TODO перед платным запуском":
- [ ] Применить `YYYYMMDD_tester_bonus.sql.template` за неделю до
- [ ] Отправить рассылку из бота о бонусе
- [ ] Заменить `[ДАТА_ЗАПУСКА]` в legal-документах на реальную
- [ ] Согласовать legal-документы с юристом
- [ ] Оформить самозанятость или ИП
- [ ] Подключить ЮKassa

---

## ✅ САМОПРОВЕРКА

```bash
npx tsc --noEmit          # 0 ошибок
npm run lint              # 0 ошибок
npm run build             # exit 0
npm run check:turnik      # 23/23 (регрессии GIMN-022 нет)
```

**После сборки — ОТКРЫТЬ preview URL в headless-браузере/curl'ом:**
- `curl -s https://[preview]/vercel.app/ | grep -c "logo-mark.svg"` — должно быть ≥1
- `curl -s https://[preview]/vercel.app/ | grep -c "Войти через Telegram"` — должно быть ≥1
- `curl -s https://[preview]/vercel.app/ | grep -c ">Г<"` — должно быть **0** (нет буквы Г как содержимого)

**Визуальные проверки для Романа** (перечислить в отчёте):
1. Открыть `https://gimn-zdorovia.vercel.app` — иконка человечка (не "Г")
2. На главной кнопка "Войти через Telegram" + fallback ссылка
3. Текст: "Идёт тестовый режим — приложение бесплатно"
4. Настройки: все секции свёрнуты, "Оформление" — открыта по умолчанию
5. Клик каждой секции → раскрывается плавно
6. Секция "Тарифы": 3 плана 399/799/1490₽, БЕЗ кнопок оплаты, есть плашка про тест
7. Секция "Мои баллы": счётчик "0", "Как получать?" раскрывается, "История" — пусто
8. Секция "Условия": три документа + кнопки "Скачать PDF"
9. Скачать один PDF — открывается корректно
10. Тема light → dark → аккордеон работает в обеих
11. Отправить отзыв в форме — сообщение приходит в Telegram (не сломано)

---

## 📌 ОБНОВИТЬ

- **PROJECT_MAP.md** — добавить:
  - `/api/points`, `/api/points/history`
  - `src/lib/points/service.ts`
  - `src/components/settings/{TariffsSection,PointsSection,LegalSection}.tsx`
  - `src/legal/{user-agreement,privacy-policy,data-consent}.tsx`
  - `public/legal/*.pdf`
  - `supabase/migrations/0020_points_system.sql`
  - `supabase/migrations/YYYYMMDD_tester_bonus.sql.template`
- **MINES.md** — добавить мину:
  - "Отчёты кота о правках на главной странице проверять preview URL перед коммитом. Прошлые GIMN-023 и GIMN-026 отчитались 'сделано', по факту не работало."
- **README.md** — секция "TODO перед платным запуском" (см. БЛОК H)

---

## 🚀 ДЕПЛОЙ

Отдельными коммитами по логическим блокам:
1. `GIMN-027-A: главная — логотип, кнопка входа с fallback, текст тестового режима`
2. `GIMN-027-B: аккордеон настроек (9 секций)`
3. `GIMN-027-C: миграция 0020 — таблицы баллов + расширение feedback (применена)`
4. `GIMN-027-D: сервис баллов (backend + API + unit-тест)`
5. `GIMN-027-E: секция Тарифы (399/799/1490₽ без оплаты)`
6. `GIMN-027-F: секция Мои баллы (счётчик, история, инструкция)`
7. `GIMN-027-G: секция Условия + документы + PDF генерация`

Пуш `main` → автодеплой Actions.

**Миграцию 0020 применяешь сам** через SERVICE_ROLE_KEY — в отчёте только "миграция 0020 применена", содержимое ключа не показывать.

---

## 🔙 ОГЛЯДЫВАЮСЬ НАЗАД

Открытые пункты:
- ⏸ GIMN-028 (Зал MVP + автопрогрессия) — следующий батч
- ⏸ GIMN-029 (мобильная версия + документы на распечатку) — третий батч
- ⏸ GIMN-025 (видео wger — я ищу ссылки) — параллельно
- ⏸ Live testing 18 пунктов CHECKLIST_TESTING.md — после трёх батчей
- ⏸ Показать DOC_REVMATOLOG_CHECKLIST_gimn.docx врачу
- ⏸ Самозанятость/ИП (Роман решает позже)
- ⏸ ЮKassa (после самозанятости)
- ⏸ Мобильный вход (SMS/Email/соцсети) — в GIMN-029

---

## ⏱ ВРЕМЯ

- ШАГ 0 разведка: 5-10 мин
- Блок A (главная): 15 мин
- Блок B (аккордеон): 20 мин
- Блок C (миграция): 5 мин
- Блок D (сервис баллов + API): 30 мин
- Блок E (тарифы): 15 мин
- Блок F (баллы UI): 20 мин
- Блок G (условия + PDF): 40 мин (полные тексты + PDF генерация)
- Блок H (шаблон бонуса): 5 мин
- Самопроверка + preview URL проверки: 15 мин
- Коммиты + пуш: 5 мин

**Итого кот: ~3 часа**

---

**Готов. Отдавай коту.**
