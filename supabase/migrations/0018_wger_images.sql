-- 0018 (GIMN-015): картинки движения с wger.
--
-- Было: живая картинка у 12 упражнений из 76, остальным — рисованная схема.
-- Стало: ещё 14, в том числе всем шести турниковым, где движение сложное
-- и схема объясняет его хуже фотографии.
--
-- Источник — wger.de, открытая база тренировок: 374 картинки под Creative
-- Commons, публичный API без ключа. Отобраны вручную и отсмотрены глазами:
-- взяты только те, где движение совпадает с нашей техникой. Musclewiki и
-- ExRx не подошли — оба закрыты от машинного доступа, и их условия
-- использования не разрешают брать картинки к себе.
--
-- Лицензия CC BY-SA требует назвать автора, поэтому image_credit хранит
-- «wger, <автор> (CC BY-SA 4.0)» — карточка печатает это под картинкой.
-- Полные ссылки на файлы — в docs/IMAGE_SOURCES.md и в scripts/fetch-wger-images.mjs.
--
-- Файлы скачаны в public/exercises/<slug>.webp: хотлинк на чужой сервер
-- означал бы, что картинки исчезнут в тот день, когда wger переедет.

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger (CC BY-SA 4.0)'
WHERE slug IN ('bar-knee-raise', 'bar-leg-raise', 'gen-jumping-jacks',
               'warmup-neck-tilts', 'warmup-neck-turns', 'main-bridge', 'gen-glute-bridge');

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Imobard (CC BY-SA 4.0)'
WHERE slug = 'bar-pullup-overhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Everkinetic (CC BY-SA 3.0)'
WHERE slug = 'bar-pullup-underhand';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, cshep442 (CC BY-SA 4.0)'
WHERE slug = 'dip-pushup';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Gavru (CC BY-SA 4.0)'
WHERE slug = 'bar-australian-row';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, utkb (CC BY-SA 4.0)'
WHERE slug = 'main-bird-dog';

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp',
                     image_credit = 'wger, Davidgj32 (CC BY-SA 4.0)'
WHERE slug IN ('main-hip-flexor-stretch', 'stretch-piriformis');
