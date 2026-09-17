# Гимн.здоровья — Техническая спецификация

> Версия: 1.0 | Дата: 2026-09-17 | Статус: Production-ready
> Источник истины: этот документ. Все решения по бизнес-логике, схеме
> данных, API и UX зафиксированы здесь. AI-агент (Claude Code) обязан
> следовать спецификации буквально, не додумывая.
>
> **Владелец:** Роман (Медведь), AI-Архитектор
> **Проект:** F:\Project gimn zdorovia
> **Секреты:** F:\Project gimn zdorovia\secrets\.env
> **GitHub:** https://github.com/Romanchik42/gimn-zdorovia
> **Vercel:** https://gimn-zdorovia.vercel.app
> **Telegram bot:** @gimn_zdorovia_bot

---

## БЛОК 0. Обзор проекта

### 0.1. Что это

Гимн.здоровья — веб-приложение (PWA) + Telegram-бот для двух категорий
пользователей:

1. **Пациенты с болезнью Бехтерева (анкилозирующий спондилит)** — ежедневная
   реабилитационная гимнастика с автономной адаптацией программы под
   диагностику, побочные эффекты и прогресс.

2. **Обычные пользователи, работающие с телом** — похудение, набор мышечной
   массы, поддержание формы с составлением рациона питания из доступных
   продуктов и циклической программой тренировок по группам мышц.

Оба режима работают в **одном приложении**. При первом входе пользователь
выбирает свой режим (Бехтерева / Общая форма), проходит соответствующую
диагностику или анкету — дальше система ведёт его автономно.

Цель MVP — за 3 месяца после запуска получить 100+ активных пользователей
(3+ занятия в неделю) с retention > 40% на 30-й день.

### 0.2. Стек технологий (фиксированный)

| Слой | Технология | Версия |
|------|-----------|--------|
| Frontend | Next.js (App Router, PWA-режим) | 16.x |
| Язык | TypeScript | 5.x (strict) |
| Стили | Tailwind CSS | 4.x |
| UI-кит | shadcn/ui | latest (CLI шаблон) |
| Темизация | CSS Variables (3 темы) | — |
| Иконки | lucide-react | latest |
| Формы | react-hook-form + @hookform/resolvers | latest |
| Валидация | Zod | latest |
| Backend (БД) | Supabase PostgreSQL | 15+ |
| Аутентификация | Supabase Auth (Telegram + Email) | latest |
| Хостинг фронта | Vercel | — |
| Автодеплой | GitHub Actions (уже настроен) | — |
| Уведомления | Telegram Bot API + Web Push | — |
| Планировщик | cron-job.org → /api/cron/* | — |
| Тост-уведомления UI | sonner (через shadcn) | latest |
| Хранение картинок/GIF | Supabase Storage | — |
| Пакетный менеджер | pnpm | 9.x |
| PWA | next-pwa или Workbox | latest |

**Запрещено в MVP:** платежи, LLM-агенты в рантайме, Stripe, OpenAI/Anthropic
API (только явные правила), Edge Functions, Server Actions для форм
(используем API Routes).

### 0.3. Роли пользователей

| Роль | Описание | Доступ |
|------|----------|--------|
| Гость (anon) | Не залогинен | Лендинг, регистрация, вход |
| Пользователь (authenticated) | Залогинен | Свой профиль, программа, история, меню, настройки |
| Админ (Роман) | Владелец проекта | Все данные через Supabase Studio, ручное редактирование БД упражнений |

Аутентификация в MVP: **Telegram Login Widget** (основной способ) +
**Email/Password** (резерв). Никаких OAuth в MVP.

### 0.4. URL-маршруты

**Веб-приложение (пользователь):**

| Путь | Метод | Описание | Доступ |
|------|-------|----------|--------|
| `/` | GET | Лендинг: описание, скриншоты, регистрация | Публичный |
| `/auth/login` | GET | Вход (Telegram Widget + Email форма) | Гость |
| `/auth/register` | GET | Регистрация с выбором режима | Гость |
| `/onboarding/mode` | GET | Выбор режима: Бехтерева / Общая форма | Пользователь |
| `/onboarding/behtereva` | GET | Диагностика: тест Шобера, наклоны, ротация | Пользователь |
| `/onboarding/general` | GET | Анкета: вес, рост, цель (похудеть/набрать/держать) | Пользователь |
| `/onboarding/theme` | GET | Выбор темы (Sage / Terracotta / Ocean) | Пользователь |
| `/app` | GET | Главный экран: сегодняшняя тренировка + меню | Пользователь |
| `/app/workout/[id]` | GET | Экран тренировки: карточки упражнений | Пользователь |
| `/app/nutrition` | GET | Меню на день/неделю + список покупок | Пользователь |
| `/app/progress` | GET | Прогресс: график гибкости, веса, скованности | Пользователь |
| `/app/history` | GET | История занятий и отметок | Пользователь |
| `/app/settings` | GET | Настройки: тема, время напоминаний, режим | Пользователь |

**API Routes (публичные и служебные):**

| Путь | Метод | Описание |
|------|-------|----------|
| `/api/auth/telegram` | POST | Обработка Telegram Login Widget |
| `/api/onboarding/diagnostics` | POST | Сохранение первичной диагностики |
| `/api/workout/generate` | POST | Генерация тренировки на сегодня по правилам |
| `/api/workout/feedback` | POST | Отметка ✅ / ⚠️ / ❌ по упражнению |
| `/api/nutrition/generate` | POST | Генерация меню на неделю по параметрам |
| `/api/progress/monthly` | POST | Генерация месячного отчёта |
| `/api/telegram/webhook` | POST | Webhook от Telegram (команды бота) |
| `/api/cron/morning-reminder` | POST | Утренние напоминания (07:00) |
| `/api/cron/evening-reminder` | POST | Вечерние напоминания (18:00) |
| `/api/cron/monthly-report` | POST | Месячный отчёт (1-е число месяца) |

**Telegram-бот команды:**

| Команда | Описание |
|---------|----------|
| `/start` | Приветствие + ссылка на веб-приложение |
| `/today` | Сегодняшняя тренировка (краткий вид + ссылка) |
| `/menu` | Меню на сегодня |
| `/progress` | Краткий отчёт (гибкость, вес) |
| `/help` | Список команд + связь с автором |

### 0.5. Структура проекта (целевая)

```
gimn-zdorovia/
├── .env.local                    # секреты (НЕ в git)
├── .env.example                  # шаблон секретов (в git)
├── .gitignore
├── .vercelignore                 # защита secrets/, .github/
├── .github/
│   └── workflows/
│       └── deploy.yml            # автодеплой в Vercel (уже настроен)
├── README.md
├── components.json               # shadcn config
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── public/
│   ├── favicon.ico
│   ├── manifest.json             # PWA манифест
│   ├── icons/                    # PWA иконки (192, 512)
│   └── exercises/                # GIF упражнений (или в Supabase Storage)
├── supabase/
│   └── migrations/
│       ├── 0001_users_and_profiles.sql
│       ├── 0002_exercises_and_sequences.sql
│       ├── 0003_workout_history.sql
│       ├── 0004_nutrition.sql
│       ├── 0005_progress_and_reports.sql
│       ├── 0006_side_effect_rules.sql
│       └── 0007_telegram_and_notifications.sql
├── secrets/
│   ├── .env                      # ЛОКАЛЬНЫЕ секреты Романа
│   ├── .env.example
│   └── README.md
└── src/
    ├── app/
    │   ├── layout.tsx            # RootLayout + Toaster + PWA + темизация
    │   ├── page.tsx              # Лендинг
    │   ├── globals.css           # Tailwind + 3 темы (CSS variables)
    │   ├── auth/
    │   │   ├── login/page.tsx
    │   │   └── register/page.tsx
    │   ├── onboarding/
    │   │   ├── mode/page.tsx
    │   │   ├── behtereva/page.tsx
    │   │   ├── general/page.tsx
    │   │   └── theme/page.tsx
    │   ├── app/
    │   │   ├── layout.tsx        # Bottom-nav для авторизованных
    │   │   ├── page.tsx          # Главный экран
    │   │   ├── workout/[id]/page.tsx
    │   │   ├── nutrition/page.tsx
    │   │   ├── progress/page.tsx
    │   │   ├── history/page.tsx
    │   │   └── settings/page.tsx
    │   └── api/
    │       ├── auth/telegram/route.ts
    │       ├── onboarding/diagnostics/route.ts
    │       ├── workout/
    │       │   ├── generate/route.ts
    │       │   └── feedback/route.ts
    │       ├── nutrition/generate/route.ts
    │       ├── progress/monthly/route.ts
    │       ├── telegram/webhook/route.ts
    │       └── cron/
    │           ├── morning-reminder/route.ts
    │           ├── evening-reminder/route.ts
    │           └── monthly-report/route.ts
    ├── components/
    │   ├── ui/                   # shadcn компоненты
    │   ├── layout/
    │   │   ├── bottom-nav.tsx
    │   │   └── theme-provider.tsx
    │   ├── exercise/
    │   │   ├── exercise-card.tsx # Универсальная карточка (Nike-style)
    │   │   ├── exercise-gif.tsx
    │   │   └── feedback-buttons.tsx
    │   ├── nutrition/
    │   │   ├── meal-card.tsx
    │   │   └── shopping-list.tsx
    │   ├── onboarding/
    │   │   ├── shober-test.tsx
    │   │   ├── side-bend-test.tsx
    │   │   └── theme-picker.tsx
    │   └── progress/
    │       ├── flexibility-chart.tsx
    │       └── weight-chart.tsx
    └── lib/
        ├── utils.ts              # cn() от shadcn
        ├── env.ts                # Zod-валидация env-переменных
        ├── schemas/
        │   ├── user.ts
        │   ├── diagnostics.ts
        │   ├── workout-feedback.ts
        │   └── nutrition.ts
        ├── supabase/
        │   ├── admin.ts          # server-only клиент (service_role)
        │   ├── client.ts         # public клиент (anon)
        │   └── server.ts         # SSR клиент
        ├── telegram/
        │   ├── bot.ts            # sendMessage, sendPhoto
        │   ├── webhook.ts        # обработка команд
        │   └── login-widget.ts   # верификация Telegram OAuth
        ├── workout-engine/
        │   ├── generator.ts      # логика подбора упражнений на день
        │   ├── side-effect-rules.ts # Decision Tree (побочки → действия)
        │   ├── adaptation.ts     # ежемесячная адаптация программы
        │   └── weekly-cycle.ts   # 7-дневный цикл по суставам
        ├── nutrition-engine/
        │   ├── calorie-calculator.ts  # Миффлин-Сан-Жеор
        │   ├── menu-generator.ts      # подбор блюд под калораж
        │   └── shopping-list.ts       # агрегация продуктов на неделю
        ├── themes.ts             # 3 темы + управление
        └── rate-limit.ts         # in-memory Map<user_id, timestamp>
```

---

## БЛОК 1. User Stories

### US-01. Пациент с Бехтерева регистрируется и проходит диагностику

**Как** пациент с болезнью Бехтерева,
**я хочу** пройти первичную диагностику через Telegram или веб,
**чтобы** приложение подобрало мне индивидуальную программу.

**Сценарий:**
1. Открываю https://gimn-zdorovia.vercel.app.
2. Кликаю "Войти через Telegram" — открывается Telegram Login Widget.
3. Подтверждаю в Telegram — попадаю на `/onboarding/mode`.
4. Выбираю "Реабилитация Бехтерева" — попадаю на `/onboarding/behtereva`.
5. Прохожу диагностику (5 экранов):
   - Экран 1: Тест Шобера (ввожу результат в см, или "не знаю")
   - Экран 2: Боковой наклон (см вправо/влево, или "не знаю")
   - Экран 3: Ротация позвоночника (градусы или "не знаю")
   - Экран 4: Где болит сейчас (мультивыбор: плечо, шея, поясница, ноги, нигде)
   - Экран 5: Скованность утром (мало / средне / много), давление в норме (да/нет)
6. Выбираю тему оформления (Sage / Terracotta / Ocean).
7. Попадаю на `/app` — вижу подготовленную первую тренировку.

**Критерии приёмки:**
- [ ] Каждый шаг диагностики можно пропустить ("не знаю") — программа адаптируется под минимум данных.
- [ ] Все ответы сохраняются в `user_diagnostics` с timestamp.
- [ ] На основе ответов система рассчитывает `intensity_level` (low / medium / normal) и `focus_joints` (позвоночник / плечи / комбо).
- [ ] Диагностику можно пройти повторно раз в 30 дней (для адаптации).

---

### US-02. Пользователь общей формы регистрируется и заполняет анкету

**Как** обычный пользователь без болезни Бехтерева,
**я хочу** быстро заполнить анкету о своих данных и цели,
**чтобы** получить программу тренировок и меню питания.

**Сценарий:**
1. Регистрация через Telegram.
2. Выбираю "Общая форма" на `/onboarding/mode`.
3. Прохожу анкету (`/onboarding/general`):
   - Пол (м/ж)
   - Возраст (число)
   - Вес (кг, с одной цифрой после запятой)
   - Рост (см)
   - Цель: похудеть / набрать массу / поддерживать форму
   - Уровень активности: сидячий / лёгкий / средний / высокий / очень высокий
   - Сложность тренировок: новичок / средний / продвинутый
   - Дни в неделю для тренировок (мультивыбор Пн-Вс)
4. Выбираю тему оформления.
5. Попадаю на `/app` — вижу первую тренировку и меню на день.

**Критерии приёмки:**
- [ ] Все поля валидируются через Zod (вес 30-300 кг, рост 100-250 см, возраст 14-100).
- [ ] Формула Миффлина-Сан-Жеора считает BMR → TDEE → суточную норму калорий.
- [ ] Программа тренировок собирается на основе цикла (см. БЛОК 5.4).
- [ ] Меню подбирается под калораж ±5%.

---

### US-03. Пользователь выполняет тренировку и отмечает упражнения

**Как** пользователь,
**я хочу** видеть каждое упражнение с GIF, описанием техники и кнопками
для отметки результата,
**чтобы** заниматься самостоятельно и передавать данные системе для
адаптации программы.

**Сценарий:**
1. Открываю `/app` — вижу карточку "Сегодня: Позвоночник (35 мин)" с кнопкой "Начать".
2. Кликаю "Начать" → попадаю на `/app/workout/[id]`.
3. Вижу список упражнений (10-15 шт) в порядке: **дыхание → разминка → основные → растяжка**.
4. Кликаю на первое упражнение — открывается универсальная **Nike-style карточка**:
   - Сверху GIF/картинка со стрелочками направления движения
   - Название упражнения
   - Длительность / повторения (например, "30 секунд" или "8-10 повторений")
   - Описание техники (2-3 предложения)
   - Три кнопки внизу: [✅ Сделал] [⚠️ Сложно] [❌ Пропустить]
5. Нажимаю [✅ Сделал] — карточка закрывается, автоматически открывается следующее упражнение.
6. В конце тренировки — экран "Тренировка завершена!" с общим результатом (сделано X из Y).
7. Все отметки уходят в `workout_feedback` и учитываются при следующей генерации.

**Happy path:** карточка → GIF → техника → нажал кнопку → следующее.

**Error path:** если GIF не загрузился — показываем статичную картинку + описание. Если ни то, ни другое — только текст с пометкой "Демонстрация недоступна, свяжитесь с автором".

**Критерии приёмки:**
- [ ] Универсальная карточка одна на все упражнения (одна форма, один цвет, одна типография).
- [ ] Кнопки высотой ≥ 56px (крупный touch-target для людей с ограниченной подвижностью).
- [ ] GIF загружается lazy, с placeholder-скелетоном.
- [ ] После нажатия любой кнопки — автопереход к следующему через 500 мс.
- [ ] Можно вернуться к предыдущему упражнению стрелкой "назад".
- [ ] Прогресс сохраняется даже если пользователь ушёл в середине (частичная тренировка).

---

### US-04. Система реагирует на побочные эффекты (Decision Tree)

**Как** пациент с Бехтерева,
**я хочу** сообщить о плохом самочувствии во время упражнения (боль,
давление, судорога),
**чтобы** система дала мне безопасный совет и адаптировала следующую тренировку.

**Сценарий:**
1. Во время упражнения кликаю кнопку "⚠️ Плохо" (третья опция в карточке).
2. Появляется модальное окно "Что случилось?":
   - Головная боль / давление
   - Судорога в мышце
   - Острая боль в суставе
   - Тошнота / головокружение
   - Другое
3. Выбираю "Давление / головная боль".
4. Система показывает советы из Decision Tree (см. БЛОК 5.2):
   - "Прерви тренировку на 5 минут"
   - "Сядь с приподнятой головой"
   - "Измерь давление, если возможно"
   - "Пей воду мелкими глотками"
5. Кнопки внизу: [Продолжить осторожно] [Завершить тренировку]
6. Информация сохраняется в `side_effect_events`.
7. Завтрашняя тренировка автоматически будет мягче (снижение интенсивности на 20%).

**Критерии приёмки:**
- [ ] Каждое сообщение о побочке привязано к конкретному упражнению.
- [ ] Правила Decision Tree хранятся в БД (`side_effect_rules`), не хардкод.
- [ ] Если побочка повторяется 3 раза за неделю — приложение показывает баннер "Рекомендуем консультацию врача".

---

### US-05. Пользователь получает меню на день с рецептами

**Как** пользователь общей формы, стремящийся похудеть,
**я хочу** видеть меню на день с калоражем и простыми рецептами,
**чтобы** не думать, что готовить.

**Сценарий:**
1. На `/app/nutrition` вижу вкладки: "Сегодня", "Неделя", "Покупки".
2. Вкладка "Сегодня" показывает:
   - **Завтрак** (07:00-09:00): "Овсянка на воде + яйцо + яблоко" — 420 ккал (Б:22, Ж:12, У:55)
   - **Обед** (13:00-15:00): "Куриная грудка + гречка + огурец" — 550 ккал
   - **Полдник** (16:00-17:00): "Творог 5% + груша" — 250 ккал
   - **Ужин** (18:30-20:00): "Хек на пару + тушёные овощи" — 380 ккал
   - Итого: 1600 ккал (норма для похудения)
3. Клик на блюдо → раскрывается рецепт (ингредиенты в граммах, шаги приготовления, время).
4. Вкладка "Неделя" — 7 дней с меню.
5. Вкладка "Покупки" — агрегированный список продуктов на неделю с граммами (курица 1400г, гречка 700г и т.д.).

**Критерии приёмки:**
- [ ] Меню подбирается автоматически по калоражу пользователя (±5%).
- [ ] Продукты — из "Топ-30 доступных" (гречка, курица, яйца, овощи и т.д. — см. БЛОК 5.3).
- [ ] Все рецепты ≤ 30 минут приготовления, простые (≤ 6 ингредиентов).
- [ ] Список покупок можно "отметить как купленное" (галочка сохраняется).
- [ ] Меню обновляется еженедельно (утро понедельника).

---

### US-06. Пользователь настраивает время напоминаний

**Как** пользователь,
**я хочу** сам выбрать время утренней и вечерней тренировки,
**чтобы** приложение напоминало мне в удобное время (не в дефолтное 07:00).

**Сценарий:**
1. Иду в `/app/settings` → раздел "Напоминания".
2. Вижу:
   - Утренняя тренировка: [07:00] (можно изменить)
   - Вечерняя тренировка: [18:00] (можно изменить)
   - Совет системы: "Оптимальное время для ЛФК — 11:00-14:00 и 17:00-20:00" (справочно, не навязываем)
3. Меняю утреннюю на 09:00.
4. Система сохраняет в `users.morning_reminder_time`.
5. На следующее утро в 09:00 приходит уведомление в Telegram: "🏋️ Пора зарядку делать! Открой приложение".

**Критерии приёмки:**
- [ ] Время задаётся в формате HH:MM с шагом 15 минут.
- [ ] Можно полностью отключить напоминания (галочка).
- [ ] Напоминание приходит в Telegram (основной канал) и как Web Push (если разрешил браузер).

---

### US-07. Пользователь смотрит месячный прогресс

**Как** пользователь,
**я хочу** видеть, как улучшилась моя гибкость / снизился вес / уменьшилась
скованность за месяц,
**чтобы** видеть результат и мотивироваться.

**Сценарий:**
1. Иду на `/app/progress`.
2. Вижу графики:
   - Гибкость (тест Шобера в см) за 3 месяца — растёт с 4 см до 6 см ✅
   - Вес (кг) за 3 месяца — снизился с 92 до 88 ✅
   - Скованность утром (баллы 1-10) — снизилась с 8 до 5 ✅
   - Занятия в неделю (столбиковая диаграмма) — стабильно 5/7
3. Снизу — блок "Рекомендация системы":
   - "Твоя гибкость растёт стабильно. Со следующей недели усложняем: добавляем 2 новых упражнения на скручивание."
4. 1-го числа каждого месяца в Telegram приходит "Месячный отчёт" (PDF или карточка).

**Критерии приёмки:**
- [ ] Данные обновляются каждый раз, когда пользователь заполняет диагностику или взвешивается.
- [ ] Графики читаемы на мобильном (ширина 320px минимум).
- [ ] Месячный отчёт содержит: изменения показателей, количество занятий, рекомендацию системы.

---

### US-08. Пользователь переключает тему оформления

**Как** пользователь,
**я хочу** выбирать тему приложения из 3 вариантов (Sage / Terracotta / Ocean),
**чтобы** приложение соответствовало моему настроению и не резало глаза.

**Сценарий:**
1. `/app/settings` → "Оформление".
2. Три плитки с превью:
   - **Sage** (шалфейный зелёный, мягкий) — по умолчанию
   - **Terracotta** (тёплый терракот)
   - **Ocean** (морской бирюзовый)
3. Кликаю на плитку — приложение мгновенно перекрашивается (без перезагрузки).
4. Опционально: галочка "Авто-смена по времени" — утром Sage, вечером Terracotta.

**Критерии приёмки:**
- [ ] Смена темы через `data-theme` на `<html>`, без перезагрузки.
- [ ] Выбор сохраняется в `users.theme` и синхронизируется между устройствами.
- [ ] Каждая тема имеет полный набор CSS-переменных (см. БЛОК 4.2).

---

### US-09. Роман (админ) добавляет новое упражнение в базу

**Как** админ (Роман),
**я хочу** добавить новое упражнение в БД через Supabase Studio,
**чтобы** оно появилось у пользователей в следующей тренировке.

**Сценарий:**
1. Захожу в Supabase Studio → таблица `exercises`.
2. Кликаю "Insert row".
3. Заполняю поля: name, type, target_joint, description, gif_url,
   duration_sec, level, contraindications и т.д.
4. Сохраняю. Упражнение сразу попадает в пул для генерации тренировок.
5. Через несколько дней в аналитике вижу: 47 пользователей выполнили это упражнение, 3 нажали "⚠️ Сложно".

**Критерии приёмки:**
- [ ] Все поля документированы через COMMENT ON COLUMN.
- [ ] RLS позволяет админу (authenticated) INSERT/UPDATE, но не DELETE.
- [ ] После INSERT новое упражнение попадает в генерацию с задержкой ≤ 1 час.

---

## БЛОК 2. Data Model

### 2.1. Диаграмма таблиц

```
users (профили)
├── id (UUID, PK)
├── telegram_id, telegram_username
├── email
├── name, gender, birth_date
├── mode: 'behtereva' | 'general'
├── theme: 'sage' | 'terracotta' | 'ocean'
├── auto_theme (bool)
├── morning_reminder_time, evening_reminder_time
├── reminders_enabled (bool)
└── created_at, updated_at

user_diagnostics (диагностика для Бехтерева)
├── id (UUID, PK)
├── user_id → users.id
├── shober_test_cm, side_bend_left_cm, side_bend_right_cm, rotation_degrees
├── pain_areas (JSONB: массив ['shoulder', 'neck', ...])
├── stiffness_level: 'low' | 'medium' | 'high'
├── blood_pressure_ok (bool)
├── calculated_intensity: 'low' | 'medium' | 'normal'
├── calculated_focus (JSONB: массив ['spine', 'shoulders', ...])
└── created_at

user_profiles_general (анкета для общего режима)
├── id (UUID, PK)
├── user_id → users.id
├── weight_kg, height_cm
├── goal: 'lose' | 'gain' | 'maintain'
├── activity_level: 'sedentary' | 'light' | 'medium' | 'high' | 'very_high'
├── difficulty: 'beginner' | 'intermediate' | 'advanced'
├── training_days (JSONB: [1,2,3,4,5] где 1=Пн)
├── calculated_bmr, calculated_tdee, calculated_target_calories
└── created_at, updated_at

exercises (справочник упражнений)
├── id (UUID, PK)
├── name (varchar 200)
├── type: 'breathing' | 'warmup' | 'main' | 'stretch' | 'massage'
├── target_joint: 'spine' | 'shoulder' | 'neck' | 'legs' | 'hips' | 'core' | 'full_body'
├── mode: 'behtereva' | 'general' | 'both'
├── description (text)
├── technique (text) — пошаговая техника
├── gif_url (text) — ссылка на GIF/картинку
├── duration_sec (int) OR repetitions (int)
├── level: 'beginner' | 'intermediate' | 'advanced'
├── contraindications (JSONB: ['high_blood_pressure', 'shoulder_pain', ...])
├── side_effects (JSONB: [{trigger: 'pressure_up', action: 'reduce_intensity'}, ...])
└── created_at

workout_sequences (шаблоны последовательностей на день)
├── id (UUID, PK)
├── mode: 'behtereva' | 'general'
├── day_of_week (int 1-7)
├── focus_joint
├── intensity: 'low' | 'medium' | 'normal'
├── exercises_order (JSONB: [{exercise_id, duration_or_reps, order}])
├── total_duration_min
└── created_at

user_workouts (реальные тренировки пользователя)
├── id (UUID, PK)
├── user_id → users.id
├── scheduled_date (date)
├── started_at, completed_at
├── status: 'planned' | 'in_progress' | 'completed' | 'skipped'
├── generated_from_sequence_id → workout_sequences.id (может быть NULL для кастомных)
├── exercises_snapshot (JSONB: копия упражнений на момент генерации)
└── created_at

workout_feedback (отметки по упражнениям)
├── id (UUID, PK)
├── user_id → users.id
├── user_workout_id → user_workouts.id
├── exercise_id → exercises.id
├── status: 'done' | 'difficult' | 'skipped'
├── notes (text, optional)
└── created_at

side_effect_events (побочки во время тренировки)
├── id (UUID, PK)
├── user_id → users.id
├── user_workout_id → user_workouts.id
├── exercise_id → exercises.id
├── symptom: 'pressure_up' | 'headache' | 'cramp' | 'joint_pain' | 'nausea' | 'other'
├── description (text)
├── action_taken: 'continued' | 'paused' | 'stopped'
└── created_at

side_effect_rules (Decision Tree — правила реакции на побочки)
├── id (UUID, PK)
├── symptom
├── conditions (JSONB: {exercise_type, target_joint, ...})
├── advice (JSONB: [{text, order}]) — что показать пользователю
├── next_workout_adjustment: 'none' | 'reduce_intensity_20' | 'skip_joint' | 'lighter_only'
├── require_doctor_visit_threshold (int) — сколько раз за неделю → врач
└── created_at

meals (справочник блюд)
├── id (UUID, PK)
├── name (varchar 200)
├── meal_type: 'breakfast' | 'lunch' | 'snack' | 'dinner'
├── ingredients (JSONB: [{product, grams, kcal}])
├── total_kcal, total_protein_g, total_fat_g, total_carbs_g
├── cook_time_min
├── recipe (text) — пошаговый рецепт
├── contraindications (JSONB: ['diabetes', 'gluten_intolerance', ...])
└── created_at

user_meals (меню пользователя на конкретную дату)
├── id (UUID, PK)
├── user_id → users.id
├── date (date)
├── meal_type
├── meal_id → meals.id
├── consumed (bool)
└── created_at

shopping_list (список покупок на неделю)
├── id (UUID, PK)
├── user_id → users.id
├── week_start_date (date)
├── items (JSONB: [{product, grams, purchased: bool}])
└── created_at, updated_at

user_progress (снимок прогресса — снимается автоматически раз в неделю)
├── id (UUID, PK)
├── user_id → users.id
├── date (date)
├── weight_kg (nullable)
├── shober_test_cm (nullable)
├── stiffness_level (nullable, 1-10)
├── workouts_this_week (int)
├── streak_days (int)
└── created_at

monthly_reports (сгенерированные месячные отчёты)
├── id (UUID, PK)
├── user_id → users.id
├── month (date, первое число месяца)
├── flexibility_change_percent (numeric)
├── weight_change_kg (numeric)
├── stiffness_change (int)
├── total_workouts (int)
├── recommendation (text) — что система советует
├── sent_to_telegram (bool)
└── created_at

notifications_log (журнал отправленных уведомлений)
├── id (UUID, PK)
├── user_id → users.id
├── type: 'morning_reminder' | 'evening_reminder' | 'monthly_report' | ...
├── channel: 'telegram' | 'push' | 'email'
├── status: 'sent' | 'failed'
├── error (text, nullable)
└── sent_at
```

### 2.2. Миграции (порядок и содержимое)

**Файл:** `supabase/migrations/0001_users_and_profiles.sql`

```sql
-- Расширения
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Основная таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE,
  telegram_username VARCHAR(100),
  email VARCHAR(200) UNIQUE,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  birth_date DATE,
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),
  theme VARCHAR(20) NOT NULL DEFAULT 'sage' CHECK (theme IN ('sage', 'terracotta', 'ocean')),
  auto_theme BOOLEAN NOT NULL DEFAULT FALSE,
  morning_reminder_time TIME NOT NULL DEFAULT '07:00',
  evening_reminder_time TIME NOT NULL DEFAULT '18:00',
  reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE users IS 'Пользователи Гимн.здоровья';
COMMENT ON COLUMN users.mode IS 'Режим: behtereva (реабилитация) или general (общая форма)';
COMMENT ON COLUMN users.theme IS 'Тема оформления: sage (шалфейный), terracotta (терракот), ocean (бирюза)';

CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_email ON users(email);

-- Триггер updated_at (переиспользуется во всех таблицах)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Диагностика для Бехтерева
CREATE TABLE IF NOT EXISTS user_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shober_test_cm NUMERIC(5,2),
  side_bend_left_cm NUMERIC(5,2),
  side_bend_right_cm NUMERIC(5,2),
  rotation_degrees NUMERIC(5,2),
  pain_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
  stiffness_level VARCHAR(10) NOT NULL CHECK (stiffness_level IN ('low', 'medium', 'high')),
  blood_pressure_ok BOOLEAN NOT NULL DEFAULT TRUE,
  calculated_intensity VARCHAR(10) NOT NULL CHECK (calculated_intensity IN ('low', 'medium', 'normal')),
  calculated_focus JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_diagnostics_user ON user_diagnostics(user_id, created_at DESC);

-- Анкета для общего режима
CREATE TABLE IF NOT EXISTS user_profiles_general (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  weight_kg NUMERIC(5,1) NOT NULL CHECK (weight_kg BETWEEN 30 AND 300),
  height_cm INT NOT NULL CHECK (height_cm BETWEEN 100 AND 250),
  goal VARCHAR(20) NOT NULL CHECK (goal IN ('lose', 'gain', 'maintain')),
  activity_level VARCHAR(20) NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'medium', 'high', 'very_high')),
  difficulty VARCHAR(20) NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  training_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  calculated_bmr NUMERIC(7,2),
  calculated_tdee NUMERIC(7,2),
  calculated_target_calories NUMERIC(7,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER user_profiles_general_updated_at BEFORE UPDATE ON user_profiles_general
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles_general ENABLE ROW LEVEL SECURITY;

-- Политики: пользователь видит только свои данные
CREATE POLICY "users_read_own" ON users FOR SELECT TO authenticated
  USING (id = auth.uid());
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "diagnostics_read_own" ON user_diagnostics FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "diagnostics_insert_own" ON user_diagnostics FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "profiles_read_own" ON user_profiles_general FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "profiles_upsert_own" ON user_profiles_general FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

**Файл:** `supabase/migrations/0002_exercises_and_sequences.sql`

```sql
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('breathing', 'warmup', 'main', 'stretch', 'massage')),
  target_joint VARCHAR(20) NOT NULL CHECK (target_joint IN ('spine', 'shoulder', 'neck', 'legs', 'hips', 'core', 'full_body')),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general', 'both')),
  description TEXT NOT NULL,
  technique TEXT NOT NULL,
  gif_url TEXT,
  image_url TEXT,
  duration_sec INT,
  repetitions INT,
  level VARCHAR(20) NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  contraindications JSONB NOT NULL DEFAULT '[]'::jsonb,
  side_effects JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (duration_sec IS NOT NULL OR repetitions IS NOT NULL)
);

COMMENT ON TABLE exercises IS 'Справочник упражнений';
COMMENT ON COLUMN exercises.contraindications IS 'JSON массив: например ["high_blood_pressure", "acute_pain"]';
COMMENT ON COLUMN exercises.side_effects IS 'JSON массив правил: [{"trigger":"pressure_up","action":"reduce_intensity"}]';

CREATE INDEX idx_exercises_type ON exercises(type);
CREATE INDEX idx_exercises_target ON exercises(target_joint);
CREATE INDEX idx_exercises_mode ON exercises(mode);

-- Шаблоны последовательностей на день
CREATE TABLE IF NOT EXISTS workout_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode VARCHAR(20) NOT NULL CHECK (mode IN ('behtereva', 'general')),
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  focus_joint VARCHAR(20) NOT NULL,
  intensity VARCHAR(10) NOT NULL CHECK (intensity IN ('low', 'medium', 'normal')),
  exercises_order JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_duration_min INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sequences_mode_day ON workout_sequences(mode, day_of_week);

-- RLS
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sequences ENABLE ROW LEVEL SECURITY;

-- Все залогиненные пользователи могут читать справочники
CREATE POLICY "exercises_read_all" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "sequences_read_all" ON workout_sequences FOR SELECT TO authenticated USING (true);
-- Только админ (через service_role) может изменять
-- (в MVP админ работает через Supabase Studio под своим аккаунтом)
```

**Файлы 0003-0007** — по тому же паттерну (workout_history, nutrition,
progress, side_effect_rules, notifications). Полные тексты сгенерирует
кот при первом батче — они прямолинейные, я расписал сокращённо чтобы
не удлинять spec на 60К строк.

### 2.3. Начальное наполнение справочников (seed)

Кот-код при первой миграции добавит:

- **~50 упражнений** (35 из аудита + 15 общих для general-режима)
- **~14 шаблонов последовательностей** (7 дней × 2 режима)
- **~40 блюд** (7 завтраков × 4 варианта, 7 обедов, 7 ужинов, 5 полдников)
- **~15 правил Decision Tree** (побочки → действия)

Все данные — в отдельном файле `supabase/seed.sql`, применяется после
всех миграций.

---

## БЛОК 3. API Endpoints

### 3.1. POST `/api/auth/telegram`

**Назначение:** обработка Telegram Login Widget (создание/вход пользователя).

**Body:**
```json
{ "id": 123456789, "first_name": "Роман", "username": "Medved_Roman", "auth_date": 1758134400, "hash": "..." }
```

**Логика:**
1. Проверить `hash` через HMAC-SHA256 (см. https://core.telegram.org/widgets/login#checking-authorization).
2. Найти или создать пользователя с этим `telegram_id`.
3. Создать Supabase сессию (magic link или Custom JWT).
4. Вернуть `{ success: true, data: { user_id, is_new_user, next_step } }`.
   - `next_step`: `onboarding_mode` (если новый) или `app` (если существует).

### 3.2. POST `/api/onboarding/diagnostics`

**Body (для Бехтерева):**
```json
{
  "shober_test_cm": 4.5,
  "side_bend_left_cm": 12,
  "side_bend_right_cm": 14,
  "rotation_degrees": 30,
  "pain_areas": ["spine_lumbar", "shoulder_right"],
  "stiffness_level": "high",
  "blood_pressure_ok": true
}
```

**Логика:**
1. Валидация Zod (все поля опциональны — user мог не знать).
2. Расчёт `calculated_intensity`:
   - Если `stiffness_level == 'high'` OR `!blood_pressure_ok` → `low`
   - Если `shober_test_cm < 3` → `low`
   - Если `pain_areas.length > 3` → `low`
   - Иначе → `medium` или `normal`
3. Расчёт `calculated_focus`: приоритет тем зонам, где есть боль/скованность.
4. INSERT в `user_diagnostics`.
5. Ответ: `{ success: true, data: { diagnostics_id, calculated_intensity, calculated_focus, next_step: 'theme' } }`.

### 3.3. POST `/api/workout/generate`

**Body:**
```json
{ "date": "2026-09-17" }
```

**Логика:**
1. Получить `user.mode`, последнюю диагностику/анкету.
2. Определить `day_of_week` (1-7).
3. Выбрать `workout_sequences` для `mode + day_of_week + intensity`.
4. Раскрыть `exercises_order` в реальные упражнения из `exercises`.
5. Отфильтровать упражнения с противопоказаниями:
   - Из `user_diagnostics.pain_areas` → исключить упражнения с
     `contraindications = ['shoulder_pain']` если pain_areas содержит `shoulder`.
6. INSERT в `user_workouts` со снимком упражнений.
7. Ответ: `{ success: true, data: { workout_id, exercises: [...], total_duration_min } }`.

### 3.4. POST `/api/workout/feedback`

**Body:**
```json
{
  "user_workout_id": "uuid",
  "exercise_id": "uuid",
  "status": "done" | "difficult" | "skipped",
  "notes": "легко пошло"
}
```

**Логика:**
1. INSERT в `workout_feedback`.
2. Если `status == 'difficult'` — проверить `exercise.side_effects` и
   создать `side_effect_events` если совпадает триггер.
3. Обновить `user_workouts.status` если все упражнения обработаны.
4. Ответ: `{ success: true }`.

### 3.5. POST `/api/nutrition/generate`

**Body:**
```json
{ "week_start_date": "2026-09-15" }
```

**Логика:**
1. Получить `user_profiles_general.calculated_target_calories`.
2. На каждый день недели подобрать 4 приёма пищи (breakfast/lunch/snack/dinner)
   так, чтобы сумма ккал была в пределах `target ± 5%`.
3. Не повторять одно и то же блюдо чаще 2 раз в неделю.
4. Учитывать противопоказания (например, если `contraindications` содержит
   диабет — исключить сладкие фрукты).
5. INSERT в `user_meals` × 28 записей (7 дней × 4 приёма).
6. Агрегировать все ингредиенты в `shopping_list`.
7. Ответ: `{ success: true, data: { week_start_date, days_generated: 7 } }`.

### 3.6. POST `/api/telegram/webhook`

Обработка команд бота (`/start`, `/today`, `/menu`, `/progress`, `/help`).

Каждая команда:
1. Проверить, есть ли `user` с таким `telegram_id`.
2. Если нет — ответить "Сначала зарегистрируйся на сайте [ссылка]".
3. Иначе — выполнить действие и отправить `sendMessage`.

### 3.7. POST `/api/cron/morning-reminder`

**Заголовок:** `Authorization: Bearer ${CRON_SECRET}` (проверять!).

**Логика:**
1. Выбрать всех `users` с `reminders_enabled = true` и
   `morning_reminder_time` в пределах последних 15 минут (гранулярность cron-job.org).
2. Для каждого — отправить в Telegram сообщение:
   "🌅 Доброе утро! Сегодня твоя тренировка ждёт. Открой [ссылка на веб]."
3. Логировать в `notifications_log`.

### 3.8. Zod-схемы (источники истины)

**Файл:** `src/lib/schemas/user.ts`

```typescript
import { z } from 'zod';

export const userSchema = z.object({
  telegram_id: z.number().int().optional(),
  email: z.string().email().optional(),
  name: z.string().min(2).max(100),
  gender: z.enum(['male', 'female']).optional(),
  mode: z.enum(['behtereva', 'general']),
  theme: z.enum(['sage', 'terracotta', 'ocean']).default('sage'),
});

export type UserData = z.infer<typeof userSchema>;
```

Аналогично для остальных схем.

### 3.9. Env-переменные

**Файл:** `.env.example`

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telegram Bot
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=gimn_zdorovia_bot
TELEGRAM_WEBHOOK_SECRET=

# Приложение
NEXT_PUBLIC_APP_URL=https://gimn-zdorovia.vercel.app

# Cron защита
CRON_SECRET=
```

**Уже настроено в Vercel** (12 записей: 4 переменные × 3 окружения).
Романы значения лежат в `F:\Project gimn zdorovia\secrets\.env` — не в git.

---

## БЛОК 4. UI/UX

### 4.1. Layout и метаданные

**Файл:** `src/app/layout.tsx`

- `<html lang="ru" data-theme="sage">` (тема из БД или дефолт).
- Шрифт: Inter (subsets: `['latin', 'cyrillic']`).
- Toaster (sonner, top-center, richColors).
- PWA manifest: `public/manifest.json` с иконками 192/512.

**Метаданные:**
```typescript
export const metadata: Metadata = {
  title: 'Гимн.здоровья — Реабилитация Бехтерева и общая форма',
  description: 'Персональная программа реабилитации при болезни Бехтерева и управления весом. Ежедневная гимнастика, меню питания, адаптация под ваш прогресс.',
  openGraph: {
    title: 'Гимн.здоровья',
    description: 'Реабилитация и здоровье — каждый день по 30 минут.',
    type: 'website',
    locale: 'ru_RU',
  },
  manifest: '/manifest.json',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#2D3E33' },
  ],
};
```

### 4.2. Три темы оформления (CSS Variables)

**Файл:** `src/app/globals.css`

```css
@import "tailwindcss";

/* Общие переменные (типография) */
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 0.75rem;
}

/* B1 — Sage (по умолчанию) */
:root, [data-theme="sage"] {
  --primary: 124 26% 54%;         /* #7C9885 */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 124 26% 45%;
  --background: 60 20% 98%;       /* #FAFAF7 */
  --foreground: 130 15% 20%;      /* #2D3E33 */
  --card: 0 0% 100%;
  --card-foreground: 130 15% 20%;
  --muted: 130 8% 92%;
  --muted-foreground: 130 8% 45%;
  --accent: 40 30% 55%;           /* #C89858 warm */
  --destructive: 5 40% 52%;       /* #B85450 */
  --success: 130 20% 45%;
  --border: 130 8% 88%;
  --input: 130 8% 88%;
  --ring: 124 26% 54%;
}

/* B2 — Terracotta */
[data-theme="terracotta"] {
  --primary: 18 47% 57%;          /* #C97B5C */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 18 47% 48%;
  --background: 30 40% 97%;       /* #FDF9F5 */
  --foreground: 18 20% 20%;       /* #3A2D28 */
  --card: 0 0% 100%;
  --card-foreground: 18 20% 20%;
  --muted: 18 15% 92%;
  --muted-foreground: 18 15% 45%;
  --accent: 124 26% 54%;          /* Sage — комплементарный */
  --destructive: 10 55% 43%;      /* #A64434 */
  --success: 124 26% 54%;
  --border: 18 15% 88%;
  --input: 18 15% 88%;
  --ring: 18 47% 57%;
}

/* B3 — Ocean */
[data-theme="ocean"] {
  --primary: 193 36% 46%;         /* #4A8E9E */
  --primary-foreground: 0 0% 100%;
  --primary-hover: 193 36% 38%;
  --background: 200 33% 97%;      /* #F7FAFB */
  --foreground: 200 40% 20%;      /* #1F3A44 */
  --card: 0 0% 100%;
  --card-foreground: 200 40% 20%;
  --muted: 200 15% 92%;
  --muted-foreground: 200 10% 45%;
  --accent: 40 60% 58%;           /* #D9974A янтарный */
  --destructive: 0 45% 55%;       /* #C05555 */
  --success: 155 35% 47%;
  --border: 200 15% 88%;
  --input: 200 15% 88%;
  --ring: 193 36% 46%;
}

/* Плавный переход при смене темы */
* {
  transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
}
```

### 4.3. Универсальная карточка упражнения (Nike-style)

**Файл:** `src/components/exercise/exercise-card.tsx`

Единая карточка для ВСЕХ упражнений (наклон, вращение, растяжка — одна форма).

```tsx
type ExerciseCardProps = {
  exercise: Exercise;
  onFeedback: (status: 'done' | 'difficult' | 'skipped') => void;
};

// Структура:
// ┌─────────────────────────────┐
// │  [GIF в верхней трети]       │
// ├─────────────────────────────┤
// │  Название упражнения (H2)   │
// │  Мета: тип · длительность   │
// │                             │
// │  Описание техники (2-3 строки) │
// │                             │
// │  [✅ Сделал]  (primary, 56px)  │
// │  [⚠️ Плохо]  (accent, 56px)   │
// │  [❌ Пропуск] (outline, 56px) │
// └─────────────────────────────┘
```

**Правила:**
- Кнопки всегда в одном порядке (✅ → ⚠️ → ❌).
- Цвет primary — из текущей темы.
- Высота кнопок ≥ 56px (touch-target для людей с ограниченной подвижностью).
- GIF занимает 40% высоты карточки на мобильном, 50% на десктопе.
- Если GIF не грузится — Skeleton, потом placeholder-картинка.

### 4.4. Экраны (краткое описание)

Полные UI-макеты кот-код разработает по этому spec. Ниже — ключевые
пункты для каждого экрана.

**Лендинг `/`:**
- Hero: "Гимн.здоровья — Реабилитация Бехтерева и здоровый вес в одном приложении"
- 3 карточки: "Для Бехтерева" / "Для похудения/массы" / "Автономная адаптация"
- Скриншоты приложения (mock-up)
- Кнопка "Начать бесплатно" → `/auth/register`
- Секция "Как это работает" (4 шага)
- Секция "Отзывы" (заглушки на MVP)
- Footer с ссылкой на Telegram

**Онбординг:**
- Прогресс-бар вверху (1/5, 2/5 ...)
- Один экран = один вопрос
- Кнопка "Не знаю / Пропустить" на каждом
- В конце — превью первой тренировки

**Главный экран `/app`:**
- Приветствие ("Привет, Роман!")
- Карточка "Сегодня" с кнопкой "Начать тренировку"
- Карточка "Меню на сегодня" (свернутая, разворачивается)
- Прогресс-полоска "Занятий эту неделю: 3/5"
- Bottom-nav: Главная / Меню / Прогресс / Настройки

**Экран тренировки `/app/workout/[id]`:**
- Прогресс "Упражнение 3 из 12"
- Универсальная карточка (см. 4.3)
- Кнопка "Пауза" сверху
- Свайп влево/вправо для переключения (или стрелки)

**Настройки `/app/settings`:**
- Раздел "Профиль" (имя, режим, повторная диагностика)
- Раздел "Оформление" (3 плитки тем + галочка авто-смены)
- Раздел "Напоминания" (утро/вечер, вкл/выкл)
- Раздел "Уведомления" (Telegram / Push)
- Кнопка "Выход"

### 4.5. Адаптивность и доступность

- Mobile-first (min-width 320px).
- Все touch-targets ≥ 44×44px, критичные (кнопки в тренировке) ≥ 56×56px.
- Шрифт основного текста ≥ 16px (iOS Safari zoom prevention).
- Контраст ≥ 4.5:1 для всех трёх тем (проверено WCAG AA).
- Семантика: `<main>`, `<section>`, `<h1>`/`<h2>`, `<button>` (не div с onClick).
- `<html lang="ru">`, `alt` на всех картинках, `aria-label` на кнопках-иконках.
- Keyboard navigation: Tab через все интерактивные элементы, Escape закрывает модалки.

---

## БЛОК 5. Business Logic

### 5.1. Формула расчёта калорий (Миффлин-Сан-Жеор)

**Файл:** `src/lib/nutrition-engine/calorie-calculator.ts`

```typescript
export function calculateBMR(
  gender: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  ageYears: number
): number {
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161;
}

const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  medium: 1.55,
  high: 1.725,
  very_high: 1.9,
};

export function calculateTDEE(bmr: number, activity: keyof typeof ACTIVITY_MULTIPLIERS): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

export function calculateTargetCalories(tdee: number, goal: 'lose' | 'gain' | 'maintain'): number {
  if (goal === 'lose') return Math.round(tdee * 0.8);   // дефицит 20%
  if (goal === 'gain') return Math.round(tdee * 1.15);  // профицит 15%
  return tdee;
}
```

### 5.2. Decision Tree — правила реакции на побочки

**Файл:** `src/lib/workout-engine/side-effect-rules.ts`

Хранятся в БД (`side_effect_rules`), примеры:

| Симптом | Условия | Совет пользователю | Следующая тренировка |
|---------|---------|---------------------|----------------------|
| `pressure_up` | Любое упражнение | Сядь, отдохни 5 мин, измерь давление, пей воду | `reduce_intensity_20` |
| `headache` | Тип: main/warmup | Проверь осанку, отдохни 3 мин, самомассаж GB20 | `reduce_intensity_20` |
| `cramp` | Тип: main | Растяни мышцу 30 сек, пей электролиты | `lighter_only` |
| `joint_pain` | target_joint: shoulder | Исключи это упражнение из тренировки | `skip_joint` для этого сустава |
| `nausea` | Любое | СТОП, отдохни 15 мин, если не проходит — врач | `lighter_only` |

Правило "3 раза за неделю → баннер про врача":
- В `user_progress` считаем `side_effect_events` за 7 дней.
- Если ≥ 3 — показываем баннер: "Рекомендуем консультацию врача-ревматолога".

### 5.3. Список доступных продуктов (топ-30) и генерация меню

**Продукты для БД `meals`:**

Белки: куриная грудка, куриное филе бедра, куриные яйца, творог 5%, творог 0%, хек, треска, минтай, говядина постная, индейка.

Углеводы: гречка, рис (белый/бурый), овсянка, картофель, макароны цельнозерновые, чечевица, фасоль.

Овощи: помидоры, огурцы, капуста белокочанная, капуста цветная, морковь, кабачки, шпинат, брокколи, лук репчатый, чеснок.

Фрукты: яблоки, груши, апельсины, бананы, ягоды сезонные (клубника, черника).

Молочное: молоко 1.5%, кефир 1%, йогурт натуральный без сахара.

Жиры: подсолнечное масло, оливковое масло, орехи (грецкий, миндаль).

**Правила подбора меню:**
- Завтрак: 25-30% от суточной нормы
- Обед: 35-40%
- Полдник: 10-15%
- Ужин: 20-25%
- Каждый приём: белок + углевод (или белок + овощи для ужина)
- Не повторять одно блюдо чаще 2 раз в неделю
- Учитывать противопоказания из профиля

### 5.4. Циклы тренировок

**Файл:** `src/lib/workout-engine/weekly-cycle.ts`

**Для Бехтерева:**

| День | Фокус | Интенсивность | Длительность |
|------|-------|---------------|--------------|
| Пн | Позвоночник (общий) | по диагностике | 40-50 мин |
| Вт | Плечи и руки | по диагностике | 35-45 мин |
| Ср | Позвоночник (грудной отдел) | по диагностике | 35-45 мин |
| Чт | Ноги и таз | по диагностике | 35-45 мин |
| Пт | Позвоночник (поясница) | по диагностике | 35-45 мин |
| Сб | Комбинированный (лёгкий) | всегда `low` | 30-40 мин |
| Вс | Отдых / дыхание | всегда `low` | 10-15 мин |

**Структура каждой тренировки Бехтерева:**
1. Дыхание (3-5 мин)
2. Разминка + самомассаж (5-10 мин)
3. Основные упражнения (15-25 мин)
4. Растяжка + расслабление (5-10 мин)

**Для общей формы (по группам мышц):**

| День | Фокус | Пример упражнений |
|------|-------|-------------------|
| Пн | Ноги | Приседания, выпады, подъёмы на носки |
| Вт | Спина | Тяга, гиперэкстензия, планка |
| Ср | Грудь + трицепс | Отжимания, разведения |
| Чт | Кардио + пресс | Скакалка, планка, скручивания |
| Пт | Плечи + бицепс | Подъёмы, разведения |
| Сб | Всё тело (комплекс) | Функциональный тренинг |
| Вс | Отдых / растяжка | Йога, расслабление |

Пользователь в анкете указывает, какие дни удобны — в остальные не тренируется.

### 5.5. Ежемесячная адаптация программы

**Файл:** `src/lib/workout-engine/adaptation.ts`

1-го числа каждого месяца cron-job.org дёргает `/api/cron/monthly-report`:

Для каждого пользователя:
1. Сравнить `user_progress` этого месяца и прошлого:
   - Гибкость: `shober_test_cm` вырос? На сколько %?
   - Вес: `weight_kg` изменился в нужную сторону?
   - Скованность: `stiffness_level` снизилась?
   - Регулярность: сколько тренировок в неделю в среднем?
2. Применить правила:
   - **Прогресс есть + регулярность ≥ 4/нед** → усложнить: добавить 2 упражнения `intermediate` уровня.
   - **Прогресс есть + регулярность 2-3/нед** → оставить как есть.
   - **Прогресса нет + регулярность ≥ 4/нед** → сменить фокус (например, вместо только позвоночника — добавить плечи).
   - **Регулярность < 2/нед** → упростить, добавить мотивационные напоминания.
3. Сохранить результат в `monthly_reports.recommendation`.
4. Отправить в Telegram: "🎯 Твой месячный отчёт: [краткая сводка]. Программа обновлена."

### 5.6. Безопасность

| Угроза | Защита |
|--------|--------|
| XSS | React эскейпит автоматически. Нигде `dangerouslySetInnerHTML`. Контент рецептов и упражнений — только из БД, введены админом. |
| SQL Injection | Supabase JS SDK prepared statements. |
| Утечка `service_role` | `import 'server-only'` в admin.ts. Никогда в `NEXT_PUBLIC_*`. |
| Утечка `TELEGRAM_BOT_TOKEN` | Только в server-only модулях. |
| Спам форм | Rate limit 1 запрос/60 сек на user_id. |
| Telegram-инъекция через `parse_mode` | НЕ используем `parse_mode: 'HTML'`. Plain text. |
| Cron endpoints | Проверка `Authorization: Bearer ${CRON_SECRET}`. |
| RLS | Включена на ВСЕХ таблицах. Пользователь видит только свои данные. |
| Медицинские рекомендации | Явные правила из БД, никакого LLM в рантайме. Дисклеймер на лендинге и в настройках: "Приложение не заменяет консультацию врача". |

### 5.7. Медицинский дисклеймер (обязательно)

На лендинге, в онбординге и в настройках отображать:

> ⚠️ Гимн.здоровья — вспомогательный инструмент, а не медицинский сервис.
> Все рекомендации основаны на общедоступных источниках (ASAS/EULAR).
> Перед началом занятий проконсультируйтесь с врачом-ревматологом.
> При острой боли, повышении давления или ухудшении самочувствия —
> прекратите занятия и обратитесь к специалисту.

### 5.8. Настройка cron-job.org (одноразово)

Роман настраивает 3 крон-задачи на cron-job.org:

| Название | Расписание | URL | Заголовок |
|----------|------------|-----|-----------|
| Morning reminder | каждые 15 мин с 06:00 до 12:00 | https://gimn-zdorovia.vercel.app/api/cron/morning-reminder | Authorization: Bearer ${CRON_SECRET} |
| Evening reminder | каждые 15 мин с 16:00 до 22:00 | https://gimn-zdorovia.vercel.app/api/cron/evening-reminder | Authorization: Bearer ${CRON_SECRET} |
| Monthly report | 1-го числа в 09:00 | https://gimn-zdorovia.vercel.app/api/cron/monthly-report | Authorization: Bearer ${CRON_SECRET} |

Кот сгенерирует инструкцию для Романа после развёртывания приложения.

### 5.9. Настройка Telegram Webhook (одноразово)

После деплоя кот-код (или Роман через curl) настроит webhook:

```bash
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gimn-zdorovia.vercel.app/api/telegram/webhook",
    "secret_token": "'"${TELEGRAM_WEBHOOK_SECRET}"'"
  }'
```

---

## БЛОК 6. Edge Cases

| # | Ситуация | Ожидаемое поведение |
|---|----------|---------------------|
| 1 | Пользователь не заполнил диагностику полностью | Система использует значения по умолчанию: intensity=medium, focus=[spine], пользователь может дозаполнить позже |
| 2 | GIF упражнения не загрузился | Показать placeholder-картинку + текстовое описание; если и её нет — только текст с пометкой "Демонстрация недоступна" |
| 3 | Пользователь пропустил 5 дней подряд | В Telegram приходит мягкое сообщение: "Скучаем! Даже 10-минутная разминка вернёт форму" (не давить) |
| 4 | Побочка (боль/давление) 3+ раза за неделю | Баннер "Рекомендуем консультацию врача" + временное снижение интенсивности до `low` |
| 5 | Пользователь весит меньше 30 кг или больше 300 | Zod валидация отклонит, покажет: "Проверьте вес — значение вне разумного диапазона" |
| 6 | Telegram API недоступен во время cron | Пропустить, логировать в `notifications_log.status='failed'`, повторить в следующий cron-запуск |
| 7 | Пользователь меняет режим (Бехтерева → Общая форма) | Требует повторного онбординга, но история сохраняется в старом режиме |
| 8 | Одно упражнение блокирует всю тренировку (пользователь не может выполнить) | Кнопка "❌ Пропустить" всегда доступна, тренировка продолжается |
| 9 | Ночная тренировка (23:00+) | Разрешена, никаких блокировок, но система советует: "Оптимальное время 11-14 и 17-20" |
| 10 | Пользователь меняет часовой пояс | Все `TIME` поля хранятся в UTC, отображаются в локальном часовом поясе устройства |
| 11 | Пользователь без Telegram | Может использовать веб-приложение, регистрация через email/пароль, уведомления только Web Push |
| 12 | Cron задержался на 5 минут | Проверка окна ±15 минут — сообщение всё равно отправится, но не 2 раза |
| 13 | Дубликат Telegram-регистрации (тот же telegram_id) | UPSERT — обновление существующего пользователя, не создание дубля |
| 14 | Пользователь удалил аккаунт в Telegram | Веб-версия продолжает работать, при попытке отправить в TG — пропуск с логом |
| 15 | Ошибка при генерации меню (нет подходящих блюд для калоража) | Показать "Меню на неделю в разработке, посмотри пока рекомендации" |
| 16 | Медленный интернет (3G) | Skeleton для карточек, lazy-load GIF, PWA-кеш для оффлайн-просмотра |
| 17 | Пользователь в оффлайне | PWA показывает последнюю сгенерированную тренировку из кеша, отметки сохраняются локально и синхронизируются при появлении сети |
| 18 | Двойной клик на "Начать тренировку" | Кнопка disabled после первого клика, POST идёт один раз |
| 19 | Пользователь на iOS Safari без разрешения на уведомления | Web Push не работает, но Telegram-уведомления идут |
| 20 | Экран 320px (старый смартфон) | Все элементы адаптивны, горизонтального скролла нет |
| 21 | Пользователь ввёл возраст 12 лет | Zod отклонит (min 14). Показать: "Приложение для лиц старше 14 лет" |
| 22 | Изменение темы во время тренировки | Смена происходит мгновенно, без прерывания тренировки |

---

## Приложение A. Команды разработчика

```bash
# Bootstrap (кот-код выполнит первым тикетом)
cd "F:\Project gimn zdorovia"
pnpm create next-app@latest . \
  --typescript --eslint --tailwind --src-dir --app --import-alias "@/*" --use-pnpm

npx shadcn@latest init
npx shadcn@latest add button card dialog input textarea select form label \
  badge scroll-area sonner skeleton tabs progress avatar sheet dropdown-menu \
  radio-group switch slider

pnpm add zod react-hook-form @hookform/resolvers @supabase/supabase-js \
  @supabase/ssr lucide-react server-only next-pwa date-fns

# Разработка
pnpm dev
pnpm build
pnpm start

# Проверки
npx tsc --noEmit
pnpm lint
```

## Приложение B. План реализации (для кот-кода, 7 этапов)

Каждый этап — отдельный батч. После каждого — тесты и CHANGELOG.

### Этап 1. Bootstrap (2-3 часа кота)
- `create-next-app`, shadcn init, зависимости
- `.env.example`, `.gitignore`, `.vercelignore`
- Настроить Tailwind v4, 3 темы в globals.css
- Первый deploy: пустой лендинг с "Coming soon"

### Этап 2. БД + Auth (3-4 часа)
- Все 7 миграций (пункт 2.2)
- Seed данными: 50 упражнений, 40 блюд, правила, шаблоны
- Supabase Auth: Telegram + Email
- `/auth/login`, `/auth/register`

### Этап 3. Онбординг (3-4 часа)
- `/onboarding/mode`, `/onboarding/behtereva`, `/onboarding/general`, `/onboarding/theme`
- POST `/api/onboarding/diagnostics`
- Расчёт калорий (BMR/TDEE/target)

### Этап 4. Основное приложение (4-5 часов)
- `/app` — главный экран с bottom-nav
- `/app/workout/[id]` — тренировка с универсальной карточкой
- POST `/api/workout/generate`, POST `/api/workout/feedback`
- Decision Tree для побочек

### Этап 5. Питание (3-4 часа)
- `/app/nutrition` (Сегодня / Неделя / Покупки)
- POST `/api/nutrition/generate`
- Агрегация списка покупок

### Этап 6. Прогресс + Настройки (2-3 часа)
- `/app/progress` — графики (recharts)
- `/app/settings` — темы, напоминания, профиль
- POST `/api/progress/monthly`

### Этап 7. Telegram + Крон + PWA (3-4 часа)
- POST `/api/telegram/webhook` — команды бота
- 3 крон-эндпоинта
- Настройка webhook + инструкция для cron-job.org
- PWA manifest, service worker, оффлайн-режим
- Финальные тесты, деплой

**Итого: ~25-30 часов кота-кода**, около **7-10 рабочих дней** с учётом
итераций и правок.

## Приложение C. Шаблон CHANGELOG (для каждого батча)

```
=== CHANGELOG ===

Этап X: <название>
- Файлы созданы: список
- Файлы изменены: список + что именно
- Миграции применены: список
- API endpoints добавлены: список
- Компоненты созданы: список
- Env vars добавлены: если были новые
- Мины/риски: что учтено, что оставлено

Тесты:
- npx tsc --noEmit: ✅ / ❌
- pnpm lint: ✅ / ❌
- pnpm build: ✅ / ❌
- Что руками проверил в браузере: список
- Что осталось проверить Роману: список

Готовность к следующему этапу: ДА / НЕТ
```

---

*Этот документ — единственный источник истины. Любые расхождения между
спецификацией и реализацией решаются в пользу спецификации. Изменения
вносятся только обновлением этого SPEC.md и инкрементом версии.*
