-- 0016 (GIMN-013): визуал на каждое упражнение.
--
-- Было: картинка только у 8 упражнений из 61 (колонка gif_url), остальные
-- показывали знак своего типа. Стало: живая картинка там, где нашлось точное
-- совпадение движения, и рисованная схема со стрелками — всем остальным.
--
-- Схемы не хранятся в базе: они рисуются кодом по slug
-- (src/components/exercise/exercise-scheme.tsx), поэтому колонок им не нужно.
-- В базу добавляем только адрес живой картинки и подпись об источнике —
-- атрибуция требуется лицензией Pixabay.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS image_credit VARCHAR(40);

COMMENT ON COLUMN exercises.image_url IS
  'Статичная картинка движения (GIMN-013). Показывается, если нет gif_url';
COMMENT ON COLUMN exercises.image_credit IS
  'Источник картинки для подписи в карточке, например Pixabay';

-- Отобраны вручную и отсмотрены глазами: движение совпадает с нашей техникой.
-- Файлы скачаны в public/exercises/ (хотлинк запрещён лицензией Pixabay),
-- источники — в docs/IMAGE_SOURCES.md.
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp', image_credit = 'Pixabay'
WHERE slug IN ('gen-plank', 'gen-pushup', 'main-hip-abduction', 'stretch-child-pose');
