-- ============================================================================
-- ДОБАВКА К УЖЕ ПРИМЕНЁННОЙ БАЗЕ: миграции 0017-0018 + seed.
-- Собрано из supabase/migrations/*.sql и supabase/seed.sql — источник правды там.
--
-- Когда брать этот файл, а не apply_all.sql: база уже живёт, миграции до
-- 0017 в ней есть. Повторный прогон безопасен — миграции написаны
-- идемпотентно (IF NOT EXISTS, DROP CONSTRAINT IF EXISTS), seed тоже.
--
-- Supabase → SQL Editor → вставить → Run.
-- ============================================================================

-- >>> 0017_equipment_turnik.sql
-- 0017 (GIMN-014): турник и брусья в общем режиме.
--
-- Было: справочник рассчитан на занятия без снаряда — дома, на коврике.
-- Стало: у упражнения появился признак нужного снаряда, а у анкеты общего
-- режима — вопрос «есть ли турник». Подбор смотрит на оба: без турника
-- турниковые упражнения не показываются вовсе, «могу найти» — показываются
-- последними и с пометкой, что нужен снаряд.
--
-- Почему флаг живёт в user_profiles_general, а не в отдельной таблице
-- настроек: это ответ анкеты общего режима, рядом с целью, активностью
-- и уровнем подготовки. Отдельная таблица на одну колонку означала бы
-- ещё один запрос и ещё один набор RLS-политик без единой выгоды.

-- 1. Нужный снаряд. 'none' — как было у всех 61 упражнения, поэтому DEFAULT
--    именно такой: старые строки остаются доступными всем без бэкофилла.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS equipment VARCHAR(20) NOT NULL DEFAULT 'none';
ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_equipment_check;
ALTER TABLE exercises ADD CONSTRAINT exercises_equipment_check
  CHECK (equipment IN ('none', 'pullup_bar', 'dip_bars'));

COMMENT ON COLUMN exercises.equipment IS
  'Нужный снаряд: none — ничего, pullup_bar — турник, dip_bars — брусья (0017)';

CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises(equipment);

-- 2. Ответ анкеты. 'no' по умолчанию — у кого турника нет, ничего не меняется;
--    те, кто анкету уже заполнил, турниковых упражнений не получат, пока
--    сами не ответят «да». Это осознанно: молча выдать подтягивания человеку,
--    который про турник не спрашивал, хуже, чем не выдать.
ALTER TABLE user_profiles_general ADD COLUMN IF NOT EXISTS has_turnik VARCHAR(10) NOT NULL DEFAULT 'no';
ALTER TABLE user_profiles_general DROP CONSTRAINT IF EXISTS user_profiles_general_has_turnik_check;
ALTER TABLE user_profiles_general ADD CONSTRAINT user_profiles_general_has_turnik_check
  CHECK (has_turnik IN ('yes', 'no', 'maybe'));

COMMENT ON COLUMN user_profiles_general.has_turnik IS
  'Есть ли турник: yes — есть, no — нет, maybe — «могу найти» (0017)';

-- RLS не трогаем: политика profiles_general_own стоит FOR ALL на всю строку,
-- колоночных грантов у этой таблицы нет — новая колонка наследует права.

-- >>> 0018_wger_images.sql
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

-- >>> seed.sql
-- ===========================================================================
-- seed.sql — начальное наполнение справочников.
-- Применяется ПОСЛЕ всех миграций 0001..0009.
-- Идемпотентен: повторный прогон ничего не дублирует (ON CONFLICT DO NOTHING).
--
-- Содержимое упражнений собрано по общедоступным рекомендациям ASAS/EULAR
-- по ЛФК при аксиальном спондилоартрите: низкоударные движения, работа на
-- подвижность и осанку, без осевой нагрузки и без крайних амплитуд.
-- Это вспомогательный материал, не медицинское назначение (SPEC 5.9).
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ: режим «Бехтерева» (35)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects) VALUES

-- Дыхание (4)
('breath-diaphragm', 'Диафрагмальное дыхание', 'breathing', 'core', 'behtereva',
 'Успокаивает, задаёт ритм занятия и раскрывает грудную клетку.',
 E'1. Лягте на спину, колени согнуты, стопы на полу.\n2. Одна ладонь на груди, вторая на животе.\n3. Вдох носом 4 счёта — поднимается ладонь на животе, грудь почти неподвижна.\n4. Выдох ртом 6 счётов, живот мягко опускается.\n5. Дышите ровно, без натуживания.',
 180, NULL, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"reduce_intensity"}]'::jsonb),

('breath-chest-expand', 'Дыхание с раскрытием рёбер', 'breathing', 'spine', 'behtereva',
 'Поддерживает подвижность рёберно-позвоночных суставов — при Бехтерева это ключевое.',
 E'1. Сядьте прямо, ладони на нижние рёбра сбоку.\n2. Вдох — направляйте воздух в ладони, рёбра расходятся в стороны.\n3. Выдох — рёбра мягко сходятся.\n4. Плечи остаются опущенными.',
 180, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('breath-square', 'Дыхание по квадрату', 'breathing', 'core', 'behtereva',
 'Снимает напряжение перед основной частью.',
 E'1. Вдох на 4 счёта.\n2. Задержка на 4 счёта.\n3. Выдох на 4 счёта.\n4. Пауза на 4 счёта.\n5. При головокружении уберите задержки.',
 120, NULL, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('breath-cooldown', 'Дыхание на расслабление', 'breathing', 'full_body', 'behtereva',
 'Завершает занятие, переводит тело в режим восстановления.',
 E'1. Лягте на спину, руки вдоль тела ладонями вверх.\n2. Вдох 4 счёта, выдох 8 счётов.\n3. С каждым выдохом отпускайте плечи, челюсть, ладони.',
 180, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Разминка и самомассаж (7)
('warmup-neck-turns', 'Повороты головы', 'warmup', 'neck', 'behtereva',
 'Мягко возвращает подвижность шейному отделу.',
 E'1. Сядьте или встаньте прямо, плечи опущены.\n2. Медленно поверните голову вправо до комфортного предела, задержитесь 2 секунды.\n3. Вернитесь в центр, поверните влево.\n4. Без рывков, амплитуда — до первого натяжения, не до боли.',
 NULL, 10, 'beginner', '["acute_neck_pain"]'::jsonb, '[{"trigger":"dizziness","action":"reduce_intensity"}]'::jsonb),

('warmup-neck-tilts', 'Наклоны головы к плечу', 'warmup', 'neck', 'behtereva',
 'Растягивает боковые мышцы шеи, снимает утреннюю скованность.',
 E'1. Сидя прямо, опустите правое плечо вниз.\n2. Мягко наклоните голову к левому плечу.\n3. Держите 15 секунд, дышите ровно.\n4. Повторите в другую сторону.',
 NULL, 6, 'beginner', '["acute_neck_pain"]'::jsonb, '[]'::jsonb),

('warmup-shoulder-rolls', 'Круги плечами', 'warmup', 'shoulder', 'behtereva',
 'Разогревает плечевой пояс перед основной частью.',
 E'1. Руки свободно опущены.\n2. Поднимите плечи вверх, отведите назад, опустите вниз — круг назад.\n3. Сделайте 10 кругов назад, затем 10 вперёд.\n4. Движение плавное, шея расслаблена.',
 NULL, 20, 'beginner', '[]'::jsonb, '[]'::jsonb),

('warmup-pelvic-tilt', 'Наклоны таза лёжа', 'warmup', 'hips', 'behtereva',
 'Пробуждает поясницу и мышцы кора без нагрузки на позвоночник.',
 E'1. Лягте на спину, колени согнуты.\n2. На выдохе прижмите поясницу к полу, таз чуть подкручивается.\n3. На вдохе отпустите, поясница естественно приподнимается.\n4. Работает только таз, ягодицы не отрываются.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('massage-suboccipital', 'Самомассаж основания черепа', 'massage', 'neck', 'behtereva',
 'Снимает напряжение в месте крепления мышц шеи к черепу.',
 E'1. Положите большие пальцы в ямки под затылочными буграми.\n2. Круговыми движениями массируйте 60 секунд.\n3. Давление — до приятного напряжения, не до боли.',
 60, NULL, 'beginner', '[]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb),

('massage-paravertebral', 'Самомассаж мышц вдоль позвоночника', 'massage', 'spine', 'behtereva',
 'Разогревает паравертебральные мышцы перед мобилизацией.',
 E'1. Костяшками или теннисным мячом у стены пройдите вдоль мышц по обе стороны позвоночника.\n2. Снизу вверх, 60-90 секунд.\n3. Сам позвоночник (остистые отростки) не массируйте.',
 90, NULL, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('massage-glutes-ball', 'Самомассаж ягодичных мячом', 'massage', 'hips', 'behtereva',
 'Расслабляет ягодичные мышцы, которые при Бехтерева часто перенапряжены.',
 E'1. Сядьте на мяч, перенесите вес на одну ягодицу.\n2. Медленно перекатывайтесь, задерживаясь на плотных участках по 10-15 секунд.\n3. По 60 секунд на сторону.',
 120, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Позвоночник: основная работа (10)
('main-cat-cow', 'Кошка-корова', 'main', 'spine', 'behtereva',
 'Базовая мобилизация всего позвоночника в сгибание и разгибание.',
 E'1. Встаньте на четвереньки: ладони под плечами, колени под тазом.\n2. Вдох — прогиб: грудь вперёд, копчик вверх, взгляд чуть вперёд.\n3. Выдох — округление: подбородок к груди, поясница вверх.\n4. Двигайтесь медленно, по одному позвонку.',
 NULL, 12, 'beginner', '["acute_back_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_exercise"}]'::jsonb),

('main-thoracic-rotation', 'Ротация грудного отдела', 'main', 'spine', 'behtereva',
 'Возвращает вращение грудному отделу — первое, что теряется при Бехтерева.',
 E'1. На четвереньках положите правую ладонь на затылок.\n2. Выдох — раскройте локоть вверх, поворачивая грудь к потолку.\n3. Вдох — верните локоть под себя.\n4. По 8 раз на сторону, таз неподвижен.',
 NULL, 16, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-side-bend-standing', 'Боковые наклоны стоя', 'main', 'spine', 'behtereva',
 'Поддерживает боковую подвижность — один из показателей диагностики.',
 E'1. Встаньте прямо, стопы на ширине таза.\n2. Скользите ладонью вдоль бедра вниз, наклоняясь строго вбок.\n3. Не наклоняйтесь вперёд и не разворачивайте корпус.\n4. Задержитесь 3 секунды, вернитесь.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-wall-posture', 'Выравнивание у стены', 'main', 'spine', 'behtereva',
 'Противодействует формированию сутулой осанки.',
 E'1. Встаньте спиной к стене: пятки, таз, лопатки и затылок касаются стены.\n2. Затылок тянется вверх, подбородок чуть к себе.\n3. Удерживайте 30 секунд, дышите ровно.\n4. Если затылок не достаёт — не запрокидывайте голову, оставьте зазор.',
 30, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-prone-extension', 'Разгибание лёжа на животе', 'main', 'spine', 'behtereva',
 'Прямо противодействует наклону корпуса вперёд.',
 E'1. Лягте на живот, ладони под плечами.\n2. На выдохе мягко приподнимите грудь, опираясь на предплечья.\n3. Поясница не проваливается, ягодицы расслаблены.\n4. Задержитесь 5 секунд, опуститесь.',
 NULL, 8, 'beginner', '["acute_back_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_exercise"}]'::jsonb),

('main-swimmer', 'Пловец лёжа', 'main', 'spine', 'behtereva',
 'Укрепляет разгибатели спины без осевой нагрузки.',
 E'1. Лягте на живот, руки вытянуты вперёд.\n2. Поднимите правую руку и левую ногу на 5-10 см.\n3. Задержитесь 3 секунды, опустите.\n4. Смените сторону. Шея продолжает линию позвоночника.',
 NULL, 16, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-bridge', 'Ягодичный мостик', 'main', 'hips', 'behtereva',
 'Укрепляет ягодицы и заднюю цепь, разгружает поясницу.',
 E'1. Лягте на спину, колени согнуты, стопы на ширине таза.\n2. На выдохе поднимите таз до линии колени-таз-плечи.\n3. Задержитесь 3 секунды, медленно опуститесь.\n4. Поднимайте за счёт ягодиц, а не поясницы.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-dead-bug', 'Жук', 'main', 'core', 'behtereva',
 'Учит держать нейтральную поясницу — база для защиты позвоночника.',
 E'1. Лягте на спину, руки вверх, колени над тазом под углом 90 градусов.\n2. Прижмите поясницу к полу.\n3. Выдох — опустите правую руку за голову и левую ногу вперёд.\n4. Вдох — вернитесь. Поясница всё время прижата.',
 NULL, 12, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-bird-dog', 'Птица-собака', 'main', 'core', 'behtereva',
 'Стабилизация корпуса и тренировка равновесия.',
 E'1. На четвереньках вытяните правую руку вперёд и левую ногу назад.\n2. Держите таз ровно, без заваливания.\n3. Удержание 5 секунд, затем смена стороны.',
 NULL, 12, 'intermediate', '[]'::jsonb, '[]'::jsonb),

('main-knee-to-chest', 'Колени к груди', 'main', 'spine', 'behtereva',
 'Мягко разгружает поясницу, снимает утреннюю скованность.',
 E'1. Лягте на спину.\n2. Подтяните оба колена к груди, обхватив руками.\n3. Покачайтесь вправо-влево 15 секунд.\n4. Дышите свободно, не задерживайте дыхание.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Плечи и руки (5)
('main-shoulder-wall-slide', 'Скольжение руками по стене', 'main', 'shoulder', 'behtereva',
 'Восстанавливает подъём рук и раскрывает грудной отдел.',
 E'1. Встаньте спиной к стене, предплечья прижаты к стене.\n2. Медленно скользите руками вверх, не отрывая предплечья.\n3. Поднимайтесь до предела, где контакт сохраняется.\n4. Медленно вернитесь.',
 NULL, 10, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"skip_joint"}]'::jsonb),

('main-shoulder-external', 'Наружная ротация плеча', 'main', 'shoulder', 'behtereva',
 'Укрепляет вращательную манжету, поддерживает правильную осанку.',
 E'1. Прижмите локти к бокам, предплечья вперёд.\n2. Разведите предплечья наружу, сводя лопатки.\n3. Задержитесь 2 секунды, вернитесь.\n4. С резинкой — при отсутствии боли.',
 NULL, 14, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('main-scapula-squeeze', 'Сведение лопаток', 'main', 'shoulder', 'behtereva',
 'Активирует межлопаточные мышцы, которые ослабевают при сутулости.',
 E'1. Сядьте или встаньте прямо, руки вдоль тела.\n2. Сведите лопатки, как будто держите между ними карандаш.\n3. Удержание 5 секунд, расслабление.\n4. Плечи не поднимаются к ушам.',
 NULL, 12, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-arm-circles', 'Круги прямыми руками', 'main', 'shoulder', 'behtereva',
 'Прорабатывает полную амплитуду плечевого сустава.',
 E'1. Разведите прямые руки в стороны на уровне плеч.\n2. Небольшие круги вперёд 15 раз, назад 15 раз.\n3. При усталости опустите руки и продолжите после паузы.',
 NULL, 30, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('main-chest-opener-doorway', 'Раскрытие груди в дверном проёме', 'main', 'shoulder', 'behtereva',
 'Растягивает грудные мышцы, которые тянут плечи вперёд.',
 E'1. Встаньте в дверной проём, предплечья на косяках, локти на уровне плеч.\n2. Сделайте небольшой шаг вперёд до натяжения в груди.\n3. Держите 30 секунд, дышите ровно.\n4. Не прогибайтесь в пояснице.',
 60, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

-- Ноги и таз (5)
('main-hip-flexor-stretch', 'Растяжка подвздошно-поясничной', 'main', 'hips', 'behtereva',
 'Укороченные сгибатели бедра усиливают наклон корпуса вперёд.',
 E'1. Встаньте в выпад: одно колено на полу, второе впереди под 90 градусов.\n2. Подкрутите таз под себя, ягодицу задней ноги напрягите.\n3. Мягко подайтесь вперёд до натяжения спереди бедра.\n4. 30 секунд на сторону.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('main-hip-abduction', 'Отведение ноги лёжа на боку', 'main', 'hips', 'behtereva',
 'Укрепляет средние ягодичные — стабилизаторы таза при ходьбе.',
 E'1. Лягте на бок, нижняя нога согнута для устойчивости.\n2. Поднимите верхнюю прямую ногу на 30-40 см.\n3. Опускайте медленно, не роняя.\n4. По 12 раз на сторону.',
 NULL, 24, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-mini-squat', 'Неглубокий присед у опоры', 'main', 'legs', 'behtereva',
 'Поддерживает силу ног без осевой нагрузки на позвоночник.',
 E'1. Держитесь за спинку стула.\n2. Присядьте на 30-40 градусов, колени по направлению стоп.\n3. Спина прямая, вес на пятках.\n4. Вернитесь, не выпрямляя колени до упора.',
 NULL, 12, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('main-heel-raises', 'Подъёмы на носки', 'main', 'legs', 'behtereva',
 'Улучшает кровообращение в голенях и укрепляет стопу.',
 E'1. Встаньте у опоры, стопы на ширине таза.\n2. Поднимитесь на носки, задержитесь 2 секунды.\n3. Медленно опуститесь.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('main-hamstring-stretch', 'Растяжка задней поверхности бедра', 'main', 'legs', 'behtereva',
 'Освобождает таз — укороченные мышцы задней поверхности тянут его назад.',
 E'1. Лягте на спину, одну ногу поднимите вверх.\n2. Обхватите бедро руками или используйте ремень.\n3. Тяните ногу к себе прямой до натяжения, 30 секунд.\n4. Вторая нога остаётся на полу.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

-- Растяжка и завершение (4)
('stretch-child-pose', 'Поза ребёнка', 'stretch', 'spine', 'behtereva',
 'Мягко вытягивает поясницу после основной части.',
 E'1. Сядьте на пятки, колени разведите.\n2. Наклонитесь вперёд, вытяните руки.\n3. Лоб на полу или на подушке.\n4. Дышите в спину 60 секунд.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('stretch-supine-twist', 'Скручивание лёжа', 'stretch', 'spine', 'behtereva',
 'Ротационная растяжка позвоночника в разгруженном положении.',
 E'1. Лягте на спину, руки в стороны.\n2. Согните колени и мягко опустите их вправо.\n3. Голову поверните влево.\n4. 30 секунд, затем в другую сторону.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('stretch-piriformis', 'Растяжка грушевидной мышцы', 'stretch', 'hips', 'behtereva',
 'Снимает напряжение в глубине ягодицы, частое при Бехтерева.',
 E'1. Лягте на спину, положите щиколотку правой ноги на левое колено.\n2. Обхватите левое бедро и подтяните к себе.\n3. 30 секунд на сторону, без рывков.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('stretch-full-body', 'Вытяжение всего тела', 'stretch', 'full_body', 'behtereva',
 'Финальное вытяжение, закрепляет ощущение роста в длину.',
 E'1. Лягте на спину, руки за голову.\n2. Потянитесь руками вверх, стопами вниз.\n3. Держите 10 секунд, расслабьтесь. Повторите 3 раза.',
 45, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ: режим «Общая форма» (15)
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects) VALUES

('gen-jumping-jacks', 'Прыжки со сменой рук и ног', 'warmup', 'full_body', 'general',
 'Быстро поднимает пульс и разогревает всё тело.',
 E'1. Встаньте прямо, руки вдоль тела.\n2. В прыжке разведите ноги и поднимите руки над головой.\n3. Вторым прыжком вернитесь в исходное.\n4. Приземляйтесь мягко на носок.',
 NULL, 30, 'beginner', '["knee_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('gen-arm-swings', 'Махи руками', 'warmup', 'shoulder', 'general',
 'Разогревает плечевой пояс перед силовой частью.',
 E'1. Встаньте прямо, руки в стороны.\n2. Скрестите руки перед грудью, затем разведите назад.\n3. Темп средний, без рывков.',
 NULL, 20, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-squat', 'Приседания', 'main', 'legs', 'general',
 'Базовое упражнение на ноги и ягодицы.',
 E'1. Стопы на ширине плеч, носки чуть наружу.\n2. Отведите таз назад и присядьте до параллели бёдер с полом.\n3. Колени идут по направлению носков.\n4. Спина прямая, пятки на полу.',
 NULL, 15, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-lunges', 'Выпады', 'main', 'legs', 'general',
 'Нагружает ноги по одной, развивает равновесие.',
 E'1. Сделайте шаг вперёд.\n2. Опуститесь, пока оба колена не согнутся под 90 градусов.\n3. Переднее колено не выходит за носок.\n4. Оттолкнитесь передней ногой и вернитесь.',
 NULL, 20, 'intermediate', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-pushup', 'Отжимания', 'main', 'shoulder', 'general',
 'Базовое упражнение на грудь, плечи и трицепс.',
 E'1. Упор лёжа, ладони чуть шире плеч.\n2. Корпус прямой от пяток до макушки.\n3. Опуститесь до угла 90 градусов в локтях.\n4. Новичкам — с колен или от опоры.',
 NULL, 12, 'intermediate', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('gen-plank', 'Планка', 'main', 'core', 'general',
 'Статическая нагрузка на весь корпус.',
 E'1. Упор на предплечья и носки.\n2. Тело в одну линию, таз не проваливается и не задирается.\n3. Живот подтянут, дыхание ровное.\n4. Держите заданное время.',
 45, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-side-plank', 'Боковая планка', 'main', 'core', 'general',
 'Прорабатывает косые мышцы живота.',
 E'1. Лягте на бок, упор на предплечье под плечом.\n2. Поднимите таз, тело в одну линию.\n3. Удержание по 30 секунд на сторону.',
 60, NULL, 'intermediate', '["shoulder_pain"]'::jsonb, '[]'::jsonb),

('gen-crunch', 'Скручивания на пресс', 'main', 'core', 'general',
 'Прорабатывает прямую мышцу живота.',
 E'1. Лягте на спину, колени согнуты, руки у висков.\n2. На выдохе оторвите лопатки от пола.\n3. Поясница прижата, шея не тянется руками.\n4. Медленно опуститесь.',
 NULL, 20, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('gen-superman', 'Лодочка', 'main', 'spine', 'general',
 'Укрепляет мышцы-разгибатели спины.',
 E'1. Лягте на живот, руки вытянуты вперёд.\n2. Одновременно поднимите руки, грудь и ноги.\n3. Задержитесь 3 секунды и опуститесь.',
 NULL, 12, 'intermediate', '["acute_back_pain"]'::jsonb, '[]'::jsonb),

('gen-glute-bridge', 'Ягодичный мостик (общий)', 'main', 'hips', 'general',
 'Основное упражнение на ягодицы.',
 E'1. Лягте на спину, колени согнуты, стопы на ширине таза.\n2. На выдохе поднимите таз до прямой линии колени-таз-плечи.\n3. Сожмите ягодицы вверху на 2 секунды.\n4. Опуститесь, не касаясь пола до конца.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-row-band', 'Тяга резинки к поясу', 'main', 'shoulder', 'general',
 'Прорабатывает широчайшие и середину спины.',
 E'1. Закрепите резинку на уровне пояса, возьмите концы.\n2. Тяните локти назад, сводя лопатки.\n3. Плечи опущены, корпус неподвижен.\n4. Медленно вернитесь.',
 NULL, 15, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-mountain-climbers', 'Скалолаз', 'main', 'full_body', 'general',
 'Кардио и нагрузка на корпус одновременно.',
 E'1. Упор лёжа, корпус прямой.\n2. Поочерёдно подтягивайте колени к груди в темпе.\n3. Таз не задирайте.',
 40, NULL, 'intermediate', '["knee_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb),

('gen-step-touch', 'Приставные шаги', 'main', 'full_body', 'general',
 'Лёгкое кардио для дней с низкой интенсивностью.',
 E'1. Шаг вправо, приставьте левую ногу.\n2. Шаг влево, приставьте правую.\n3. Добавьте движения руками.\n4. Держите ровный темп.',
 60, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb),

('gen-stretch-quads', 'Растяжка передней поверхности бедра', 'stretch', 'legs', 'general',
 'Восстановление после нагрузки на ноги.',
 E'1. Стоя у опоры, согните ногу и возьмите стопу рукой.\n2. Подтяните пятку к ягодице, колени рядом.\n3. 30 секунд на сторону.',
 60, NULL, 'beginner', '["knee_pain"]'::jsonb, '[]'::jsonb),

('gen-stretch-full', 'Общая растяжка', 'stretch', 'full_body', 'general',
 'Завершает тренировку и снижает крепатуру.',
 E'1. Наклон вперёд к прямым ногам — 30 секунд.\n2. Растяжка груди в проёме — 30 секунд.\n3. Скручивание лёжа — по 30 секунд на сторону.',
 120, NULL, 'beginner', '[]'::jsonb, '[]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- DECISION TREE: правила реакции на побочки (SPEC 5.2)
-- Правило с меньшим priority выигрывает среди подходящих по conditions.
-- ---------------------------------------------------------------------------

INSERT INTO side_effect_rules (symptom, conditions, advice, next_workout_adjustment, skip_exercise, require_doctor_visit_threshold, priority) VALUES

('pressure_up', '{}'::jsonb,
 '[{"order":1,"text":"Прерви тренировку на 5 минут."},
   {"order":2,"text":"Сядь с приподнятой головой, не ложись плашмя."},
   {"order":3,"text":"Измерь давление, если есть тонометр."},
   {"order":4,"text":"Пей воду мелкими глотками."},
   {"order":5,"text":"Если через 15 минут не легчает — заканчивай занятие."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('pressure_up', '{"exercise_type":"breathing"}'::jsonb,
 '[{"order":1,"text":"Убери задержки дыхания — оставь только вдох и выдох."},
   {"order":2,"text":"Дыши в обычном ритме 2 минуты."},
   {"order":3,"text":"Продолжай, только если стало легче."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 5),

('headache', '{}'::jsonb,
 '[{"order":1,"text":"Отдохни 3 минуты."},
   {"order":2,"text":"Проверь осанку: плечи опущены, шея не запрокинута."},
   {"order":3,"text":"Самомассаж основания черепа (точка GB20) — 1 минута."},
   {"order":4,"text":"Пей воду."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('headache', '{"target_joint":"neck"}'::jsonb,
 '[{"order":1,"text":"Останови упражнения на шею на сегодня."},
   {"order":2,"text":"Уменьши амплитуду поворотов вдвое в следующий раз."},
   {"order":3,"text":"Самомассаж основания черепа — 1 минута."}]'::jsonb,
 'skip_joint', TRUE, 3, 5),

('cramp', '{}'::jsonb,
 '[{"order":1,"text":"Прерви упражнение."},
   {"order":2,"text":"Медленно растяни сведённую мышцу и держи 30 секунд."},
   {"order":3,"text":"Пей воду, лучше с электролитами."},
   {"order":4,"text":"Проверь технику — судорога часто от перенапряжения."}]'::jsonb,
 'lighter_only', FALSE, 3, 10),

('cramp', '{"target_joint":"legs"}'::jsonb,
 '[{"order":1,"text":"Потяни икру: носок на себя, нога прямая, 30 секунд."},
   {"order":2,"text":"Разотри мышцу ладонью снизу вверх."},
   {"order":3,"text":"Следующую тренировку начни с более длинной разминки."}]'::jsonb,
 'lighter_only', FALSE, 3, 5),

('joint_pain', '{}'::jsonb,
 '[{"order":1,"text":"Останови это упражнение."},
   {"order":2,"text":"Острая боль — это сигнал стоп, а не повод потерпеть."},
   {"order":3,"text":"Мы исключим его из следующей тренировки."},
   {"order":4,"text":"Если боль держится дольше суток — покажись врачу."}]'::jsonb,
 'skip_exercise', TRUE, 2, 10),

('joint_pain', '{"target_joint":"shoulder"}'::jsonb,
 '[{"order":1,"text":"Останови упражнение и опусти руки."},
   {"order":2,"text":"Плечо не любит работу через боль."},
   {"order":3,"text":"Следующую тренировку проведём без нагрузки на плечи."}]'::jsonb,
 'skip_joint', TRUE, 2, 5),

('joint_pain', '{"target_joint":"spine"}'::jsonb,
 '[{"order":1,"text":"Останови упражнение, ляг на спину с согнутыми коленями."},
   {"order":2,"text":"Полежи 2 минуты, дыши в живот."},
   {"order":3,"text":"Следующая тренировка будет мягче."}]'::jsonb,
 'reduce_intensity_20', TRUE, 2, 5),

('nausea', '{}'::jsonb,
 '[{"order":1,"text":"Останови тренировку."},
   {"order":2,"text":"Отдохни 15 минут, дыши медленно и ровно."},
   {"order":3,"text":"Проветри комнату."},
   {"order":4,"text":"Если не проходит — обратись к врачу."}]'::jsonb,
 'lighter_only', FALSE, 2, 10),

('dizziness', '{}'::jsonb,
 '[{"order":1,"text":"Сядь или ляг, не вставай резко."},
   {"order":2,"text":"Подыши ровно 2 минуты без задержек."},
   {"order":3,"text":"Выпей воды."},
   {"order":4,"text":"Продолжай только если полностью прошло."}]'::jsonb,
 'reduce_intensity_20', FALSE, 3, 10),

('dizziness', '{"exercise_type":"breathing"}'::jsonb,
 '[{"order":1,"text":"Это частая реакция на непривычное дыхание."},
   {"order":2,"text":"Вернись к обычному ритму, убери задержки и счёт."},
   {"order":3,"text":"В следующий раз сократи дыхательный блок вдвое."}]'::jsonb,
 'reduce_intensity_10', FALSE, 4, 5),

('just_hard', '{}'::jsonb,
 '[{"order":1,"text":"Нормально, если тяжело — значит работаешь."},
   {"order":2,"text":"Снизим нагрузку в следующий раз."},
   {"order":3,"text":"Отдохни 60 секунд и продолжай в своём темпе."}]'::jsonb,
 'reduce_intensity_10', FALSE, 99, 10),

('just_hard', '{"exercise_type":"main"}'::jsonb,
 '[{"order":1,"text":"Сделай меньше повторов, но с правильной техникой."},
   {"order":2,"text":"Качество важнее количества."},
   {"order":3,"text":"В следующий раз начнём с меньшего объёма."}]'::jsonb,
 'reduce_intensity_10', FALSE, 99, 5),

('other', '{}'::jsonb,
 '[{"order":1,"text":"Прерви занятие и оцени самочувствие."},
   {"order":2,"text":"Если что-то ощущается неправильно — останови тренировку."},
   {"order":3,"text":"Опиши симптом в заметке, это поможет в отчёте."}]'::jsonb,
 'reduce_intensity_10', FALSE, 3, 10);

-- ---------------------------------------------------------------------------
-- ШАБЛОНЫ ПОСЛЕДОВАТЕЛЬНОСТЕЙ: 7 дней × 2 режима (SPEC 5.4)
-- exercises_order ссылается на exercises.slug — стабильно между окружениями.
-- Поле intensity здесь базовое; генератор подгоняет его под диагностику
-- пользователя, поэтому строка на день недели одна (SPEC 3.3).
-- Структура дня Бехтерева: дыхание → разминка и массаж → основное → растяжка.
-- ---------------------------------------------------------------------------

INSERT INTO workout_sequences (slug, mode, day_of_week, focus_joint, intensity, total_duration_min, exercises_order) VALUES

('beh-mon-spine', 'behtereva', 1, 'spine', 'normal', 45, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-neck-turns","repetitions":10},
  {"order":3,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":4,"slug":"massage-paravertebral","duration_sec":90},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-thoracic-rotation","repetitions":16},
  {"order":7,"slug":"main-side-bend-standing","repetitions":12},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"main-prone-extension","repetitions":8},
  {"order":10,"slug":"main-bird-dog","repetitions":12},
  {"order":11,"slug":"stretch-child-pose","duration_sec":60},
  {"order":12,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":13,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-tue-shoulders', 'behtereva', 2, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"breath-chest-expand","duration_sec":180},
  {"order":2,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":3,"slug":"warmup-neck-tilts","repetitions":6},
  {"order":4,"slug":"massage-suboccipital","duration_sec":60},
  {"order":5,"slug":"main-shoulder-wall-slide","repetitions":10},
  {"order":6,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":7,"slug":"main-shoulder-external","repetitions":14},
  {"order":8,"slug":"main-arm-circles","repetitions":30},
  {"order":9,"slug":"main-wall-posture","duration_sec":30},
  {"order":10,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":11,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":12,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-wed-thoracic', 'behtereva', 3, 'spine_thoracic', 'normal', 40, '[
  {"order":1,"slug":"breath-chest-expand","duration_sec":180},
  {"order":2,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":3,"slug":"massage-paravertebral","duration_sec":90},
  {"order":4,"slug":"main-cat-cow","repetitions":12},
  {"order":5,"slug":"main-thoracic-rotation","repetitions":16},
  {"order":6,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":7,"slug":"main-swimmer","repetitions":16},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"stretch-child-pose","duration_sec":60},
  {"order":10,"slug":"stretch-full-body","duration_sec":45},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-thu-legs-hips', 'behtereva', 4, 'hips', 'normal', 40, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":3,"slug":"massage-glutes-ball","duration_sec":120},
  {"order":4,"slug":"main-bridge","repetitions":12},
  {"order":5,"slug":"main-hip-abduction","repetitions":24},
  {"order":6,"slug":"main-mini-squat","repetitions":12},
  {"order":7,"slug":"main-heel-raises","repetitions":15},
  {"order":8,"slug":"main-hip-flexor-stretch","duration_sec":60},
  {"order":9,"slug":"main-hamstring-stretch","duration_sec":60},
  {"order":10,"slug":"stretch-piriformis","duration_sec":60},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-fri-lumbar', 'behtereva', 5, 'spine_lumbar', 'normal', 40, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":3,"slug":"massage-paravertebral","duration_sec":90},
  {"order":4,"slug":"main-knee-to-chest","duration_sec":60},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-dead-bug","repetitions":12},
  {"order":7,"slug":"main-bridge","repetitions":12},
  {"order":8,"slug":"main-prone-extension","repetitions":8},
  {"order":9,"slug":"stretch-piriformis","duration_sec":60},
  {"order":10,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-sat-combined', 'behtereva', 6, 'full_body', 'low', 35, '[
  {"order":1,"slug":"breath-square","duration_sec":120},
  {"order":2,"slug":"warmup-neck-turns","repetitions":10},
  {"order":3,"slug":"warmup-shoulder-rolls","repetitions":20},
  {"order":4,"slug":"warmup-pelvic-tilt","repetitions":12},
  {"order":5,"slug":"main-cat-cow","repetitions":12},
  {"order":6,"slug":"main-side-bend-standing","repetitions":12},
  {"order":7,"slug":"main-bridge","repetitions":12},
  {"order":8,"slug":"main-wall-posture","duration_sec":30},
  {"order":9,"slug":"stretch-child-pose","duration_sec":60},
  {"order":10,"slug":"stretch-full-body","duration_sec":45},
  {"order":11,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('beh-sun-rest', 'behtereva', 7, 'breathing', 'low', 12, '[
  {"order":1,"slug":"breath-diaphragm","duration_sec":180},
  {"order":2,"slug":"breath-chest-expand","duration_sec":180},
  {"order":3,"slug":"main-knee-to-chest","duration_sec":60},
  {"order":4,"slug":"stretch-full-body","duration_sec":45},
  {"order":5,"slug":"breath-cooldown","duration_sec":180}
]'::jsonb),

('gen-mon-legs', 'general', 1, 'legs', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-squat","repetitions":15},
  {"order":4,"slug":"gen-lunges","repetitions":20},
  {"order":5,"slug":"gen-glute-bridge","repetitions":15},
  {"order":6,"slug":"main-heel-raises","repetitions":15},
  {"order":7,"slug":"gen-stretch-quads","duration_sec":60},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-tue-back', 'general', 2, 'spine', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-row-band","repetitions":15},
  {"order":4,"slug":"gen-superman","repetitions":12},
  {"order":5,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"stretch-child-pose","duration_sec":60},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-wed-chest', 'general', 3, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-arm-swings","repetitions":20},
  {"order":3,"slug":"gen-pushup","repetitions":12},
  {"order":4,"slug":"main-chest-opener-doorway","duration_sec":60},
  {"order":5,"slug":"main-shoulder-external","repetitions":14},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-thu-cardio-core', 'general', 4, 'core', 'normal', 35, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-mountain-climbers","duration_sec":40},
  {"order":3,"slug":"gen-crunch","repetitions":20},
  {"order":4,"slug":"gen-side-plank","duration_sec":60},
  {"order":5,"slug":"gen-plank","duration_sec":45},
  {"order":6,"slug":"main-dead-bug","repetitions":12},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-fri-shoulders', 'general', 5, 'shoulder', 'normal', 40, '[
  {"order":1,"slug":"gen-arm-swings","repetitions":20},
  {"order":2,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":3,"slug":"main-arm-circles","repetitions":30},
  {"order":4,"slug":"gen-row-band","repetitions":15},
  {"order":5,"slug":"main-shoulder-external","repetitions":14},
  {"order":6,"slug":"main-scapula-squeeze","repetitions":12},
  {"order":7,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-sat-full', 'general', 6, 'full_body', 'normal', 45, '[
  {"order":1,"slug":"gen-jumping-jacks","repetitions":30},
  {"order":2,"slug":"gen-squat","repetitions":15},
  {"order":3,"slug":"gen-pushup","repetitions":12},
  {"order":4,"slug":"gen-row-band","repetitions":15},
  {"order":5,"slug":"gen-mountain-climbers","duration_sec":40},
  {"order":6,"slug":"gen-plank","duration_sec":45},
  {"order":7,"slug":"gen-glute-bridge","repetitions":15},
  {"order":8,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb),

('gen-sun-rest', 'general', 7, 'stretch', 'low', 20, '[
  {"order":1,"slug":"gen-step-touch","duration_sec":60},
  {"order":2,"slug":"gen-stretch-quads","duration_sec":60},
  {"order":3,"slug":"main-hamstring-stretch","duration_sec":60},
  {"order":4,"slug":"stretch-piriformis","duration_sec":60},
  {"order":5,"slug":"stretch-supine-twist","duration_sec":60},
  {"order":6,"slug":"gen-stretch-full","duration_sec":120}
]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- БЛЮДА (40): 10 завтраков, 12 обедов, 10 ужинов, 8 полдников.
-- Только продукты из топ-30 (SPEC 5.3). КБЖУ — на порцию.
-- ---------------------------------------------------------------------------

INSERT INTO meals (slug, name, meal_type, ingredients, total_kcal, total_protein_g, total_fat_g, total_carbs_g, cook_time_min, recipe, contraindications) VALUES

-- ЗАВТРАКИ (10)
('br-oatmeal-banana', 'Овсянка на молоке с бананом', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Молоко 1.5%","grams":200,"kcal":90},{"product":"Банан","grams":100,"kcal":89}]'::jsonb,
 407, 15.0, 8.0, 68.0, 10,
 E'1. Залейте 60 г овсянки 200 мл молока.\n2. Варите на среднем огне 5-7 минут, помешивая.\n3. Снимите с огня, дайте постоять 2 минуты.\n4. Добавьте нарезанный банан.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-cottage-cheese-apple', 'Творог с яблоком и орехами', 'breakfast',
 '[{"product":"Творог 5%","grams":200,"kcal":242},{"product":"Яблоко","grams":150,"kcal":71},{"product":"Орехи","grams":15,"kcal":98}]'::jsonb,
 411, 36.0, 17.0, 29.0, 5,
 E'1. Выложите 200 г творога в тарелку.\n2. Нарежьте яблоко кубиками и добавьте к творогу.\n3. Измельчите орехи и посыпьте сверху.\n4. Перемешайте.',
 '["lactose_intolerance","nut_allergy"]'::jsonb),

('br-scrambled-eggs-veg', 'Яичница с помидорами и шпинатом', 'breakfast',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Шпинат","grams":50,"kcal":12},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 308, 21.0, 22.0, 6.0, 10,
 E'1. Разогрейте сковороду с чайной ложкой масла.\n2. Обжарьте нарезанные помидоры 2 минуты.\n3. Добавьте шпинат, потомите 1 минуту.\n4. Влейте взбитые яйца и готовьте на слабом огне до схватывания.',
 '["egg_allergy"]'::jsonb),

('br-buckwheat-egg', 'Гречка с яйцом', 'breakfast',
 '[{"product":"Гречка","grams":70,"kcal":218},{"product":"Яйца","grams":100,"kcal":155},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 418, 21.0, 16.0, 47.0, 20,
 E'1. Промойте 70 г гречки, залейте 150 мл воды.\n2. Доведите до кипения и варите под крышкой 15 минут.\n3. Отварите или пожарьте 2 яйца.\n4. Подавайте вместе, сбрызнув маслом.',
 '["egg_allergy"]'::jsonb),

('br-cottage-pancakes', 'Сырники из творога', 'breakfast',
 '[{"product":"Творог 5%","grams":200,"kcal":242},{"product":"Яйца","grams":50,"kcal":78},{"product":"Овсянка","grams":30,"kcal":114},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 479, 38.0, 20.0, 34.0, 20,
 E'1. Измельчите овсянку в муку.\n2. Смешайте творог, яйцо и овсяную муку до однородности.\n3. Сформируйте сырники.\n4. Обжарьте на слабом огне по 3-4 минуты с каждой стороны под крышкой.',
 '["lactose_intolerance","egg_allergy","gluten_intolerance"]'::jsonb),

('br-oatmeal-berries', 'Овсянка с ягодами', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Молоко 1.5%","grams":150,"kcal":68},{"product":"Сезонные ягоды","grams":100,"kcal":45}]'::jsonb,
 341, 13.0, 7.0, 57.0, 10,
 E'1. Сварите овсянку на молоке 5-7 минут.\n2. Дайте постоять 2 минуты под крышкой.\n3. Добавьте ягоды перед подачей, не варите их.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-omelet-cheese-veg', 'Омлет с овощами', 'breakfast',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Молоко 1.5%","grams":50,"kcal":23},{"product":"Кабачки","grams":100,"kcal":24},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 325, 21.0, 22.0, 8.0, 15,
 E'1. Нарежьте кабачок тонкими ломтиками и обжарьте 4 минуты.\n2. Взбейте яйца с молоком.\n3. Залейте овощи яичной смесью.\n4. Готовьте под крышкой на слабом огне 6-8 минут.',
 '["egg_allergy","lactose_intolerance"]'::jsonb),

('br-rice-milk-porridge', 'Рисовая каша на молоке', 'breakfast',
 '[{"product":"Рис белый","grams":70,"kcal":242},{"product":"Молоко 1.5%","grams":200,"kcal":90},{"product":"Яблоко","grams":100,"kcal":47}]'::jsonb,
 379, 12.0, 6.0, 71.0, 25,
 E'1. Промойте рис, залейте 100 мл воды и варите 10 минут.\n2. Влейте молоко и варите ещё 10 минут, помешивая.\n3. Добавьте тёртое яблоко и дайте настояться 3 минуты.',
 '["lactose_intolerance"]'::jsonb),

('br-kefir-oat-jar', 'Овсянка на кефире (с вечера)', 'breakfast',
 '[{"product":"Овсянка","grams":60,"kcal":228},{"product":"Кефир 1%","grams":200,"kcal":80},{"product":"Груша","grams":120,"kcal":68}]'::jsonb,
 376, 16.0, 7.0, 64.0, 5,
 E'1. Вечером засыпьте овсянку в банку и залейте кефиром.\n2. Уберите в холодильник на ночь.\n3. Утром добавьте нарезанную грушу и перемешайте.',
 '["gluten_intolerance","lactose_intolerance"]'::jsonb),

('br-eggs-toast-veg', 'Яйца всмятку с овощным салатом', 'breakfast',
 '[{"product":"Яйца","grams":100,"kcal":155},{"product":"Огурцы","grams":100,"kcal":15},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 278, 14.0, 21.0, 7.0, 10,
 E'1. Опустите яйца в кипящую воду на 5 минут.\n2. Нарежьте огурцы и помидоры крупно.\n3. Заправьте салат маслом.\n4. Подавайте вместе.',
 '["egg_allergy"]'::jsonb),

-- ОБЕДЫ (12)
('ln-chicken-buckwheat', 'Куриная грудка с гречкой и овощами', 'lunch',
 '[{"product":"Куриная грудка","grams":180,"kcal":297},{"product":"Гречка","grams":80,"kcal":249},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 687, 55.0, 18.0, 62.0, 30,
 E'1. Отварите гречку 15 минут в 160 мл воды.\n2. Нарежьте грудку и обжарьте на среднем огне 8-10 минут.\n3. Брокколи отварите или приготовьте на пару 5 минут.\n4. Соберите тарелку, сбрызните маслом.',
 '[]'::jsonb),

('ln-beef-rice-veg', 'Говядина с бурым рисом', 'lunch',
 '[{"product":"Говядина постная","grams":160,"kcal":250},{"product":"Рис бурый","grams":80,"kcal":278},{"product":"Морковь","grams":100,"kcal":35},{"product":"Лук","grams":50,"kcal":20}]'::jsonb,
 583, 46.0, 14.0, 65.0, 45,
 E'1. Залейте бурый рис 180 мл воды и варите 30 минут.\n2. Нарежьте говядину полосками, обжарьте 5 минут.\n3. Добавьте лук и морковь, тушите под крышкой 15 минут.\n4. Подавайте с рисом.',
 '[]'::jsonb),

('ln-cod-potato', 'Треска с картофелем и овощами', 'lunch',
 '[{"product":"Треска","grams":200,"kcal":164},{"product":"Картофель","grams":200,"kcal":154},{"product":"Капуста цветная","grams":150,"kcal":38},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 446, 42.0, 12.0, 41.0, 35,
 E'1. Отварите картофель 20 минут.\n2. Цветную капусту приготовьте на пару 7 минут.\n3. Треску запекайте при 180 градусах 15 минут.\n4. Сбрызните маслом перед подачей.',
 '["fish_allergy"]'::jsonb),

('ln-turkey-pasta', 'Индейка с цельнозерновыми макаронами', 'lunch',
 '[{"product":"Индейка","grams":180,"kcal":250},{"product":"Макароны цельнозерновые","grams":80,"kcal":275},{"product":"Помидоры","grams":150,"kcal":27},{"product":"Чеснок","grams":5,"kcal":7}]'::jsonb,
 559, 50.0, 10.0, 62.0, 25,
 E'1. Отварите макароны согласно упаковке.\n2. Нарежьте индейку и обжарьте 8 минут.\n3. Добавьте помидоры и чеснок, тушите 7 минут.\n4. Смешайте с макаронами.',
 '["gluten_intolerance"]'::jsonb),

('ln-lentil-soup', 'Суп из чечевицы с овощами', 'lunch',
 '[{"product":"Чечевица","grams":100,"kcal":353},{"product":"Морковь","grams":80,"kcal":28},{"product":"Лук","grams":50,"kcal":20},{"product":"Картофель","grams":100,"kcal":77},{"product":"Подсолнечное масло","grams":10,"kcal":90}]'::jsonb,
 568, 28.0, 13.0, 84.0, 40,
 E'1. Промойте чечевицу, залейте 800 мл воды, варите 20 минут.\n2. Обжарьте лук и морковь 5 минут.\n3. Добавьте зажарку и картофель в кастрюлю.\n4. Варите ещё 15 минут до мягкости.',
 '[]'::jsonb),

('ln-chicken-thigh-rice', 'Куриное бедро с рисом', 'lunch',
 '[{"product":"Куриное бедро","grams":180,"kcal":387},{"product":"Рис белый","grams":80,"kcal":277},{"product":"Кабачки","grams":150,"kcal":36}]'::jsonb,
 700, 42.0, 24.0, 68.0, 35,
 E'1. Отварите рис 12 минут.\n2. Запекайте бедро при 190 градусах 25 минут.\n3. Кабачки обжарьте 6 минут.\n4. Соберите тарелку.',
 '[]'::jsonb),

('ln-hake-buckwheat', 'Хек с гречкой', 'lunch',
 '[{"product":"Хек","grams":200,"kcal":172},{"product":"Гречка","grams":80,"kcal":249},{"product":"Морковь","grams":100,"kcal":35},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 546, 42.0, 14.0, 57.0, 30,
 E'1. Отварите гречку 15 минут.\n2. Хек потушите с морковью под крышкой 15 минут.\n3. Подавайте вместе, сбрызнув маслом.',
 '["fish_allergy"]'::jsonb),

('ln-beans-veg-stew', 'Фасоль тушёная с овощами', 'lunch',
 '[{"product":"Фасоль","grams":120,"kcal":396},{"product":"Помидоры","grams":150,"kcal":27},{"product":"Лук","grams":50,"kcal":20},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 533, 27.0, 13.0, 75.0, 40,
 E'1. Замочите фасоль на ночь, отварите 40 минут.\n2. Обжарьте лук 4 минуты, добавьте помидоры.\n3. Соедините с фасолью и тушите 10 минут.',
 '[]'::jsonb),

('ln-chicken-potato-bake', 'Курица с картофелем в духовке', 'lunch',
 '[{"product":"Куриная грудка","grams":180,"kcal":297},{"product":"Картофель","grams":200,"kcal":154},{"product":"Лук","grams":50,"kcal":20},{"product":"Подсолнечное масло","grams":10,"kcal":90}]'::jsonb,
 561, 43.0, 15.0, 44.0, 45,
 E'1. Нарежьте картофель дольками, лук кольцами.\n2. Выложите в форму вместе с грудкой, сбрызните маслом.\n3. Запекайте при 190 градусах 35 минут.',
 '[]'::jsonb),

('ln-pollock-veg', 'Минтай с овощным рагу', 'lunch',
 '[{"product":"Минтай","grams":200,"kcal":144},{"product":"Кабачки","grams":150,"kcal":36},{"product":"Морковь","grams":100,"kcal":35},{"product":"Картофель","grams":150,"kcal":116},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 421, 38.0, 12.0, 41.0, 35,
 E'1. Нарежьте овощи кубиком и тушите 20 минут под крышкой.\n2. Минтай выложите сверху на последние 12 минут.\n3. Сбрызните маслом.',
 '["fish_allergy"]'::jsonb),

('ln-turkey-buckwheat', 'Индейка с гречкой и капустой', 'lunch',
 '[{"product":"Индейка","grams":180,"kcal":250},{"product":"Гречка","grams":80,"kcal":249},{"product":"Капуста белокочанная","grams":150,"kcal":41}]'::jsonb,
 540, 51.0, 9.0, 62.0, 30,
 E'1. Отварите гречку 15 минут.\n2. Индейку обжарьте 8 минут.\n3. Капусту потушите 12 минут.\n4. Подавайте вместе.',
 '[]'::jsonb),

('ln-chicken-pasta-broccoli', 'Курица с макаронами и брокколи', 'lunch',
 '[{"product":"Куриная грудка","grams":160,"kcal":264},{"product":"Макароны цельнозерновые","grams":80,"kcal":275},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Чеснок","grams":5,"kcal":7}]'::jsonb,
 597, 48.0, 8.0, 66.0, 25,
 E'1. Отварите макароны.\n2. За 4 минуты до готовности добавьте брокколи в ту же воду.\n3. Обжарьте грудку с чесноком 8 минут.\n4. Смешайте всё.',
 '["gluten_intolerance"]'::jsonb),

-- УЖИНЫ (10)
('dn-chicken-salad', 'Куриная грудка с овощным салатом', 'dinner',
 '[{"product":"Куриная грудка","grams":150,"kcal":248},{"product":"Огурцы","grams":100,"kcal":15},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 371, 34.0, 14.0, 7.0, 20,
 E'1. Отварите или запеките грудку 18 минут.\n2. Нарежьте овощи крупно.\n3. Заправьте салат маслом.\n4. Подавайте тёплым.',
 '[]'::jsonb),

('dn-cod-veg', 'Треска на пару с овощами', 'dinner',
 '[{"product":"Треска","grams":200,"kcal":164},{"product":"Брокколи","grams":150,"kcal":51},{"product":"Морковь","grams":80,"kcal":28},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 288, 40.0, 8.0, 14.0, 20,
 E'1. Выложите рыбу и овощи в пароварку.\n2. Готовьте 15 минут.\n3. Сбрызните маслом перед подачей.',
 '["fish_allergy"]'::jsonb),

('dn-cottage-veg', 'Творог с овощами и зеленью', 'dinner',
 '[{"product":"Творог 0%","grams":200,"kcal":142},{"product":"Огурцы","grams":150,"kcal":23},{"product":"Помидоры","grams":100,"kcal":18}]'::jsonb,
 183, 34.0, 1.0, 10.0, 5,
 E'1. Нарежьте овощи мелким кубиком.\n2. Смешайте с творогом.\n3. Посолите по вкусу и подавайте.',
 '["lactose_intolerance"]'::jsonb),

('dn-omelet-spinach', 'Омлет со шпинатом', 'dinner',
 '[{"product":"Яйца","grams":150,"kcal":233},{"product":"Шпинат","grams":100,"kcal":23},{"product":"Оливковое масло","grams":5,"kcal":45}]'::jsonb,
 301, 21.0, 22.0, 4.0, 12,
 E'1. Потомите шпинат на сковороде 2 минуты.\n2. Взбейте яйца и залейте шпинат.\n3. Готовьте под крышкой 6 минут.',
 '["egg_allergy"]'::jsonb),

('dn-turkey-cabbage', 'Индейка с тушёной капустой', 'dinner',
 '[{"product":"Индейка","grams":160,"kcal":222},{"product":"Капуста белокочанная","grams":200,"kcal":54},{"product":"Лук","grams":50,"kcal":20},{"product":"Подсолнечное масло","grams":5,"kcal":45}]'::jsonb,
 341, 40.0, 11.0, 15.0, 30,
 E'1. Нашинкуйте капусту и лук.\n2. Тушите под крышкой 20 минут.\n3. Индейку обжарьте отдельно 8 минут и добавьте к капусте.',
 '[]'::jsonb),

('dn-hake-salad', 'Хек с салатом из капусты', 'dinner',
 '[{"product":"Хек","grams":200,"kcal":172},{"product":"Капуста белокочанная","grams":150,"kcal":41},{"product":"Морковь","grams":80,"kcal":28},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 331, 36.0, 12.0, 15.0, 20,
 E'1. Запеките хек при 180 градусах 15 минут.\n2. Нашинкуйте капусту с морковью, помните руками.\n3. Заправьте маслом.',
 '["fish_allergy"]'::jsonb),

('dn-eggs-veg-stew', 'Овощное рагу с яйцом', 'dinner',
 '[{"product":"Кабачки","grams":200,"kcal":48},{"product":"Помидоры","grams":100,"kcal":18},{"product":"Яйца","grams":100,"kcal":155},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 311, 16.0, 22.0, 12.0, 25,
 E'1. Тушите кабачки с помидорами 15 минут.\n2. Сделайте углубления и вбейте яйца.\n3. Накройте крышкой и готовьте 6 минут.',
 '["egg_allergy"]'::jsonb),

('dn-pollock-cauliflower', 'Минтай с цветной капустой', 'dinner',
 '[{"product":"Минтай","grams":200,"kcal":144},{"product":"Капуста цветная","grams":200,"kcal":50},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 284, 37.0, 12.0, 10.0, 25,
 E'1. Разберите капусту на соцветия и отварите 7 минут.\n2. Минтай запеките 15 минут при 180 градусах.\n3. Подавайте вместе.',
 '["fish_allergy"]'::jsonb),

('dn-chicken-zucchini', 'Курица с кабачками', 'dinner',
 '[{"product":"Куриная грудка","grams":150,"kcal":248},{"product":"Кабачки","grams":200,"kcal":48},{"product":"Чеснок","grams":5,"kcal":7},{"product":"Оливковое масло","grams":10,"kcal":90}]'::jsonb,
 393, 34.0, 15.0, 11.0, 25,
 E'1. Нарежьте грудку и кабачки кубиком.\n2. Обжарьте грудку 6 минут, добавьте кабачки и чеснок.\n3. Тушите под крышкой ещё 10 минут.',
 '[]'::jsonb),

('dn-kefir-cottage', 'Творог с кефиром на ночь', 'dinner',
 '[{"product":"Творог 0%","grams":150,"kcal":107},{"product":"Кефир 1%","grams":200,"kcal":80},{"product":"Сезонные ягоды","grams":80,"kcal":36}]'::jsonb,
 223, 30.0, 3.0, 21.0, 3,
 E'1. Смешайте творог с кефиром.\n2. Добавьте ягоды.\n3. Ешьте не позже чем за час до сна.',
 '["lactose_intolerance"]'::jsonb),

-- ПОЛДНИКИ (8)
('sn-kefir-apple', 'Кефир с яблоком', 'snack',
 '[{"product":"Кефир 1%","grams":250,"kcal":100},{"product":"Яблоко","grams":150,"kcal":71}]'::jsonb,
 171, 9.0, 3.0, 28.0, 2,
 E'1. Налейте кефир в стакан.\n2. Яблоко съешьте целиком или нарежьте дольками.',
 '["lactose_intolerance"]'::jsonb),

('sn-cottage-berries', 'Творог с ягодами', 'snack',
 '[{"product":"Творог 5%","grams":150,"kcal":182},{"product":"Сезонные ягоды","grams":100,"kcal":45}]'::jsonb,
 227, 25.0, 8.0, 14.0, 3,
 E'1. Выложите творог в тарелку.\n2. Добавьте ягоды и перемешайте.',
 '["lactose_intolerance"]'::jsonb),

('sn-yogurt-nuts', 'Йогурт с орехами', 'snack',
 '[{"product":"Йогурт натуральный","grams":200,"kcal":120},{"product":"Орехи","grams":20,"kcal":131}]'::jsonb,
 251, 12.0, 15.0, 16.0, 2,
 E'1. Измельчите орехи.\n2. Добавьте в йогурт и перемешайте.',
 '["lactose_intolerance","nut_allergy"]'::jsonb),

('sn-boiled-eggs', 'Яйца вкрутую с огурцом', 'snack',
 '[{"product":"Яйца","grams":100,"kcal":155},{"product":"Огурцы","grams":150,"kcal":23}]'::jsonb,
 178, 14.0, 11.0, 4.0, 12,
 E'1. Варите яйца 9 минут после закипания.\n2. Остудите, очистите.\n3. Подавайте с нарезанным огурцом.',
 '["egg_allergy"]'::jsonb),

('sn-banana-nuts', 'Банан с орехами', 'snack',
 '[{"product":"Банан","grams":120,"kcal":107},{"product":"Орехи","grams":20,"kcal":131}]'::jsonb,
 238, 6.0, 13.0, 29.0, 2,
 E'1. Очистите банан.\n2. Ешьте вместе с горстью орехов.',
 '["nut_allergy"]'::jsonb),

('sn-orange-yogurt', 'Апельсин с йогуртом', 'snack',
 '[{"product":"Апельсин","grams":200,"kcal":94},{"product":"Йогурт натуральный","grams":150,"kcal":90}]'::jsonb,
 184, 9.0, 3.0, 30.0, 3,
 E'1. Очистите апельсин и разделите на дольки.\n2. Подавайте с йогуртом.',
 '["lactose_intolerance"]'::jsonb),

('sn-cottage-cucumber', 'Творог с огурцом', 'snack',
 '[{"product":"Творог 0%","grams":150,"kcal":107},{"product":"Огурцы","grams":150,"kcal":23}]'::jsonb,
 130, 26.0, 1.0, 6.0, 3,
 E'1. Нарежьте огурец кубиком.\n2. Смешайте с творогом, посолите по вкусу.',
 '["lactose_intolerance"]'::jsonb),

('sn-pear-kefir', 'Груша с кефиром', 'snack',
 '[{"product":"Груша","grams":180,"kcal":102},{"product":"Кефир 1%","grams":250,"kcal":100}]'::jsonb,
 202, 9.0, 3.0, 35.0, 2,
 E'1. Нарежьте грушу.\n2. Подавайте со стаканом кефира.',
 '["lactose_intolerance"]'::jsonb)

ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- КАРТИНКИ УПРАЖНЕНИЙ (GIMN-010): public/exercises/<slug>.gif.
-- Только там, где движение на картинке совпадает с нашей техникой. Источники
-- и лицензии (public domain / CC0) — docs/IMAGE_SOURCES.md. Остальным
-- карточка показывает знак типа упражнения. Тексты упражнений не трогаем.
-- ---------------------------------------------------------------------------
UPDATE exercises SET gif_url = '/exercises/' || slug || '.gif'
WHERE slug IN (
  'breath-diaphragm',
  'gen-crunch',
  'gen-lunges',
  'gen-squat',
  'gen-stretch-quads',
  'gen-superman',
  'main-heel-raises',
  'warmup-pelvic-tilt'
);
-- ---------------------------------------------------------------------------
-- ЩАДЯЩИЕ УПРАЖНЕНИЯ (GIMN-011): микроамплитуда и изометрика — напряжение
-- без движения. Их получают зоны с ограниченной подвижностью по углублённой
-- диагностике: ограничение — повод мягко развивать, а не убирать зону.
-- Составлено по общим принципам ASAS/EULAR (регулярность, без боли, малая
-- амплитуда при обострении). Существующие тексты не менялись.
-- ---------------------------------------------------------------------------
INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects, position, gentle) VALUES

('neck-micro-turns', 'Микроповороты головы', 'warmup', 'neck', 'both',
 'Бережно будит подвижность шеи, когда повороты даются с трудом.',
 E'1. Сядьте прямо, плечи опущены, взгляд вперёд.\n2. Очень медленно поверните голову вправо на 10-15 градусов — как начало движения «нет».\n3. Вернитесь в центр, затем так же влево.\n4. Амплитуда маленькая, до первого натяжения, без боли.',
 NULL, 8, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"stop"}]'::jsonb, 'sitting', TRUE),

('neck-micro-nods', 'Микрокивки', 'warmup', 'neck', 'both',
 'Мягко разрабатывает наклон головы вперёд и назад малой амплитудой.',
 E'1. Сядьте прямо, макушка тянется вверх.\n2. Медленно кивните — подбородок опускается на 2-3 см, как «да».\n3. Вернитесь в исходное положение, голову назад не запрокидывайте.\n4. Дышите ровно, движение без рывков.',
 NULL, 8, 'beginner', '[]'::jsonb, '[{"trigger":"dizziness","action":"stop"}]'::jsonb, 'sitting', TRUE),

('neck-chin-tuck', 'Втягивание подбородка', 'main', 'neck', 'both',
 'Укрепляет глубокие мышцы шеи и выравнивает положение головы.',
 E'1. Сядьте прямо, плечи опущены, взгляд вперёд.\n2. Мягко отведите подбородок назад, как будто делаете «двойной подбородок». Голова не наклоняется.\n3. Задержитесь на 3 секунды, вернитесь.\n4. Движение маленькое, напряжение лёгкое.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('neck-iso-front', 'Изометрия шеи вперёд', 'main', 'neck', 'both',
 'Укрепляет мышцы шеи без движения — подходит, когда шея почти не двигается.',
 E'1. Сядьте прямо, положите ладонь на лоб.\n2. Мягко давите лбом в ладонь, ладонь не пускает — голова остаётся на месте.\n3. Сила — примерно треть от возможной, держите 5 секунд.\n4. Расслабьтесь на 5 секунд. Дыхание не задерживайте.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('neck-iso-side', 'Изометрия шеи вбок', 'main', 'neck', 'both',
 'Укрепляет боковые мышцы шеи без наклона головы.',
 E'1. Сядьте прямо, ладонь правой руки — на правый висок.\n2. Мягко давите головой в ладонь, голова не наклоняется.\n3. Треть силы, 5 секунд, затем отдых 5 секунд.\n4. Повторите в другую сторону.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('neck-iso-rotation', 'Изометрия шеи на поворот', 'main', 'neck', 'both',
 'Готовит мышцы к поворотам головы, не поворачивая её.',
 E'1. Сядьте прямо, ладонь правой руки — на правую скулу.\n2. Попробуйте повернуть голову вправо, ладонь не даёт — голова на месте.\n3. Треть силы, 5 секунд, отдых 5 секунд.\n4. Повторите в другую сторону.',
 NULL, 5, 'beginner', '["high_blood_pressure"]'::jsonb, '[{"trigger":"headache","action":"reduce_intensity"}]'::jsonb, 'sitting', TRUE),

('shoulder-iso-wall', 'Изометрия плеча у стены', 'main', 'shoulder', 'both',
 'Укрепляет плечо, когда рука поднимается плохо: мышца работает без движения.',
 E'1. Встаньте боком к стене, рука согнута в локте под прямым углом.\n2. Тыльной стороной кисти мягко давите в стену, как будто отводите руку в сторону.\n3. Рука не двигается, треть силы, 5 секунд, отдых 5 секунд.\n4. Слабой рукой — чуть меньше силы и повторов.',
 NULL, 5, 'beginner', '[]'::jsonb, '[]'::jsonb, 'standing', TRUE),

('spine-iso-chair', 'Прижатие спины к стулу', 'main', 'spine', 'both',
 'Включает мышцы спины без наклонов и прогибов.',
 E'1. Сядьте на стул со спинкой, стопы на полу.\n2. Мягко прижмите лопатки и верх спины к спинке стула.\n3. Держите 5 секунд, спина не прогибается, дыхание ровное.\n4. Расслабьтесь на 5 секунд.',
 NULL, 6, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('spine-micro-rotation', 'Микроповороты корпуса сидя', 'main', 'spine', 'both',
 'Бережно возвращает повороты грудного отдела малой амплитудой.',
 E'1. Сядьте прямо, руки скрещены на груди.\n2. Медленно поверните корпус вправо на 10-15 градусов, таз неподвижен.\n3. Вернитесь в центр, затем влево.\n4. Только до первого натяжения, без боли.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('legs-quad-set', 'Напряжение бедра сидя', 'main', 'legs', 'both',
 'Укрепляет переднюю поверхность бедра без нагрузки на суставы.',
 E'1. Сядьте на стул, одну ногу вытяните вперёд, пятка на полу.\n2. Напрягите бедро, прижимая колено вниз, носок на себя.\n3. Держите 5 секунд, расслабьтесь.\n4. Повторите на другой ноге.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE),

('hips-iso-squeeze', 'Сжатие полотенца коленями', 'main', 'hips', 'both',
 'Включает мышцы таза без разведения ног.',
 E'1. Сядьте на стул, между коленями — свёрнутое полотенце или мягкий мяч.\n2. Мягко сожмите его коленями, держите 5 секунд.\n3. Расслабьтесь на 5 секунд.\n4. Спина прямая, дыхание не задерживайте.',
 NULL, 8, 'beginner', '[]'::jsonb, '[]'::jsonb, 'sitting', TRUE)

ON CONFLICT (slug) DO NOTHING;

-- Положение тела у существующих упражнений (по первой строке техники).
UPDATE exercises SET position = 'prone'
  WHERE slug IN ('gen-superman', 'main-prone-extension', 'main-swimmer');
UPDATE exercises SET position = 'quadruped'
  WHERE slug IN ('main-bird-dog', 'main-cat-cow', 'main-thoracic-rotation', 'gen-plank', 'gen-pushup', 'gen-mountain-climbers');
UPDATE exercises SET position = 'supine'
  WHERE slug IN ('breath-cooldown', 'breath-diaphragm', 'gen-crunch', 'gen-glute-bridge', 'main-bridge', 'main-dead-bug',
                 'main-hamstring-stretch', 'main-knee-to-chest', 'stretch-full-body', 'stretch-piriformis',
                 'stretch-supine-twist', 'warmup-pelvic-tilt');
UPDATE exercises SET position = 'side' WHERE slug IN ('gen-side-plank', 'main-hip-abduction');
UPDATE exercises SET position = 'kneeling' WHERE slug IN ('main-hip-flexor-stretch', 'stretch-child-pose');
UPDATE exercises SET position = 'sitting' WHERE slug IN ('breath-chest-expand', 'warmup-neck-tilts', 'massage-glutes-ball');
UPDATE exercises SET position = 'standing_free' WHERE slug IN ('gen-jumping-jacks', 'gen-lunges', 'gen-step-touch', 'gen-squat');
UPDATE exercises SET position = 'standing'
  WHERE slug IN ('gen-arm-swings', 'gen-row-band', 'gen-stretch-quads', 'main-arm-circles', 'main-chest-opener-doorway',
                 'main-heel-raises', 'main-mini-squat', 'main-shoulder-external', 'main-shoulder-wall-slide',
                 'main-side-bend-standing', 'main-wall-posture', 'massage-paravertebral', 'gen-stretch-full');

-- Щадящие среди существующих: дыхание, мягкие разминочные движения, самомассаж.
UPDATE exercises SET gentle = TRUE
  WHERE type = 'breathing'
     OR slug IN ('warmup-pelvic-tilt', 'warmup-neck-tilts', 'warmup-neck-turns', 'warmup-shoulder-rolls',
                 'massage-suboccipital', 'main-scapula-squeeze', 'main-wall-posture');

-- Категория блюда — для иконки в меню (GIMN-011).
UPDATE meals SET category = 'porridge'
  WHERE slug IN ('br-oatmeal-banana', 'br-oatmeal-berries', 'br-rice-milk-porridge', 'br-kefir-oat-jar', 'br-buckwheat-egg');
UPDATE meals SET category = 'dairy'
  WHERE slug IN ('br-cottage-cheese-apple', 'br-cottage-pancakes', 'dn-cottage-veg', 'dn-kefir-cottage',
                 'sn-cottage-berries', 'sn-cottage-cucumber', 'sn-yogurt-nuts');
UPDATE meals SET category = 'eggs'
  WHERE slug IN ('br-scrambled-eggs-veg', 'br-omelet-cheese-veg', 'br-eggs-toast-veg', 'dn-omelet-spinach',
                 'dn-eggs-veg-stew', 'sn-boiled-eggs');
UPDATE meals SET category = 'meat'
  WHERE slug IN ('ln-chicken-buckwheat', 'ln-beef-rice-veg', 'ln-turkey-pasta', 'ln-chicken-thigh-rice',
                 'ln-chicken-potato-bake', 'ln-turkey-buckwheat', 'ln-chicken-pasta-broccoli', 'dn-chicken-salad',
                 'dn-turkey-cabbage', 'dn-chicken-zucchini');
UPDATE meals SET category = 'fish'
  WHERE slug IN ('ln-cod-potato', 'ln-hake-buckwheat', 'ln-pollock-veg', 'dn-cod-veg', 'dn-hake-salad', 'dn-pollock-cauliflower');
UPDATE meals SET category = 'soup' WHERE slug IN ('ln-lentil-soup');
UPDATE meals SET category = 'vegetables' WHERE slug IN ('ln-beans-veg-stew');
UPDATE meals SET category = 'fruit'
  WHERE slug IN ('sn-kefir-apple', 'sn-banana-nuts', 'sn-orange-yogurt', 'sn-pear-kefir');

-- Картинки движения с Pixabay (GIMN-013). Отобраны вручную и отсмотрены:
-- движение совпадает с нашей техникой. Файлы лежат в public/exercises/
-- (хотлинк запрещён лицензией), источники — в docs/IMAGE_SOURCES.md.
-- Остальным упражнениям визуал даёт схема движения, она рисуется кодом
-- по slug и в базе не хранится.
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp', image_credit = 'Pixabay'
  WHERE slug IN ('gen-plank', 'gen-pushup', 'main-hip-abduction', 'stretch-child-pose');

-- ---------------------------------------------------------------------------
-- УПРАЖНЕНИЯ НА ТУРНИКЕ И БРУСЬЯХ (GIMN-014, 15 штук) — только общий режим.
--
-- Порядок в списке — от самого простого к самому тяжёлому: вис, шраги,
-- австралийские, негативные, полные подтягивания. Так человек без опыта
-- получает висы и шраги, а подтягивания приходят с ростом уровня.
--
-- Режим «Бехтерева» их не получает, и это намеренно: вис под собственным
-- весом при анкилозирующем спондилите — вопрос к врачу, а не к приложению.
-- Механика запрета общая для всех режимов: подбор берёт из соседнего режима
-- только дыхание, разминку и растяжку уровня «начальный».
--
-- equipment: подбор покажет эти упражнения, только если в анкете отмечен
-- турник (has_turnik = 'yes'), а при «могу найти» — последними и с пометкой.
-- ---------------------------------------------------------------------------

INSERT INTO exercises (slug, name, type, target_joint, mode, description, technique, duration_sec, repetitions, level, contraindications, side_effects, position, gentle, equipment) VALUES

-- Висы: с них начинают, они же — растяжка позвоночника после силовой части.
('bar-dead-hang', 'Мёртвый вис', 'stretch', 'spine', 'general',
 'Вытягивает позвоночник под собственным весом и разгружает поясницу.',
 E'1. Возьмитесь за турник прямым хватом на ширине плеч.\n2. Полностью повисните: руки прямые, плечи расслаблены, ноги не касаются пола.\n3. Дышите ровно, не раскачивайтесь.\n4. Слезайте мягко, не спрыгивая.',
 30, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-hang-posture', 'Вис для осанки', 'stretch', 'spine', 'general',
 'Мягкое вытяжение в конце занятия: раскрывает грудную клетку и снимает сутулость.',
 E'1. Повисните на турнике прямым хватом, стопы могут слегка касаться пола — так легче.\n2. Расслабьте спину и плечи, дайте телу вытянуться вниз.\n3. Макушкой тянитесь вверх, подбородок не задирайте.\n4. Держите столько, сколько спокойно держится хват.',
 40, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-active-hang', 'Активный вис', 'main', 'shoulder', 'general',
 'Учит держать плечи включёнными — база для подтягиваний.',
 E'1. Повисните на прямых руках прямым хватом.\n2. Не сгибая локти, опустите плечи вниз и сведите лопатки — тело чуть поднимется.\n3. Держите это положение, грудь раскрыта.\n4. Дышите ровно, не задерживайте дыхание.',
 20, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-shrug', 'Шраги на турнике', 'main', 'shoulder', 'general',
 'Пожимание плечами в висе — укрепляет лопаточные мышцы перед подтягиваниями.',
 E'1. Повисните на турнике прямым хватом, руки прямые.\n2. Не сгибая локти, опустите плечи вниз и сведите лопатки.\n3. Плавно отпустите — плечи поднимаются к ушам.\n4. Работают только лопатки, локти всё время прямые.',
 NULL, 10, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Подтягивания: от облегчённых к полным.
('bar-australian-row', 'Австралийские подтягивания', 'main', 'shoulder', 'general',
 'Подтягивание к низкой перекладине из наклонного виса — облегчённый вариант для спины.',
 E'1. Возьмитесь за низкую перекладину (на уровне пояса) прямым хватом шире плеч.\n2. Выпрямите тело в линию, пятки на полу, руки прямые.\n3. Подтяните грудь к перекладине, сводя лопатки.\n4. Медленно опуститесь. Чем ближе стопы к перекладине, тем легче.',
 NULL, 12, 'beginner', '["shoulder_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-negative-pullup', 'Негативные подтягивания', 'main', 'shoulder', 'general',
 'Медленный спуск из верхней точки — так учатся подтягиваться с нуля.',
 E'1. Встаньте на опору так, чтобы подбородок был над перекладиной, возьмитесь прямым хватом.\n2. Уберите ноги с опоры и удерживайте верхнее положение.\n3. Опускайтесь вниз медленно, на счёт 3-5, до полностью прямых рук.\n4. Вернитесь на опору и повторите.',
 NULL, 5, 'intermediate', '["shoulder_pain"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-overhand', 'Подтягивание прямым хватом', 'main', 'shoulder', 'general',
 'Базовое подтягивание: широчайшие мышцы спины, плечи, руки.',
 E'1. Возьмитесь за турник прямым хватом (ладони от себя) на ширине плеч.\n2. Из виса на прямых руках подтянитесь, пока подбородок не окажется над перекладиной.\n3. Опускайтесь подконтрольно до прямых рук, без падения вниз.\n4. Не раскачивайтесь и не помогайте себе рывком ног.',
 NULL, 6, 'intermediate', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-underhand', 'Подтягивание обратным хватом', 'main', 'shoulder', 'general',
 'Ладони к себе — больше работы достаётся бицепсам, подтягиваться легче.',
 E'1. Возьмитесь за турник обратным хватом (ладони к себе) на ширине плеч.\n2. Подтянитесь, пока подбородок не окажется над перекладиной, локти идут вниз вдоль тела.\n3. Опускайтесь медленно до прямых рук.\n4. Плечи держите опущенными, не втягивайте голову.',
 NULL, 6, 'intermediate', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-pullup-wide', 'Подтягивание широким хватом', 'main', 'shoulder', 'general',
 'Хват шире плеч — акцент на широчайшие, самый тяжёлый вариант.',
 E'1. Возьмитесь прямым хватом заметно шире плеч.\n2. Подтянитесь грудью к перекладине, сводя лопатки, локти идут в стороны и вниз.\n3. Опускайтесь подконтрольно до прямых рук.\n4. Берите этот вариант, только когда обычные подтягивания даются легко.',
 NULL, 5, 'advanced', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"pressure_up","action":"reduce_intensity"},{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Пресс в висе.
('bar-knee-raise', 'Подъём коленей в висе', 'main', 'core', 'general',
 'Пресс в висе: колени к груди, поясница не прогибается.',
 E'1. Повисните на турнике прямым хватом, плечи опущены.\n2. Подтяните колени к груди, округляя низ живота.\n3. Опустите ноги медленно, не раскачиваясь.\n4. Движение делайте прессом, а не махом ног.',
 NULL, 10, 'beginner', '["acute_back_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-leg-raise', 'Подъём ног к груди в висе', 'main', 'core', 'general',
 'Тот же подъём, но с прямыми ногами — заметно тяжелее.',
 E'1. Повисните на турнике прямым хватом, ноги прямые.\n2. Поднимите прямые ноги до уровня таза или выше, к груди.\n3. Опускайте медленно, без раскачки.\n4. Не можете с прямыми — согните колени, это тот же подъём полегче.',
 NULL, 8, 'advanced', '["acute_back_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-l-hang', 'Вис в L-сидении', 'main', 'core', 'general',
 'Удержание прямых ног под углом 90 градусов — статика на пресс.',
 E'1. Повисните на турнике прямым хватом, плечи опущены.\n2. Поднимите прямые ноги до угла 90 градусов с телом.\n3. Держите положение, дышите ровно, носки тяните на себя.\n4. Тяжело — держите согнутые колени, это тот же угол полегче.',
 15, NULL, 'advanced', '["acute_back_pain"]'::jsonb, '[{"trigger":"just_hard","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'pullup_bar'),

('bar-hang-twist', 'Маятник в висе', 'main', 'core', 'general',
 'Колени вбок из виса — косые мышцы живота.',
 E'1. Повисните на турнике прямым хватом, колени подтянуты к груди.\n2. Не опуская колени, отведите их вбок, скручиваясь в пояснице.\n3. Вернитесь в центр и повторите в другую сторону.\n4. Амплитуда небольшая, движение медленное.',
 NULL, 10, 'intermediate', '["acute_back_pain"]'::jsonb, '[]'::jsonb, 'standing', FALSE, 'pullup_bar'),

-- Брусья. Отдельный снаряд: турник есть чаще, чем брусья.
('dip-support-hold', 'Удержание в упоре на брусьях', 'main', 'core', 'general',
 'Стойка на прямых руках между брусьями — учит держать корпус и плечи.',
 E'1. Встаньте между брусьями, обопритесь на прямые руки, локти выпрямлены.\n2. Оторвите ноги от пола, тело вертикально, плечи опущены от ушей.\n3. Держите положение, напрягая живот и ягодицы.\n4. Опускайтесь на пол мягко.',
 20, NULL, 'beginner', '["shoulder_pain"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"}]'::jsonb, 'standing', FALSE, 'dip_bars'),

('dip-pushup', 'Отжимания на брусьях', 'main', 'shoulder', 'general',
 'Грудь, передние дельты и трицепс под полным весом тела.',
 E'1. Встаньте в упор на прямых руках между брусьями.\n2. Опуститесь, сгибая локти примерно до 90 градусов, корпус чуть наклонён вперёд.\n3. Выжмите себя вверх до прямых рук.\n4. Плечи не проваливайте к ушам; болит плечо — уменьшите глубину.',
 NULL, 8, 'advanced', '["shoulder_pain","high_blood_pressure"]'::jsonb, '[{"trigger":"joint_pain","action":"stop"},{"trigger":"pressure_up","action":"reduce_intensity"}]'::jsonb, 'standing', FALSE, 'dip_bars')

ON CONFLICT (slug) DO NOTHING;

-- Картинки движения с wger (GIMN-015). Отобраны вручную и отсмотрены:
-- движение совпадает с нашей техникой. Лицензия CC BY-SA требует назвать
-- автора — он в image_credit, полные ссылки в docs/IMAGE_SOURCES.md.
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

-- Чтобы API сразу увидел новые таблицы:
NOTIFY pgrst, 'reload schema';
