# Пути и ветки

Где что лежит, как устроен репозиторий и как код попадает на прод. Написано
так, чтобы новый человек нашёл нужный файл, не спрашивая.

Актуально на 22 сентября 2026 (GIMN-018).

---

## 1. Где живёт проект

| Что | Где |
|---|---|
| Рабочая папка | `F:\Project gimn zdorovia` |
| Репозиторий | https://github.com/Romanchik42/gimn-zdorovia |
| Хостинг и прод | Vercel, проект привязан через `.vercel/project.json` |
| База данных | Supabase (PostgreSQL + RLS + Storage) |
| Бот | Telegram, вход и напоминания |
| Расписание | cron-job.org зовёт `/api/cron/*` |

Стек: Next.js 16.3.5 (App Router, Turbopack), React 19.2, TypeScript,
Tailwind 4, shadcn/ui, Zod 4, Supabase JS. Пакетный менеджер — **pnpm 9.15.9**,
он же прописан в `package.json` → `packageManager`; npm/yarn не использовать,
разойдётся lock-файл.

---

## 2. Структура папок

```
F:\Project gimn zdorovia\
├── src/                      код приложения (186 файлов)
│   ├── app/                  маршруты Next.js (App Router)
│   │   ├── api/              серверные ручки: workout, nutrition, plan,
│   │   │                     onboarding, telegram, cron, referral, settings
│   │   ├── app/              само приложение: сегодня, каталог, питание,
│   │   │                     прогресс, план, настройки, тренировка
│   │   ├── onboarding/       welcome → mode → анкета режима → тема
│   │   ├── auth/             вход и регистрация (только Telegram)
│   │   ├── admin/stats/      статистика, только для админа
│   │   ├── i/[code]/         страница приглашения
│   │   ├── tg/               вход из приложения внутри Telegram
│   │   ├── layout.tsx        корневой каркас: шрифты, тема, Toaster, PWA
│   │   └── globals.css       7 палитр + токены Tailwind
│   ├── components/           компоненты по областям (ui/ — shadcn)
│   ├── lib/                  вся логика без разметки
│   │   ├── workout-engine/   подбор занятия: generator, custom-builder,
│   │   │                     catalog, equipment, length, weekly-cycle
│   │   ├── nutrition-engine/ калории и меню
│   │   ├── diagnostics/      углублённая диагностика и выводы из неё
│   │   ├── schemas/          Zod-схемы — одни на клиент и на сервер
│   │   ├── supabase/         клиенты и типы БД
│   │   ├── telegram/         бот, подпись, сообщения
│   │   ├── modes/            режимы занятий
│   │   ├── sound/            6 наборов звуков (синтез в коде)
│   │   ├── cron/             напоминания и персональный отчёт
│   │   └── referral/         коды приглашений
│   └── types/                типы окружения
├── public/                   статика, раздаётся как есть
│   ├── exercises/            картинки упражнений + превью (26 из 76)
│   ├── icons/, logo/         ярлыки и логотип
│   ├── avatars/              12 аватаров профиля
│   ├── sounds/               наборы звуков
│   ├── manifest.json         паспорт PWA
│   ├── sw.js                 service worker (написан руками)
│   └── offline.html          страница «нет сети»
├── supabase/
│   ├── migrations/           0001…0018, применяются по порядку
│   ├── seed.sql              справочники: 76 упражнений, блюда, шаблоны
│   └── apply_all.sql         СОБИРАЕТСЯ скриптом, руками не править
├── scripts/                  вспомогательные, запускаются вручную
│   └── lib/seed-exercises.mjs разбор справочника из seed, общий для обоих
│                              документов врачу
├── docs/                     IMAGE_SOURCES.md — откуда картинки и лицензии
├── secrets/                  реальные ключи, В GIT НЕ ПОПАДАЮТ
└── .github/workflows/        деплой и синхронизация переменных
```

---

## 3. Важные файлы в корне

| Файл | Зачем |
|---|---|
| `SPEC_gimn_zdorovia_v2.md` | **Источник истины.** Расхождение кода и спецификации решается в пользу спецификации |
| `CHECKLIST_TESTING.md` | Ручная проверка перед выкладыванием, 18 разделов |
| `GUIDE_STANDALONE_WEB_APP.md` | Путь к своему домену и установке на телефон |
| `DOC_REVMATOLOG_FULL_gimn_zdorovia.md` | Справочник упражнений для врача, для чтения (собирается скриптом) |
| `docs/DOC_REVMATOLOG_CHECKLIST_gimn.docx` | Он же в Word, для заполнения врачом (собирается скриптом) |
| `PATHS_AND_BRANCHES.md` | Этот файл |
| `AGENTS.md`, `CLAUDE.md` | Правила для ИИ-помощника. `CLAUDE.md` — одна строка `@AGENTS.md` |
| `BATCH_*.md` | История заданий по тикетам |
| `.env.example` | Шаблон переменных, **коммитится без значений** |
| `package.json` | Зависимости и `packageManager: pnpm@9.15.9` |
| `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs` | Конфигурация сборки |
| `vercel.json` | Указывает Vercel, что это Next.js |
| `components.json` | Настройки shadcn/ui |

---

## 4. Скрипты

Все запускаются вручную из корня, в сборку не входят.

| Команда | Что делает |
|---|---|
| `node scripts/build-apply-all.mjs` | Пересобирает `supabase/apply_all.sql` из миграций и seed. **Запускать после каждой новой миграции** |
| `node scripts/build-apply-all.mjs --from=0017` | То же, но отдельным файлом только миграции от 0017 и дальше плюс seed. Нужно потому, что `apply_all.sql` перерос размер, который принимает вставка в SQL Editor |
| `... --from=0017 --no-seed` | Только миграции, без seed — если и 100 КиБ не проходят; seed тогда вставляется вторым заходом |
| `node scripts/build-doctor-doc.mjs` | Пересобирает документ для ревматолога (Markdown) из seed |
| `node scripts/build-doctor-docx.mjs` | Пересобирает заполняемый чеклист врачу в Word (`docs/*.docx`) |
| `node scripts/fetch-wger-images.mjs` | Скачивает картинки упражнений с wger |
| `node scripts/fetch-exercise-images.mjs` | То же с Pixabay (нужен ключ из `secrets/.env`) |
| `node scripts/build-exercise-thumbs.mjs` | Делает превью 96 px для каталога |
| `node scripts/preview-schemes.mjs . <slug> out.png` | Собирает схемы движения в PNG — отсмотреть стрелки глазами |
| `node scripts/generate-icons.mjs` | Ярлыки приложения из логотипа |
| `node scripts/generate-sounds.mjs` | Синтезирует 6 наборов звуков |

Ежедневные команды разработки:

```
pnpm dev            запуск локально
npx tsc --noEmit    типы
npx eslint          линтер
npx next build      сборка
```

---

## 5. Секреты

**`secrets/.env` — реальные ключи, в git не попадают** (`.gitignore`:
`secrets/*` с исключением для README и шаблона). В Vercel те же значения
прописываются руками в Project Settings → Environment Variables.

Перечень переменных — в `.env.example`: Supabase (URL, anon, service role),
Telegram (токен бота, имя бота, секрет вебхука), адреса приложения и автора,
`ADMIN_USER_ID`, `CRON_SECRET`.

`.vercelignore` отдельно запрещает загружать `secrets/` и любые `.env`
на хостинг.

---

## 6. Ветки git

Сейчас в репозитории **одна ветка — `main`**, и весь путь до сегодняшнего
дня пройден коммитами прямо в неё. Для проекта из одного разработчика это
не беда, но дальше разумно:

| Ветка | Для чего |
|---|---|
| `main` | То, что стоит на проде. Пуш в неё = выкладывание |
| `feature/<имя>` | Новая возможность. Вливается в `main` после прохождения чеклиста |
| `bugfix/<имя>` | Срочная починка прода |

Ветка `develop` **не заводится**: при одном разработчике и автодеплое она
добавляет шаг, но ничего не ловит — то же самое делает `feature/*` перед
вливанием.

**Ближайшие ветки по планам:**

* `feature/standalone-domain` — переезд на свой домен. Что в ней делать,
  расписано в `GUIDE_STANDALONE_WEB_APP.md`. Правок кода почти нет, зато
  есть переменная `NEXT_PUBLIC_APP_URL`, webhook бота, `/setdomain` в
  BotFather и задания cron-job.org.
* `feature/native-wrapper` — обёртка для магазинов приложений.
  **Пока не создаём**, см. раздел 6 того же документа.

---

## 7. Как код попадает на прод

```
правки локально
   ↓ npx tsc --noEmit && npx eslint && npx next build
   ↓ git commit
   ↓ git push origin main
GitHub Actions (.github/workflows/deploy.yml)
   ↓ vercel pull → vercel build --prod → vercel deploy --prebuilt
Vercel, прод
```

Деплой идёт **с GitHub, а не с ноутбука**: локальный `vercel` CLI в этом
окружении не работает, поэтому выкладывание — это `git push`, а всё
остальное делает workflow. Второй workflow, `vercel-env-sync.yml`,
синхронизирует переменные окружения.

**Миграции базы деплой не применяет.** После новой миграции:

1. `node scripts/build-apply-all.mjs --from=<номер первой непримененной>`
2. Открыть `supabase/apply_from_<номер>.sql`, скопировать целиком
3. Supabase → SQL Editor → вставить → Run

Файлы идемпотентны: повторный прогон ничего не ломает и не задваивает.

**Почему не `apply_all.sql`.** Он вырос до 152 КиБ, а вставка в SQL Editor
обрывается около 132 КиБ. Postgres при этом сообщает
`unterminated quoted string` на том месте, где оборвало, — файл при этом
целый, и экранировать в нём нечего. `apply_all.sql` остаётся для чистой
базы; живую догоняют файлом `apply_from_*`.

Если и он не проходит вставкой, делается в два захода:
`--from=<номер> --no-seed` (7 КиБ), потом отдельно `supabase/seed.sql`
(96 КиБ). Seed идемпотентен и трогает только справочники —
`exercises`, `meals`, `workout_sequences`, `side_effect_rules`; данных
пользователей в нём нет.

На сегодня непримененными могут быть **0017** (турник: колонки `equipment`
и `has_turnik` плюс 15 упражнений в seed), **0018** (картинки с wger) и
**0019** (описания без названия диагноза) — без 0017 приложение соберётся,
но вопрос про турник упадёт при сохранении анкеты.

---

## 8. Что нельзя делать

* Править `supabase/apply_all.sql` руками — он собирается скриптом, правка потеряется.
* Править `DOC_REVMATOLOG_FULL_gimn_zdorovia.md` и
  `docs/DOC_REVMATOLOG_CHECKLIST_gimn.docx` руками — то же самое.
* Класть значения в `.env.example` — он коммитится.
* Ставить пакеты через npm или yarn — разойдётся `pnpm-lock.yaml`.
* Удалять блок про Next.js из `AGENTS.md` — его заново пишет `next dev`,
  и в диффе он появится снова.
