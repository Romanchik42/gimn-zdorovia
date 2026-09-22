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

## Картинки упражнений — wger (GIMN-015)

[wger.de](https://wger.de) — открытая база тренировок. Картинки лежат под
Creative Commons (**CC BY-SA 3.0 / 4.0**) и доступны через публичный API
без ключа (`https://wger.de/api/v2/exerciseimage/`). Лицензия требует
назвать автора — он печатается под картинкой из `exercises.image_credit`.

Файлы скачаны к себе (`node scripts/fetch-wger-images.mjs`): хотлинк на
чужой сервер означал бы, что картинки исчезнут в день переезда wger.

| Файл | Упражнение wger | Автор | Лицензия | Источник |
|---|---|---|---|---|
| `bar-pullup-overhand.webp` | Pull-ups | Imobard | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/475/b0554016-16fd-4dbe-be47-a2a17d16ae0e.jpg) |
| `bar-pullup-underhand.webp` | Chin Up | Everkinetic | CC BY-SA 3.0 | [файл](https://wger.de/media/exercise-images/152/b2c5a9f9-8beb-41f7-841c-9664d22a427e.png) |
| `dip-pushup.webp` | Dips | cshep442 | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/194/34600351-8b0b-4cb0-8daa-583537be15b0.png) |
| `bar-australian-row.webp` | Inverted Rows | Gavru | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/1198/864906ac-4ac7-4e52-a886-c6bb97950a9f.jpg) |
| `bar-knee-raise.webp` | Knee Raises | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/978/d3ffe51f-7eb8-4cc9-9eae-105847af3005.png) |
| `bar-leg-raise.webp` | Leg raises pull up bar | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/979/27097a3a-5749-428d-b94c-6082afe390f6.png) |
| `main-bird-dog.webp` | Quadriped Arm and Leg Raise | utkb | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/957/0fd94587-6021-4763-856e-7227f5fcba2a.png) |
| `gen-jumping-jacks.webp` | Jumping Jacks | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/320/6c9124b6-3551-47a8-9c22-20141c8b9c53.png) |
| `warmup-neck-tilts.webp` | Head tilts | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/1018/5bbd3879-b6fc-4aaa-9e8e-33ae9a688112.png) |
| `warmup-neck-turns.webp` | Head turns | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/1007/757846d3-78e4-4068-bbca-62e567372c94.png) |
| `main-hip-flexor-stretch.webp` | Hip Flexor Stretch | Davidgj32 | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/1867/767631e5-10d2-46b8-b03f-cc298f96963b.png) |
| `stretch-piriformis.webp` | Lying Figure Four Stretch | Davidgj32 | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/1869/c49187bd-9f90-4a7a-b25e-1d50e857a104.png) |
| `main-bridge.webp`, `gen-glute-bridge.webp` | Glute Bridge | wger | CC BY-SA 4.0 | [файл](https://wger.de/media/exercise-images/265/7528acb4-b2cc-4b75-b6ae-d514cbd4f78b.png) |

У «Glute Bridge» поверх кадров стояли испанские подписи «Inicio / Movimiento» —
обрезаны сверху (`cropTop` в скрипте). Обрезка — переработка по смыслу
CC BY-SA, она разрешена при сохранении той же лицензии. Один и тот же файл
лежит под двумя именами: мостик есть в обоих режимах, а `image_url`
собирается из slug.

**Отвергнуто при отборе** (движение другое): «Bench dips» — отжимания от
скамьи, у нас брусья; «Lower Back Extensions» — тренажёр, у нас лёжа на
животе; «Knee to Chest Stretch» — одно колено, у нас оба; «Side stretch» —
рука над головой, у нас ладонь скользит вдоль бедра; «Foam Roller Gluteus» —
ролик, у нас мяч; «Pigeon Stretch» — сидя, у нас лёжа; «TRX Rows» — петли,
у нас резинка; «Sloper hanging» — скалолазный вис на согнутых руках, у нас
на прямых; «Side-laying interior rotation» — внутренняя ротация, у нас
наружная; «Torso Twist» — стоя, у нас на четвереньках; «Slow Squat»,
«Box squat» — обычный присед, у нас неглубокий у опоры.

**Что не подошло как источник.** Musclewiki и ExRx отвечают 403 на любой
машинный запрос, и их условия использования не разрешают брать картинки
к себе — оба отпадают и по технике, и по праву. Из серии CDC на Викискладе
(22 файла) взято всё подходящее ещё в GIMN-013; оставшиеся — упражнения
с гантелями и те, где движение расходится с нашим («Backstretch» —
наклон вперёд стоя, «Finger marching» — рука идёт по воздуху сидя,
а у нас по стене).

## Схемы движения — рисуются кодом

`src/components/exercise/exercise-scheme.tsx` — 68 схем, из них 50 остаются
единственным визуалом упражнения: точного совпадения в свободных источниках
не нашлось. Отсмотреть их разом —
`node scripts/preview-schemes.mjs . <подстрока-slug> out.png`. Это собственная
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
