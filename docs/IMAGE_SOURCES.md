# Источники изображений

Всё ниже можно использовать коммерчески без атрибуции (CC0 или общественное
достояние). Ссылки — на страницы файлов с указанием лицензии.

## Картинки упражнений — `public/exercises/<slug>.gif`

Серия CDC «Growing Stronger — Strength Training for Older Adults» (Центры по
контролю и профилактике заболеваний США). Работы федерального правительства
США — **общественное достояние**. Взяты только те, где движение совпадает с
нашей техникой.

| Файл | Упражнение | Источник |
|---|---|---|
| `gen-crunch.gif` | Скручивания на пресс | [Abdominal curl](https://commons.wikimedia.org/wiki/File:Abdominal_curl-CDC_strength_training_for_older_adults.gif) |
| `gen-superman.gif` | Лодочка | [Floor back extensions](https://commons.wikimedia.org/wiki/File:Floor_back_extensions-CDC_strength_training_for_older_adults.gif) |
| `warmup-pelvic-tilt.gif` | Наклоны таза лёжа | [Pelvic tilt](https://commons.wikimedia.org/wiki/File:Pelvic_tilt-CDC_strength_training_for_older_adults.gif) |
| `gen-stretch-quads.gif` | Растяжка передней поверхности бедра | [Quad stretch](https://commons.wikimedia.org/wiki/File:Quad_stretch-CDC_strength_training_for_older_adults.gif) |
| `gen-squat.gif` | Приседания | [Squat](https://commons.wikimedia.org/wiki/File:Squat-CDC_strength_training_for_older_adults.gif) |
| `main-heel-raises.gif` | Подъёмы на носки | [Toe stand](https://commons.wikimedia.org/wiki/File:Toe_stand-CDC_strength_training_for_older_adults.gif) |
| `gen-lunges.gif` | Выпады (с опорой) | [Lunge](https://commons.wikimedia.org/wiki/File:Lunge-CDC_strength_training_for_older_adults.gif) |
| `breath-diaphragm.gif` | Диафрагмальное дыхание | [Diaphragmatic breathing](https://commons.wikimedia.org/wiki/File:Diaphragmatic_breathing.gif) — John Pierce, **CC0** |

## Картинки упражнений — `public/exercises/<slug>.webp`

[Pixabay](https://pixabay.com/service/license-summary/) — Content License:
использование бесплатно, в том числе коммерчески. Хотлинк запрещён, поэтому
файлы скачаны к себе (`node scripts/fetch-exercise-images.mjs`, ключ — только
в `secrets/.env`). В карточке и в каталоге под картинкой стоит подпись
«изображение: Pixabay» (поле `exercises.image_credit`).

| Файл | Упражнение | Автор | Источник | Взято |
|---|---|---|---|---|
| `gen-plank.webp` | Планка | Mohamed_hassan | [plank-exercise-sport-workout-man-6573171](https://pixabay.com/vectors/plank-exercise-sport-workout-man-6573171/) | 21.09.2026 |
| `gen-pushup.webp` | Отжимания | katigori | [press-up-push-up-4925111](https://pixabay.com/illustrations/press-up-push-up-press-up-push-up-4925111/) | 21.09.2026 |
| `main-hip-abduction.webp` | Отведение ноги лёжа на боку | SerenaWong | [exercise-side-lying-leg-raises-woman-2180074](https://pixabay.com/illustrations/exercise-side-lying-leg-raises-woman-2180074/) | 21.09.2026 |
| `stretch-child-pose.webp` | Поза ребёнка | AndiP | [yoga-childs-pose-asana-2959214](https://pixabay.com/photos/yoga-childs-pose-asana-2959214/) | 21.09.2026 |

Каждый файл отсмотрен глазами: движение совпадает с нашей техникой.

**Отвергнуто при отборе** (движение другое — ставить такое хуже, чем не
ставить): «side plank» с Pixabay — продвинутая поза васиштхасана с поднятой
ногой, у нас обычная боковая планка; «mini squat» — обычный глубокий присед;
«jumping jacks» — игрушка-паяц и собака Джек-Рассел; «bird dog» — собаки;
«dead bug» — жуки; «glute bridge» — лондонские мосты; самомассаж — фото
массажиста, работающего с клиентом, а у нас человек массирует себя сам.
Из прежних отборов: Hamstring stretch CDC (сидя, у нас — лёжа), Chest stretch
CDC (не дверной проём), Wall push-up CDC (у нас — от пола).

## Схемы движения — рисуются кодом

`src/components/exercise/exercise-scheme.tsx` — 49 упражнений, у которых
точного совпадения в свободных источниках не нашлось. Это собственная
работа: фигурка задаётся координатами суставов, движение — стрелками.
Лицензий не требует, весит ноль (инлайн-SVG), перекрашивается темой
(фигурка — `currentColor`, стрелки — брендовый акцент).

Знак типа упражнения (`exercise-placeholder.tsx`) остался аварийным
запасом: в справочнике нет упражнений, которые до него доходят.

## Знаки типов упражнений и ярлык приложения

[Health Icons](https://healthicons.org) — **CC0** (авторы отказались от всех прав).

- `lungs` — дыхание, `walking` — разминка, `exercise` — основное,
  `exercise-yoga` — растяжка, `spine` — самомассаж.
- Ярлык (`public/icons/*`, `public/logo/*`, `src/app/favicon.ico`) — фигура
  `exercise-yoga` на брендовом Sage `#7C9885`. Временный: авторский логотип
  заменит GLYPH в `scripts/generate-icons.mjs`, затем `node scripts/generate-icons.mjs`.

## Аватары профиля — `public/avatars/avatar-01…12.svg`

Стиль [Open Peeps](https://www.openpeeps.com) (Pablo Stanley) — **CC0**,
собраны генератором [DiceBear](https://www.dicebear.com/styles/open-peeps/)
с ограничением на спокойные выражения лица и обычные очки.

## Не использовались

Pexels и Unsplash — из этой сети недоступны. Если захотите добавить фото
вручную, положите файл в `public/exercises/` с именем `<slug>.webp` и
пропишите его в `exercises.image_url` (и в `supabase/seed.sql`).
