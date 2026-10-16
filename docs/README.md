# docs/ — карта проекта «Гимн здоровья» (где что лежит)

Короткий справочник адресов, чтобы не искать заново. Полная карта репозитория и
как код попадает на прод — в корневом `PATHS_AND_BRANCHES.md` (это главный документ-карта).

Обновлено: 2026-10-16.

## Код приложения

| Что | Где |
|---|---|
| Весь код | `src/` |
| Страницы/маршруты (App Router) | `src/app/` (приложение — `src/app/app/`, онбординг — `src/app/onboarding/`, админка — `src/app/admin/`, API — `src/app/api/`, Telegram-вход — `src/app/tg/`) |
| Общие компоненты | `src/components/` (ui, layout, exercise, onboarding, settings, workout, progress, nutrition, family…) |
| Логика/хелперы | `src/lib/` (supabase, telegram, tour, progression, nutrition, auth, sound…) |
| Темизация (ЕДИНЫЙ источник цветов) | `src/app/globals.css` — 7 тем через `data-theme` |
| Шрифты | `src/app/layout.tsx` (Inter + JetBrains Mono) |
| Нижняя навигация | `src/components/layout/bottom-nav.tsx` |
| Полноэкран в Telegram | `src/components/layout/telegram-viewport.tsx` + `src/app/app/layout.tsx` |
| Скелетоны при переходах | `src/app/app/loading.tsx`, `src/app/onboarding/loading.tsx` |

## Документы (в корне репозитория)

| Что | Файл |
|---|---|
| Главная карта репозитория + деплой | `PATHS_AND_BRANCHES.md` |
| Спецификация функциональности | `SPEC_gimn_zdorovia_v2.md` |
| Дизайн-система Гимна (реальная) | `DESIGN_SYSTEM_гимн.md` |
| Чужой design-doc (от ai-arhitektor, НЕ про Гимн, справка) | `DESIGN_SYSTEM.md` |
| Известные грабли / правила против них | `MINES.md` |
| Чек-лист тестирования | `CHECKLIST_TESTING.md` |
| Standalone/веб-приложение (PWA/Telegram) | `GUIDE_STANDALONE_WEB_APP.md` |
| Отложенное | `DEFERRED.md` |

## Рабочие заметки-батчи

Все `BATCH_*`, `AUDIT_*`, `CHAIN_*`, `GIMN-*` задачи-заметки — здесь, в `docs/batches/`.
`docs/batches/files.zip` — вспомогательный архив, лежит просто файлом и в git-историю НЕ входит (см. `.gitignore`).
Проверка тура (`scripts/check-tour.mts`) сверяет тексты тура с батчами именно из `docs/batches/`.

## Проверки и деплой

| Что | Команда |
|---|---|
| Типы / линт / сборка | `npx tsc --noEmit`, `npx eslint .`, `npm run build` |
| Доменные проверки (9 шт.) | `npm run check:equipment|points|dosage|progression|auth|pdf|tour|admin|family` |
| Деплой на прод | **пуш в ветку `main`** = автодеплой Vercel (CLI не нужен; см. `PATHS_AND_BRANCHES.md §6`) |

Remote: `github.com/Romanchik42/gimn-zdorovia`.
