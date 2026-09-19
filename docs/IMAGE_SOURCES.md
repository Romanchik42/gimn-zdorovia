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

Остальные 42 упражнения показывают знак своего типа (дыхание, разминка,
основное, растяжка, самомассаж) — `src/components/exercise/exercise-placeholder.tsx`.
Для них в свободных лицензиях не нашлось картинок, точно совпадающих с
техникой. Отвергнуто: Hamstring stretch CDC (сидя, у нас — лёжа), Chest
stretch CDC (не дверной проём), Wall push-up CDC (у нас — от пола), фото
военных и туристов — другой стиль.

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

Pixabay и Pexels отдают API только по ключу, Unsplash из этой сети недоступен.
Если захотите фото — нужен ключ API, либо подберите вручную и положите в
`public/exercises/` с тем же именем `<slug>.gif|webp`.
