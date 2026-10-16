# 🎯 ЗАКОН-БАТЧ: GIMN-028 — Зал MVP + Автопрогрессия

## 📌 Скоуп

**Второй из трёх батчей** серии. Первый (GIMN-027) закрыт: главная/аккордеон/тарифы/баллы/условия на проде, миграция 0020 применена.

**Здесь:**
- Расширение общего режима на зал (домашний + тренажёрный)
- Оборудование (equipment), дозировка (подходы/повторы/вес), факт тренировки
- Автопрогрессия: уровень растёт по данным с оповещением
- Кнопка "Плохо" → добавить пункт "Свой вариант"
- **Мелкий блок:** переписать legal-документы обезличенно (Роман попросил убрать личные данные)

**Дальше** (GIMN-029): мобильная версия всего нового + PDF документов + мобильный вход (SMS/Email/соцсети).

**Метод:** закон-батч (ШАГ 0 разведка → фикс → tsc/build/lint → отчёт → проверка на проде)
**Обязательный чеклист:** РАБОЧИЙ_ЧЕКЛИСТ_котокод_v2.md
**Платформа:** desktop сначала, мобиль в GIMN-029
**Автодеплой Actions** не трогать

---

## 🧭 ШАГ 0 — РАЗВЕДКА (обязательно до кода)

Отчитайся блоком "ФАКТЫ ПО ШАГ 0":

```bash
# 1. Enum equipment — где определён, какие значения
grep -rn "equipment.*enum\|CHECK.*equipment\|'pullup_bar'\|'dip_bars'" \
  src/ supabase/migrations/

# 2. Дозировка — где считается длина занятия и структура
grep -rn "duration_sec\|repetitions\|rest_sec\|exerciseCount\|TIME_SPLIT" src/lib/workout-engine/

# 3. Кнопка "Плохо" — файл, варианты
grep -rn "difficult\|Плохо\|BadFeedback\|feedback.*reason" src/components/

# 4. Замеры тела — есть ли уже
grep -rn "weight_kg\|height_cm\|measurement" src/ supabase/migrations/

# 5. Уровень пользователя — есть ли training_level или подобное
grep -rn "training_level\|beginner\|intermediate\|advanced" src/lib/

# 6. Анкета общего режима — файл, вопросы
grep -rn "user_profiles_general\|has_turnik\|onboarding" src/components/
find src -name "*profile*general*" -o -name "*Onboarding*general*"
```

Затем — код.

---

## 💣 ОБХОД МИН

Мины из MINES.md + новые:

- **"сделано" ≠ "на проде"** — после каждого коммита `git log origin/main` + `curl` по проду перед отчётом (мина №1)
- **Логика Бехтерева** — новые equipment (`barbell`, `dumbbell` и т.д.) НЕ должны попадать в режим Бехтерева. Проверка: `npm run check:turnik` расширить до всех новых equipment
- **workout_feedback** — существующие 2 юзера (Роман+Сергей) уже писали туда. Расширение колонками через `ADD COLUMN IF NOT EXISTS` — не сломать существующие записи
- **Автопрогрессия** — НЕ автопереключение. Только оповещение с выбором [Согласиться]/[Остаться]. Иначе стресс пользователю
- **Уровень пользователя** — не понижать автоматом, только повышать
- **Кнопка "Плохо" → "Свой вариант"** — текст пользователя может быть матерным/бесполезным. Сохраняем как есть, показываем админу, но публично не отображаем

---

## 🚫 ГРАНИЦЫ "НЕ ТРОГАТЬ"

- ❌ Режим Бехтерева (не трогать логику, только фильтр equipment)
- ❌ Существующие миграции 0001-0020
- ❌ Крон, автодеплой Actions
- ❌ ЮKassa/платёжки
- ❌ Вход через бот (`/api/auth/telegram`)
- ❌ Логику отправки feedback в Telegram
- ❌ Мобильную вёрстку (`MobileLeadCard`) — GIMN-029
- ❌ Изображения упражнений (`image_url`) — GIMN-025 отдельно
- ❌ Существующие 76 упражнений — только ДОБАВЛЯТЬ новые для зала
- ❌ SERVICE_ROLE_KEY в логах/отчётах/коммитах

---

## 📋 БЛОКИ РАБОТЫ

### **БЛОК A: Расширение equipment**

#### A1. Миграция 0021 — новые типы оборудования

Файл: `supabase/migrations/0021_gym_equipment.sql`

```sql
-- GIMN-028: расширение equipment на зал

-- 1. Расширяем CHECK на exercises.equipment
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN (
    'none',
    'pullup_bar',
    'dip_bars',
    'dumbbell',
    'barbell',
    'bench',
    'kettlebell',
    'resistance_band',
    'cable',
    'machine',
    'squat_rack'
  ));

-- 2. Добавляем в user_profiles_general поля тренировочной локации
ALTER TABLE user_profiles_general
  ADD COLUMN IF NOT EXISTS training_location TEXT DEFAULT 'home'
    CHECK (training_location IN ('home', 'home_bar', 'gym', 'home_and_gym')),
  ADD COLUMN IF NOT EXISTS gym_equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS training_level TEXT DEFAULT 'beginner'
    CHECK (training_level IN ('beginner', 'intermediate', 'advanced'));

COMMENT ON COLUMN user_profiles_general.training_location IS 
  'Где тренируется: home | home_bar | gym | home_and_gym';
COMMENT ON COLUMN user_profiles_general.gym_equipment IS 
  'Массив доступного снаряжения (equipment enum). Пусто если нет';
COMMENT ON COLUMN user_profiles_general.training_level IS 
  'Уровень: beginner (стартовый) | intermediate | advanced. Растёт только по согласию';

NOTIFY pgrst, 'reload schema';
```

**Применить сам через SERVICE_ROLE_KEY. В отчёте: "миграция 0021 применена".**

#### A2. Расширить логику equipment.ts

Файл: `src/lib/workout-engine/equipment.ts`

Расширить функцию `equipmentAllowedInMode(mode)`:
- `mode === 'behtereva'` → только `['none']` (никаких снарядов)
- `mode === 'general'` → все типы, но фильтр по `gym_equipment` пользователя

Расширить `equipmentAvailable(userProfile, mode)`:
- Читает `training_location` + `gym_equipment` из профиля
- Возвращает список доступных типов оборудования для этого юзера

#### A3. Расширить check:turnik на все equipment

Файл: `scripts/check-turnik.mts` → `scripts/check-equipment.mts`

23 проверки → +12 новых:
- Бехтерева × {home, home_bar, gym, home_and_gym} × {каталог, день, конструктор} = 12 проверок
- Каждая: ни одного упражнения с equipment !== 'none' не попадает

```bash
npm run check:equipment
```

---

### **БЛОК B: Анкета — вопрос о месте тренировок**

Файл (по ШАГ 0.6): анкета общего режима

**Новый вопрос перед "Есть ли турник?":**

```tsx
<QuestionRadio
  question="Где вы обычно тренируетесь?"
  options={[
    { value: 'home', label: 'Дома (свой вес, простой инвентарь)' },
    { value: 'home_bar', label: 'Дома + турник/брусья' },
    { value: 'gym', label: 'Тренажёрный зал' },
    { value: 'home_and_gym', label: 'Дом и зал (по обстоятельствам)' },
  ]}
  value={trainingLocation}
  onChange={setTrainingLocation}
/>
```

**Если выбрано `home_bar`, `gym` или `home_and_gym` → дополнительный чек-лист:**

```tsx
<QuestionCheckList
  question="Отметьте, что у вас есть в доступе:"
  options={[
    { value: 'pullup_bar', label: 'Турник', showIf: ['home_bar', 'gym', 'home_and_gym'] },
    { value: 'dip_bars', label: 'Брусья', showIf: ['home_bar', 'gym', 'home_and_gym'] },
    { value: 'dumbbell', label: 'Гантели (разборные или наборные)', showIf: 'always' },
    { value: 'barbell', label: 'Штанга с блинами', showIf: ['gym', 'home_and_gym'] },
    { value: 'bench', label: 'Скамья', showIf: ['gym', 'home_and_gym'] },
    { value: 'squat_rack', label: 'Стойка / силовая рама', showIf: ['gym', 'home_and_gym'] },
    { value: 'kettlebell', label: 'Гиря', showIf: 'always' },
    { value: 'resistance_band', label: 'Резинки / петли', showIf: 'always' },
    { value: 'cable', label: 'Кабельный тренажёр (блок)', showIf: ['gym'] },
    { value: 'machine', label: 'Тренажёры на мышечные группы', showIf: ['gym'] },
  ]}
  values={gymEquipment}
  onChange={setGymEquipment}
/>
```

**Сохранение:** `training_location` + `gym_equipment` в user_profiles_general.

**Совместимость:** старые пользователи, у которых заполнено `has_turnik` — при следующем открытии анкеты им показать новый вопрос, дефолт по `has_turnik`:
- `has_turnik = 'yes'` → предложить `home_bar` + отметить `pullup_bar`
- `has_turnik = 'no'` → `home`
- `has_turnik = 'maybe'` → `home` (с подсказкой "укажите если появится")

---

### **БЛОК C: Дозировка (подходы/повторы/вес)**

#### C1. Миграция 0022 — таблицы дозировки и факта

Файл: `supabase/migrations/0022_dosage_and_workout_sets.sql`

```sql
-- GIMN-028: дозировка упражнений (силовые схемы) + факт тренировки

-- 1. Дозировка (recipe: что делать)
CREATE TABLE IF NOT EXISTS exercise_dosage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  level TEXT NOT NULL CHECK (level IN ('beginner', 'intermediate', 'advanced')),
  mode TEXT NOT NULL CHECK (mode IN ('behtereva', 'general')),
  
  -- Гимнастика (дефолт для non-strength)
  duration_sec INTEGER,
  repetitions INTEGER,
  rest_sec INTEGER,
  
  -- Силовые (только для general + equipment != 'none')
  sets INTEGER,
  reps_per_set INTEGER,
  rest_between_sets_sec INTEGER,
  weight_pct_1rm REAL,
  weight_kg_default REAL,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(exercise_id, level, mode)
);

CREATE INDEX IF NOT EXISTS idx_dosage_exercise_level 
  ON exercise_dosage(exercise_id, level, mode);

-- 2. Факт тренировки (что реально сделал)
CREATE TABLE IF NOT EXISTS workout_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workout_id UUID,
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  set_number INTEGER NOT NULL,
  reps INTEGER NOT NULL,
  weight_kg REAL,
  rpe INTEGER CHECK (rpe BETWEEN 1 AND 10),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sets_user_date 
  ON workout_sets(user_id, date DESC, exercise_id);

CREATE INDEX IF NOT EXISTS idx_sets_user_exercise 
  ON workout_sets(user_id, exercise_id, date DESC);

-- 3. Расширение workout_feedback для custom_reason (кнопка "Плохо" → "Свой вариант")
ALTER TABLE workout_feedback
  ADD COLUMN IF NOT EXISTS custom_reason TEXT;

-- RLS
ALTER TABLE exercise_dosage ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dosage_read_all" ON exercise_dosage;
CREATE POLICY "dosage_read_all" ON exercise_dosage FOR SELECT USING (true);

DROP POLICY IF EXISTS "sets_read_own" ON workout_sets;
CREATE POLICY "sets_read_own" ON workout_sets 
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "sets_insert_own" ON workout_sets;
CREATE POLICY "sets_insert_own" ON workout_sets 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

NOTIFY pgrst, 'reload schema';
```

#### C2. Пересчёт времени тренировки для силовых

Файл: `src/lib/workout-engine/duration.ts`

Добавить функцию:

```typescript
export function estimateExerciseTime(exercise: Exercise, dosage: ExerciseDosage): number {
  // Гимнастика
  if (!dosage.sets || !dosage.reps_per_set) {
    return (dosage.repetitions ?? 10) * 4 + (dosage.rest_sec ?? 15);
  }
  // Силовые
  return dosage.sets * (
    dosage.reps_per_set * 3 +          // 3 сек/повтор
    dosage.rest_between_sets_sec       // отдых между подходами
  );
}
```

Обновить `exerciseCount` — для тренировки с силовыми не тянуть 10 упражнений на 45 мин, а брать 4-6.

---

### **БЛОК D: Упражнения для зала (MVP — 20 базовых)**

#### D1. Миграция 0023 — вставка упражнений и дозировок

Файл: `supabase/migrations/0023_gym_exercises_mvp.sql`

**20 базовых упражнений** для новичка в зале (по Starting Strength + StrongLifts):

| # | Slug | Название | Equipment | Мышцы |
|---|------|----------|-----------|-------|
| 1 | `gym-barbell-squat` | Приседания со штангой | barbell + squat_rack | Ноги |
| 2 | `gym-goblet-squat` | Кубковый присед | dumbbell | Ноги |
| 3 | `gym-barbell-deadlift` | Становая тяга | barbell | Спина+ноги |
| 4 | `gym-romanian-deadlift` | Румынская тяга | barbell | Задняя цепь |
| 5 | `gym-bench-press` | Жим лёжа | barbell + bench | Грудь |
| 6 | `gym-dumbbell-bench` | Жим гантелей лёжа | dumbbell + bench | Грудь |
| 7 | `gym-overhead-press` | Жим стоя | barbell | Плечи |
| 8 | `gym-dumbbell-shoulder-press` | Жим гантелей сидя | dumbbell + bench | Плечи |
| 9 | `gym-barbell-row` | Тяга штанги в наклоне | barbell | Спина |
| 10 | `gym-dumbbell-row` | Тяга гантели | dumbbell + bench | Спина |
| 11 | `gym-lat-pulldown` | Тяга верхнего блока | cable | Спина |
| 12 | `gym-cable-row` | Тяга нижнего блока | cable | Спина |
| 13 | `gym-leg-press` | Жим ногами | machine | Ноги |
| 14 | `gym-leg-curl` | Сгибание ног | machine | Задняя цепь |
| 15 | `gym-leg-extension` | Разгибание ног | machine | Квадрицепс |
| 16 | `gym-calf-raise` | Подъём на носки | machine | Икры |
| 17 | `gym-plank` | Планка | none | Кор |
| 18 | `gym-farmer-carry` | Прогулка фермера | dumbbell (или kettlebell) | Всё тело |
| 19 | `gym-kettlebell-swing` | Махи гирей | kettlebell | Задняя цепь |
| 20 | `gym-face-pull` | Тяга к лицу | cable | Плечи (задний пучок) |

Каждое упражнение — с дозировкой для 3 уровней:
- `beginner`: 3×8, отдых 90 сек, вес — пустая штанга или лёгкая гантель
- `intermediate`: 4×8, отдых 120 сек, ~60% 1RM
- `advanced`: 5×5, отдых 180 сек, ~75% 1RM

**Тексты техники** — писать по стандарту существующих упражнений (осанка, дыхание, безопасность, признаки перегрузки). Формат — как в существующих.

**Изображения:** пока `image_url = NULL` (заполним в GIMN-025 через wger).

#### D2. Генератор дня для зала

Файл: `src/lib/workout-engine/gym-generator.ts` (создать)

**Логика Fullbody Beginner:**
- 3 тренировки в неделю (пн/ср/пт или гибко)
- Каждая: 4-6 упражнений (1 приседание, 1 тяга, 1 жим, 1 наклон, 1 кор, опционально бицепс/трицепс)
- Ротация A/B: 
  - **A**: Приседания, Жим лёжа, Тяга штанги, Планка
  - **B**: Приседания, Жим стоя, Становая, Прогулка фермера

Учёт доступного `gym_equipment` — если нет штанги, подставить гантель.

---

### **БЛОК E: Замеры тела**

#### E1. Миграция 0024 — таблица замеров

Файл: `supabase/migrations/0024_body_measurements.sql`

```sql
CREATE TABLE IF NOT EXISTS body_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg REAL,
  chest_cm REAL,
  waist_cm REAL,
  hips_cm REAL,
  bicep_cm REAL,
  thigh_cm REAL,
  body_fat_pct REAL,
  resting_hr INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_measurements_user_date 
  ON body_measurements(user_id, date DESC);

ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "measurements_read_own" ON body_measurements;
CREATE POLICY "measurements_read_own" ON body_measurements 
  FOR SELECT USING (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "measurements_insert_own" ON body_measurements;
CREATE POLICY "measurements_insert_own" ON body_measurements 
  FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

NOTIFY pgrst, 'reload schema';
```

#### E2. UI ввода замеров

Файл: `src/components/measurements/MeasurementsForm.tsx`

Форма:
- Вес (обязательно)
- Обхваты (опционально)
- Пульс покоя утром (опционально)
- Заметка

Показывать в: **Прогресс** → новая секция "Замеры тела" → кнопка "Добавить замер".

Дефолт периодичности: раз в неделю (напоминание в воскресенье, если не мерил 7+ дней).

**Проверка на аномалии:**
- Если разница веса >5 кг с предыдущего замера — подсветить: "Проверьте — большое отклонение"
- Если body_fat_pct вне диапазона 5-50% — ошибка

---

### **БЛОК F: Автопрогрессия (уровень растёт по данным)**

#### F1. Условия повышения `beginner` → `intermediate`

Файл: `src/lib/progression/level-check.ts` (создать)

**Все три условия одновременно:**
1. Тренировок в зале сделано ≥ 20
2. Прогресс силы: рабочий вес в базовом упражнении (присед или жим) вырос ≥ 30% от старта
3. Стабильность: 12 недель без пропусков >7 дней подряд

```typescript
export async function checkLevelUpEligible(userId: string): Promise<{
  eligible: boolean;
  currentLevel: TrainingLevel;
  nextLevel: TrainingLevel | null;
  reason?: string;
  metrics?: LevelMetrics;
}> { /* реализовать */ }
```

#### F2. Прогрессия веса (в рамках одного уровня)

Файл: `src/lib/progression/weight.ts`

**Правила Starting Strength / StrongLifts:**
- Если 3 успешных подхода подряд на текущем весе → предложить +2.5 кг (для upper body) или +5 кг (для lower body)
- Если 2 неудачных подхода подряд → снизить на 10%
- Дилоад: раз в 4 недели снижение объёма на 40%

**Автоматически считать после каждой тренировки:**

```typescript
export function suggestNextWeight(
  history: WorkoutSet[], 
  exercise: Exercise
): { weight_kg: number; reason: string } { /* реализовать */ }
```

#### F3. Оповещение о повышении уровня (Q3 Романа: Telegram + модалка)

**Модалка в приложении:**

```tsx
<Modal open={showLevelUp}>
  <h2>🎉 Поздравляем, [Имя]!</h2>
  <p>
    За 20 тренировок ваш присед вырос с 20 до 32 кг (+60%).
    Вы освоили технику базовых движений — можно переходить на следующий уровень.
  </p>
  <h3>Что изменится на уровне «Средний»:</h3>
  <ul>
    <li>Сплиты (верх/низ или push/pull/legs) вместо fullbody</li>
    <li>Больше подходов (4-5 вместо 3)</li>
    <li>Разнообразие упражнений</li>
    <li>Начальная периодизация нагрузки</li>
  </ul>
  <div className="flex gap-3">
    <Button onClick={confirmLevelUp}>Согласиться</Button>
    <Button variant="outline" onClick={dismissLevelUp}>
      Остаться на новичке
    </Button>
  </div>
</Modal>
```

**Одновременно — уведомление в Telegram** (через существующий бот):

```
🎉 [Имя], вы достигли максимума уровня «Новичок»!
Ваш присед вырос на 60%.
Откройте приложение — предлагаем перейти на средний уровень.
[Открыть приложение]
```

**Логика:**
- Триггер: после успешной тренировки, если `checkLevelUpEligible === true` и уровень ещё не предлагался
- Флаг: `user_profiles_general.level_up_offered_at TIMESTAMPTZ` — чтобы не спамить (показывать раз в неделю максимум)
- Ответ пользователя: `training_level` меняется на `intermediate` или остаётся `beginner`

**Email/соцсети — задел на будущее:**
Файл `src/lib/notifications/channels.ts` — фабрика каналов:
- `telegram` (готов)
- `email` (плейсхолдер, включится когда добавят email в профиль)
- `sms` (плейсхолдер)
- `vk`, `apple`, `google` (плейсхолдеры соцсетей)

Один интерфейс `sendNotification(userId, channel, message)`. Реальные каналы — в GIMN-029.

---

### **БЛОК G: Кнопка "Плохо" → "Свой вариант"**

Файл (по ШАГ 0.3): компонент кнопки "Плохо"

**Было:**
```tsx
<button>Слишком тяжело</button>
<button>Больно</button>
<button>Не понимаю технику</button>
<button>Нет оборудования</button>
```

**Стало (+1):**
```tsx
<button>Слишком тяжело</button>
<button>Больно</button>
<button>Не понимаю технику</button>
<button>Нет оборудования</button>
<button>✏️ Свой вариант…</button>  {/* ← открывает textarea */}
```

**При клике "Свой вариант":**

```tsx
{selected === 'custom' && (
  <div className="mt-3">
    <textarea
      placeholder="Опишите, что не так — поможем разобраться"
      maxLength={500}
      value={customText}
      onChange={(e) => setCustomText(e.target.value)}
      className="w-full rounded border p-2"
      rows={4}
    />
    <Button onClick={submitCustom} disabled={!customText.trim()}>
      Отправить
    </Button>
  </div>
)}
```

**Сохранение:**
- В `workout_feedback.reason = 'custom'`
- В `workout_feedback.custom_reason = customText`
- Отправка в Telegram админу с меткой "Свой вариант":

```
📝 Свой вариант отзыва
От: [имя пользователя]
Упражнение: [название]
Комментарий: [текст]
```

**Не показывать пользователю чужие "custom_reason"** — только админу.

---

### **БЛОК H: Переписать legal-документы обезличенно (мелкий блок)**

Файл: `src/legal/user-agreement.tsx`, `privacy-policy.tsx`, `data-consent.tsx`

**Найти и заменить:**
- `[ФИО ВЛАДЕЛЬЦА]` → **"Владелец приложения «Гимн.здоровья»"** (без ФИО)
- Любые упоминания ИНН, адреса, юрлица — на **"[будет указано в актуальной редакции]"**
- Дату вступления в силу — оставить как `[ДАТА_ЗАПУСКА]`

**Формулировки-примеры:**

Было (гипотетически):
> Настоящее соглашение заключается между **[ФИО ВЛАДЕЛЬЦА]**, ИНН **[ИНН]**, и пользователем...

Стало:
> Настоящее соглашение заключается между **Владельцем приложения «Гимн.здоровья»** (далее — Владелец, реквизиты будут указаны в актуальной редакции документа) и пользователем...

**Общие блоки:**
- Реквизиты Владельца: "будут указаны в актуальной редакции"
- Контакты для связи: "через форму отзыва в приложении или бот @gimn_zdorovia_bot"
- Юрисдикция: РФ
- Применимое право: РФ

**Шапка над каждым документом (сохраняется):**
> ⚠️ Проект, не вступил в силу, не согласован с юристом. 
> Реквизиты Владельца будут указаны в актуальной редакции документа.

---

## ✅ САМОПРОВЕРКА

```bash
npx tsc --noEmit          # 0 ошибок
npm run lint              # 0 ошибок
npm run build             # exit 0
npm run check:equipment   # все проверки Бехтерева × equipment зелёные (был turnik, стал equipment — переименован)
npm run check:points      # 13/13 из GIMN-027
```

**Автомиграции применены?** Проверить через SQL:
```sql
SELECT count(*) FROM information_schema.tables 
  WHERE table_name IN ('exercise_dosage', 'workout_sets', 'body_measurements');
-- должно вернуть 3

SELECT count(*) FROM exercises WHERE slug LIKE 'gym-%';
-- должно вернуть 20
```

**Grep-проверки после деплоя:**
```bash
curl -s https://gimn-zdorovia.vercel.app/settings | grep -c "Замеры тела"     # ≥1 если в настройках, ≥0 если только в Прогресс
curl -s https://gimn-zdorovia.vercel.app/legal | grep -c "ФИО ВЛАДЕЛЬЦА"      # 0 (обезличили)
curl -s https://gimn-zdorovia.vercel.app/legal | grep -c "Владелец приложения" # ≥1
```

**Визуальные проверки для Романа (в отчёте):**
1. Открыть анкету общего режима → новый вопрос "Где вы обычно тренируетесь?"
2. Выбрать "Тренажёрный зал" → появляется чек-лист оборудования
3. Отметить штангу+скамью+гантели → сохранить
4. Открыть Сегодня → тренировка с силовыми (жим лёжа, приседания и т.д.)
5. Открыть карточку упражнения → показаны подходы×повторы + рекомендуемый вес
6. Провести тренировку → нажать "Плохо" → есть вариант "Свой вариант…"
7. Ввести текст → отправить → сообщение в Telegram админу
8. Прогресс → секция "Замеры тела" → добавить замер веса
9. Через 20 тренировок → модалка "Готовы перейти на средний уровень?" + push в Telegram
10. Условия и документы → нет упоминания ФИО, есть "Владелец приложения"
11. Режим Бехтерева × любой training_location → 0 упражнений с equipment != 'none'

---

## 📌 ОБНОВИТЬ

- **PATHS_AND_BRANCHES.md** — добавить новые пути:
  - `/api/workouts/sets`, `/api/measurements`, `/api/progression/check-level-up`
  - `src/lib/workout-engine/gym-generator.ts`
  - `src/lib/progression/{level-check,weight}.ts`
  - `src/lib/notifications/channels.ts`
  - `src/components/measurements/MeasurementsForm.tsx`
  - `supabase/migrations/0021_gym_equipment.sql`
  - `supabase/migrations/0022_dosage_and_workout_sets.sql`
  - `supabase/migrations/0023_gym_exercises_mvp.sql`
  - `supabase/migrations/0024_body_measurements.sql`
  - `scripts/check-equipment.mts`

- **MINES.md** — добавить мины:
  - "Автопрогрессия — только оповещение, никогда автопереключение. Стресс = потеря доверия."
  - "Уровень пользователя понижать нельзя автоматом. Только по явному запросу пользователя."
  - "custom_reason в feedback может быть матерным/бесполезным. Не публиковать другим пользователям, только админу."
  - "Бехтерева никогда не должна получить equipment != 'none'. Проверка check:equipment обязательна перед каждым deploy."

- **README.md** — обновить секцию "Что делает приложение":
  - Добавить: "Общий режим поддерживает тренировки дома, дома с турником, в зале"
  - Добавить: "Автоматическая прогрессия по данным о тренировках и замерах"

---

## 🚀 ДЕПЛОЙ

Отдельными коммитами по логическим блокам:
1. `GIMN-028-A: миграция 0021 + расширение equipment enum + check:equipment` (применена)
2. `GIMN-028-B: анкета — вопрос о месте тренировок и оборудовании`
3. `GIMN-028-C: миграции 0022 (dosage, workout_sets) + duration.ts` (применена)
4. `GIMN-028-D: миграция 0023 — 20 базовых упражнений для зала` (применена)
5. `GIMN-028-E: миграция 0024 — замеры тела + форма ввода` (применена)
6. `GIMN-028-F: автопрогрессия — уровень + вес + оповещение (модалка + Telegram)`
7. `GIMN-028-G: кнопка "Плохо" → "Свой вариант"`
8. `GIMN-028-H: legal-документы обезличены (без ФИО)`

Пуш `main` → автодеплой Actions.

**Миграции 0021-0024 применяешь сам** через SERVICE_ROLE_KEY — в отчёте только "миграция N применена", содержимое ключа не показывать.

---

## 🔙 ОГЛЯДЫВАЮСЬ НАЗАД

Открытые пункты после GIMN-028:
- ⏸ GIMN-029 (мобильная версия всего + PDF + вход SMS/Email/соцсети) — следующий
- ⏸ GIMN-025 (видео wger, я ищу ссылки) — параллельно
- ⏸ Live testing 18 пунктов CHECKLIST_TESTING.md
- ⏸ Показать DOC_REVMATOLOG_CHECKLIST_gimn.docx врачу
- ⏸ Меню/БЖУ для зала (2-я ось подбора) — отдельным батчем позже
- ⏸ Самозанятость/ИП, ЮKassa, домен, платный запуск

---

## ⏱ ВРЕМЯ

- ШАГ 0 разведка: 10-15 мин
- Блок A (equipment enum + миграция): 20 мин
- Блок B (анкета): 25 мин
- Блок C (dosage + факт + duration): 30 мин
- Блок D (20 упражнений с текстами): 45-60 мин
- Блок E (замеры): 30 мин
- Блок F (автопрогрессия + оповещения): 45 мин
- Блок G (кнопка "Плохо" → своё): 15 мин
- Блок H (переписать legal): 15 мин
- Самопроверка + preview URL: 15 мин
- Коммиты + пуш: 10 мин

**Итого кот: ~4-5 часов**

---

**Готов. Отдавай коту.**
