# DESIGN_SYSTEM — стиль приложения Гимн.здоровья

Это выписка фундамента стиля: токены и правила, без макетов и компонентов.
Все значения сняты с исходников, ничего не придумано:
`src/app/globals.css` (строки 10–285 — токены семи тем + мост в Tailwind v4),
`src/app/layout.tsx` (подключение шрифтов), `src/app/app/layout.tsx` (safe-area Telegram).

> Формат этого документа повторяет `DESIGN_SYSTEM.md` (эталон стиля админки другого проекта — ai-arhitektor). Тот файл описывает ЧУЖУЮ систему («Matrix / Neon Blue», `admin.css`) и к Гимну отношения не имеет — он оставлен как есть для справки, а этот описывает реальный Гимн.

> **Важно про темизацию.** В отличие от shadcn-дефолта с классом `.dark`, Гимн переключает тему **атрибутом `data-theme` на `<html>`** (семь тем). Цвета живут только в `globals.css` и НЕ дублируются по компонентам — компоненты пишут классами Tailwind (`bg-card`, `text-primary`), а те читают CSS-переменные в рантайме через `@theme inline`.

---

## 1. Цвета

Семь тем переключаются атрибутом `data-theme` на `<html>`. Тема по умолчанию — **sage** (она же `:root`). Шесть светлых (sage, terracotta, ocean, lavender, sand, mint) и одна тёмная (graphite). Все пары проверены на контраст (комментарии в коде: ≥ 4.66–5.2 : 1).

### 1.1 Роли-токены (одинаковы во всех темах)

| Токен | Назначение |
|---|---|
| `--background` / `--foreground` | фон страницы и основной текст |
| `--card` / `--card-foreground` | карточки, поповеры-поверхности |
| `--popover` / `--popover-foreground` | всплывающие слои |
| `--primary` / `--primary-foreground` | брендовая кнопка/акцент и текст на ней |
| `--primary-hover` | ховер/нажатие основной кнопки |
| `--secondary` / `--secondary-foreground` | вторичные поверхности/кнопки |
| `--muted` / `--muted-foreground` | приглушённый фон и подписи |
| `--accent` / `--accent-foreground` | второй акцент (напр. кнопка «Тяжело») |
| `--destructive` / `--destructive-foreground` | удаление/ошибка/«плохо» |
| `--success` / `--success-foreground` | успех/«хорошо» |
| `--border` / `--input` / `--ring` | рамки, поля ввода, кольцо фокуса |
| `--chart-1` | цвет данных на графиках (тон primary, но хрома ≥ 0.1 — иначе сливается с сеткой) |
| `--logo-primary` / `--logo-accent` | цвета логотипа под тему |

### 1.2 Инфо-таблички («Важно о здоровье»)

Тон выбирается в настройках (`users.info_card_tint`), подмешивается к цвету карточки текущей темы:

| Токен | Значение |
|---|---|
| `--info-bg` | `color-mix(oklab, --muted 60%, --card)`; при выбранном тоне — `--info-tint 14% + --card` |
| `--info-border` | `--border`; при тоне — `--info-tint 40% + --card` |
| `--info-fg` | `--foreground` |
| `--info-tint` | neutral / blue `#3f7fb8` / sage `#6f8a78` / coral `#d0704f` / sand `#b8904f` / lavender `#8570b8` |

### 1.3 Свечение карточек

`[data-card-glow="on"] .bg-card` — мягкая тень цветом `--primary`, радиус задаётся `--card-glow-strength` (0–100). Опция «Свой выбор» в оформлении.

---

## 2. Типографика

### 2.1 Шрифты (next/font, layout.tsx)

| Роль | Переменная | Шрифт |
|---|---|---|
| Основной (`--font-sans`) | `--font-inter` | **Inter** (subset latin + cyrillic) |
| Моноширинный (`--font-mono`) | `--font-jetbrains-mono` | **JetBrains Mono** — только для цифр/чисел (вес, повторы, бейджи) |

`body { font-family: var(--font-sans) }`. Моно применять осознанно к числовым данным, не к обычному тексту.

### 2.2 Шкала заголовков (конвенция — соблюдать)

| Роль | Классы Tailwind |
|---|---|
| **Заголовок экрана (h1)** | `text-2xl font-semibold tracking-tight` — ЕДИНЫЙ размер на всех страницах `/app`, `/onboarding`, `/admin` |
| Заголовок секции/карточки | `text-lg font-semibold` (крупная карточка) или `text-sm font-medium text-muted-foreground` (подпись-ярлык группы) |
| Основной текст | базовый (`text-base`/`text-sm` по месту) |
| Подпись/вторичное | `text-xs`–`text-sm text-muted-foreground` |

> Исторически h1 были вперемешку `text-xl`/`text-2xl` — приведены к `text-2xl` (правка 2026-10-16). Новые экраны делать сразу по этой шкале.

### 2.3 Размеры в туре (driver.js, `.gz-tour`)

Заголовок подсказки `1.125rem / 600`; текст `1rem / line-height 1.55`; кнопки `0.875rem`, главная `0.9375rem / 600`.

---

## 3. Отступы и геометрия

### 3.1 Радиусы

| Токен | Значение |
|---|---|
| `--radius` (база) | `0.75rem` |
| `--radius-sm` | `calc(--radius - 4px)` |
| `--radius-md` | `calc(--radius - 2px)` |
| `--radius-lg` | `--radius` |
| `--radius-xl` | `calc(--radius + 4px)` |

### 3.2 Движение

Смена темы и базовые цвета — переход `0.3s ease` (background/color/border). Все анимации (пульс тура, прочерчивание стрелок схем, раскрытие секций) отключаются под `@media (prefers-reduced-motion: reduce)` — это приложение для людей с болями, резкое движение лишнее.

### 3.3 Цель тапа

На сенсорных (`@media (pointer: coarse)`) у `button`, `a[role="button"]`, `[role="tab"]` — `min-height: 44px`.

### 3.4 Безопасные зоны

Низ (нижняя навигация) — `env(safe-area-inset-bottom)`. Верх в полноэкранном Telegram — `var(--tg-safe-area-inset-top) + var(--tg-content-safe-area-inset-top)` (см. `app/app/layout.tsx`), вне Telegram переменных нет → 0.

---

## 4. Правила

1. **Цвет — только через токены темы.** Никаких hex/hsl в компонентах. Нужен новый смысловой цвет — добавить токен во все семь тем в `globals.css`, затем использовать класс Tailwind.
2. **Тема — атрибутом `data-theme`, не классом `.dark`.** Переключение темы не требует пересборки: `@theme inline` читает переменные в рантайме.
3. **Моно-шрифт — для чисел.** Остальное — Inter.
4. **Заголовок экрана — `text-2xl font-semibold tracking-tight`** (см. §2.2).
5. **Любая анимация уважает `prefers-reduced-motion`.**
6. **Интерактив ≥ 44px по высоте на тач.**

---

## 5. Палитра семи тем (справочник)

Ключевые цвета каждой темы (`--primary` / `--background` / `--foreground` / `--accent`):

| Тема | primary | background | foreground | accent |
|---|---|---|---|---|
| **sage** (по умолч.) | `#7C9885` | `#FAFAF7` | `#2D3E33` | `#C89858` |
| terracotta | `#C97B5C` | `#FDF9F5` | `#3A2D28` | sage `#7C9885` |
| ocean | `#4A8E9E` | `#F7FAFB` | `#1F3A44` | `#D9974A` |
| lavender | `#6E5A9E` | `#F8F6FB` | `#2E2840` | `#9A6128` |
| sand | `#8C6239` | `#FBF7F0` | `#3A2E22` | `#3F7A66` |
| mint | `#2F7D69` | `#F3FAF7` | `#1D3A33` | `#9C6A2A` |
| **graphite** (тёмная) | `#8CC4A6` | `#1C1F23` | `#E9ECEF` | `#E0B070` |

Логотип подстраивается под тему через `--logo-primary` / `--logo-accent`. Полный список токенов каждой темы — в `src/app/globals.css` (строки 14–219).

---

## 6. Как применять

- Красишь компонент — бери классы Tailwind на токенах (`bg-background`, `bg-card`, `text-foreground`, `text-primary`, `border-border`, `bg-muted`, `text-muted-foreground`, `bg-destructive`…), а не конкретный цвет.
- Проверяешь контраст при добавлении темы/токена (в коде ссылаются на `validate_palette.js`).
- `theme_color` манифеста/PWA — зелёный `#7C9885` (под тему sage), см. `public/manifest.json` и `layout.tsx` (`viewport.themeColor`).
- Источник истины по цветам — ТОЛЬКО `globals.css`. Этот документ — его человекочитаемая выписка; при расхождении прав код.
