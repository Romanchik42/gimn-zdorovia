# GIMN-025: PEXELS VIDEO API → ЖИВЫЕ ГИФКИ УПРАЖНЕНИЙ

## ЗАДАЧА
Заменить минималистичные SVG-схемы на **реальные анимированные видео людей в движении** из Pexels Video API.

Результат: 76 упражнений с живыми гифками (`.webp` + `.gif`), применённые через миграцию `0025_pexels_video_images.sql`.

---

## АРХИТЕКТУРА

### Текущее состояние (GIMN-021)
- `image_url` в `exercises` указывает на локальные пути (`/exercises/main-*`, `/exercises/stretch-*`)
- 26 упражнений имеют картинки из wger (`.webp` живые гифки)
- 50 упражнений без картинок (пусто или `/exercises/` + схема)
- Визуальное кино: стрелки двигаются, дуги прочерчиваются, пунктир дышит (SVG)

### Целевое состояние (GIMN-025)
- `image_url` указывает на `https://gimn-zdorovia.vercel.app/exercises/<slug>.webp`
- Все 76 упражнений имеют живые видео-гифки (люди в движении)
- Формат: `.webp` (основной, меньше вес) + `.gif` (fallback)
- Источник: Pexels Video API (бесплатно, лицензия CC0)

---

## ТЕХНИЧЕСКИЙ ПЛАН

### Шаг 1: Подготовка
1. Получить PEXELS_API_KEY (https://www.pexels.com/api/) — это бесплатно, 200 запросов/час
2. Положить в `.env`: `PEXELS_API_KEY=xxx`
3. Создать папку: `public/exercises/` (если нет) для хранения гифок
4. Выгрузить список 76 упражнений из seed:
   ```sql
   SELECT id, slug, name, equipment FROM exercises ORDER BY id;
   ```

### Шаг 2: Парсинг Pexels Video API
Для каждого упражнения:
1. Формируем поисковый запрос: `query = slug.replace(/-/g, ' ')` (e.g. `main-hip-abduction` → `hip abduction`)
2. GET к `https://api.pexels.com/videos/search?query={query}&per_page=1`
3. Берём первое видео (рейтинг на Pexels гарантирует качество)
4. Скачиваем `.mp4` в `tmp/`

**Если видео не найдено**: fallback на Pixabay Video API или статичное изображение (пока условно пропускаем, отмечаем в логе).

### Шаг 3: Конвертация в гифки
1. Обрезать видео: первые 5–10 секунд (зацикливается)
2. `ffmpeg -i video.mp4 -vf "fps=10,scale=400:-1" -loop 0 output.webp`
3. `ffmpeg -i video.mp4 -vf "fps=10,scale=400:-1" output.gif`
4. Сохранить оба в `public/exercises/{slug}.webp` и `{slug}.gif`

### Шаг 4: Миграция в Supabase
Создать `supabase/migrations/0025_pexels_video_images.sql`:
```sql
-- GIMN-025: Pexels Video API → живые гифки
UPDATE exercises SET image_url = '/exercises/' || slug || '.webp' WHERE slug IN (/* список */);

-- Логирование
NOTIFY pgrst, 'gimn_025_applied';
```

### Шаг 5: Деплой
1. Пушить новые файлы в `public/exercises/*.webp` и `*.gif`
2. Пушить миграцию в `supabase/migrations/`
3. Применить миграцию в Supabase через SQL Editor (или `supabase db push`)
4. `git commit -m "GIMN-025: Pexels Video → живые гифки для 76 упражнений"`
5. Деплой на Vercel (автоматический через Actions)

---

## ТЕХНИЧЕСКИЕ ДЕТАЛИ

### Node.js скрипт для парсинга
```js
// scripts/fetch-pexels-videos.js
const fs = require('fs');
const path = require('path');
const https = require('https');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const EXERCISES_DIR = path.join(__dirname, '../public/exercises');
const TMP_DIR = path.join(__dirname, '../tmp');

if (!fs.existsSync(EXERCISES_DIR)) fs.mkdirSync(EXERCISES_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// Загрузить список упражнений
const exercises = require('./exercises.json'); // выгружено из БД

async function fetchVideo(slug, query) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`;
  
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'Authorization': PEXELS_API_KEY } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const videoUrl = json.videos?.[0]?.video_files?.[0]?.link;
          resolve(videoUrl);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      res.pipe(fs.createWriteStream(filePath));
      res.on('end', () => resolve(filePath));
    }).on('error', reject);
  });
}

async function convertToGif(inputPath, slug) {
  const webpPath = path.join(EXERCISES_DIR, `${slug}.webp`);
  const gifPath = path.join(EXERCISES_DIR, `${slug}.gif`);
  
  try {
    // webp
    await exec(`ffmpeg -y -i "${inputPath}" -vf "fps=10,scale=400:-1" -loop 0 "${webpPath}"`);
    // gif
    await exec(`ffmpeg -y -i "${inputPath}" -vf "fps=10,scale=400:-1" "${gifPath}"`);
    console.log(`✅ ${slug}: converted to webp + gif`);
  } catch (e) {
    console.error(`❌ ${slug}: ffmpeg error`, e.message);
  }
}

(async () => {
  for (const ex of exercises) {
    try {
      const query = ex.slug.replace(/-/g, ' ');
      console.log(`⏳ Fetching: ${ex.slug} (${query})`);
      
      const videoUrl = await fetchVideo(ex.slug, query);
      if (!videoUrl) {
        console.log(`⚠️  ${ex.slug}: no video found, skipping`);
        continue;
      }
      
      const tmpFile = path.join(TMP_DIR, `${ex.slug}.mp4`);
      await downloadFile(videoUrl, tmpFile);
      console.log(`📥 ${ex.slug}: downloaded`);
      
      await convertToGif(tmpFile, ex.slug);
      fs.unlinkSync(tmpFile);
    } catch (e) {
      console.error(`❌ ${ex.slug}: error`, e.message);
    }
  }
  console.log('✅ Done!');
})();
```

**Запуск:**
```bash
export PEXELS_API_KEY=xxx
npm run scripts/fetch-pexels-videos.js
```

### Fallback на Pixabay Video
Если Pexels не нашёл (редко):
```js
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY; // уже есть
const pixabayUrl = `https://pixabay.com/api/videos/?key=${PIXABAY_API_KEY}&q=${query}&per_page=1`;
```

### Проверки после конвертации
```bash
# Все ли гифки созданы?
ls -la public/exercises/ | grep -E "\.(webp|gif)$" | wc -l

# Размер?
du -sh public/exercises/

# Рабочие ли (не пустые)?
find public/exercises -type f -size 0 -delete
```

---

## ГРАНИЦЫ (ВСЕГДА)
- ✅ Скачивать видео в `tmp/`, удалять после конвертации
- ✅ `.webp` основной, `.gif` для браузеров IE (редко, но подстраховка)
- ✅ Разрешение 400px ширина (мобильных для карточек хватает)
- ✅ 10 fps (плавность, не перегруз размера)
- ✅ Не коммитить сами видео (`.mp4`), только гифки
- ❌ Не трогать текущие wger-гифки, переписать `image_url`
- ❌ Не менять таблицу `exercises` структурно
- ✅ Миграция `0025` только UPDATE, никакие DROP/ADD

---

## РЕЗУЛЬТАТ
- 76 упражнений с живыми гифками (вместо SVG-схем)
- `public/exercises/` +152 файла (76 webp + 76 gif)
- `supabase/migrations/0025_pexels_video_images.sql` +76 UPDATE
- 1 коммит на GitHub: `GIMN-025: Pexels Video API → живые гифки`
- Деплой на Vercel

---

## ПРИМЕРНОЕ ВРЕМЯ: 20–30 минут
- Pexels запросы: 1–2 мин (76 параллельных запросов, API быстро)
- Скачивание видео: 5–10 мин (зависит от интернета)
- Конвертация ffmpeg: 5–8 мин (параллель на 4 ядра)
- SQL миграция: <1 мин
- Коммит + деплой: 1–2 мин

**Примечание:** Если интернет медленный или Pexels вернёт мало результатов (редко), может потребоваться ручная подборка для оставшихся упражнений → +15 мин.
