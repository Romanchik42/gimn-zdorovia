# 🎬 BATCH: GIMN-025 — Pexels Video API → Живые гифки упражнений

**Адресат:** Кот (Claude Code)  
**Статус:** Ready to execute  
**Приоритет:** High

---

## ЗАДАЧА
Автоматизировать замену SVG-схем упражнений на **реальные анимированные видео людей в движении** из Pexels Video API для всех **76 упражнений**.

**Результат:**
- `public/exercises/*.webp` (152 файла: 76 webp + 76 gif)
- `supabase/migrations/0025_pexels_video_images.sql` (UPDATE image_url для БД)
- 1 коммит: `GIMN-025: Pexels Video API → живые гифки для 76 упражнений`
- Деплой на Vercel

---

## ШАГ 1: ПОДГОТОВКА

### 1.1. Получить ключ Pexels (если нет)
- Перейти: https://www.pexels.com/api/
- Зарегистрироваться (быстро)
- Скопировать `PEXELS_API_KEY`
- Добавить в `.env`:
  ```
  PEXELS_API_KEY=xxxxxxxxxxxxx
  ```

### 1.2. Проверить зависимости
```bash
# ffmpeg должен быть
ffmpeg --version

# node должен быть (уже есть)
node --version
```

### 1.3. Создать папки
```bash
mkdir -p public/exercises
mkdir -p tmp
```

---

## ШАГ 2: ЭКСПОРТИРОВАТЬ СПИСОК УПРАЖНЕНИЙ ИЗ БД

В Supabase SQL Editor запустить:
```sql
SELECT id, slug, name, type, equipment FROM exercises ORDER BY id;
```

Результат сохранить в `scripts/exercises.json`:
```json
[
  { "id": 1, "slug": "main-hip-abduction", "name": "Hip Abduction", "type": "main", "equipment": "none" },
  { "id": 2, "slug": "main-hip-adduction", "name": "Hip Adduction", "type": "main", "equipment": "none" },
  ...
]
```

---

## ШАГ 3: СОЗДАТЬ СКРИПТ ПАРСИНГА

Создать файл `scripts/fetch-pexels-videos.js`:

```javascript
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY не установлен');

const EXERCISES_DIR = path.join(__dirname, '../public/exercises');
const TMP_DIR = path.join(__dirname, '../tmp');
const EXERCISES_JSON = path.join(__dirname, 'exercises.json');

if (!fs.existsSync(EXERCISES_DIR)) fs.mkdirSync(EXERCISES_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const exercises = JSON.parse(fs.readFileSync(EXERCISES_JSON, 'utf-8'));
const log = [];

async function fetchFromPexels(query) {
  return new Promise((resolve, reject) => {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1`;
    https.get(url, { headers: { 'Authorization': PEXELS_API_KEY } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const video = json.videos?.[0];
          resolve(video?.video_files?.[0]?.link || null);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filePath);
      });
    }).on('error', (e) => {
      fs.unlink(filePath, () => {});
      reject(e);
    });
  });
}

async function convertVideo(inputPath, slug) {
  const webpPath = path.join(EXERCISES_DIR, `${slug}.webp`);
  const gifPath = path.join(EXERCISES_DIR, `${slug}.gif`);

  try {
    // webp
    execSync(`ffmpeg -y -i "${inputPath}" -vf "fps=10,scale=400:-1" -loop 0 "${webpPath}"`, { stdio: 'pipe' });
    // gif
    execSync(`ffmpeg -y -i "${inputPath}" -vf "fps=10,scale=400:-1" "${gifPath}"`, { stdio: 'pipe' });
    return true;
  } catch (e) {
    console.error(`❌ ${slug}: ffmpeg failed`, e.message);
    return false;
  }
}

(async () => {
  console.log(`\n⏳ Fetching ${exercises.length} exercises from Pexels...\n`);

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const progress = `[${i + 1}/${exercises.length}]`;

    try {
      const query = ex.slug.replace(/-/g, ' ');
      process.stdout.write(`${progress} ⏳ ${ex.slug}...`);

      const videoUrl = await fetchFromPexels(query);
      if (!videoUrl) {
        console.log(` ⚠️  no video`);
        log.push(`⚠️  ${ex.slug}: no video found`);
        continue;
      }

      const tmpFile = path.join(TMP_DIR, `${ex.slug}.mp4`);
      await downloadFile(videoUrl, tmpFile);

      const success = await convertVideo(tmpFile, ex.slug);
      if (success) {
        console.log(` ✅`);
        log.push(`✅ ${ex.slug}: ok`);
      } else {
        console.log(` ❌ convert fail`);
        log.push(`❌ ${ex.slug}: convert failed`);
      }

      fs.unlinkSync(tmpFile);
    } catch (e) {
      console.log(` ❌ error`);
      log.push(`❌ ${ex.slug}: ${e.message}`);
    }
  }

  console.log(`\n📋 Summary:\n${log.join('\n')}\n`);
  fs.writeFileSync(path.join(__dirname, 'pexels-log.txt'), log.join('\n'));
  console.log('✅ Done! Log saved to scripts/pexels-log.txt');
})();
```

---

## ШАГ 4: ЗАПУСТИТЬ СКРИПТ

```bash
cd "F:\Project gimn zdorovia"
export PEXELS_API_KEY=xxxxx
node scripts/fetch-pexels-videos.js
```

**Результат:**
```
[1/76] ⏳ main-hip-abduction... ✅
[2/76] ⏳ main-hip-adduction... ✅
[3/76] ⏳ main-knee-extension... ✅
...
✅ Done! Log saved to scripts/pexels-log.txt
```

---

## ШАГ 5: ПРОВЕРИТЬ РЕЗУЛЬТАТ

```bash
# Количество файлов
ls public/exercises/ | wc -l
# Должно быть ~152 (76 webp + 76 gif)

# Размер папки
du -sh public/exercises/
# Примерно 200-300 MB

# Нет ли пустых файлов?
find public/exercises -type f -size 0
# (ничего не должно вывести)
```

---

## ШАГ 6: СОЗДАТЬ МИГРАЦИЮ 0025

Создать файл `supabase/migrations/0025_pexels_video_images.sql`:

```sql
-- GIMN-025: Pexels Video API → живые гифки упражнений
-- Обновляем image_url для всех упражнений на /exercises/{slug}.webp

UPDATE exercises SET image_url = '/exercises/' || slug || '.webp';

-- Логирование применения
NOTIFY pgrst, 'gimn_025_pexels_video_applied';
```

---

## ШАГ 7: ПРИМЕНИТЬ МИГРАЦИЮ

### Вариант А: Через Supabase SQL Editor
1. Открыть: https://supabase.com/dashboard/project/hpadntvkodnqfyotgjeu/sql
2. Скопировать содержимое `0025_pexels_video_images.sql`
3. Запустить (Ctrl+Enter)
4. Проверить: SELECT COUNT(*) FROM exercises WHERE image_url LIKE '/exercises/%'; должно вернуть 76

### Вариант Б: Через CLI (если настроено)
```bash
supabase db push
```

---

## ШАГ 8: КОММИТ И ДЕПЛОЙ

```bash
# Проверить изменения
git status

# Добавить новые файлы
git add public/exercises/
git add supabase/migrations/0025_*.sql
git add scripts/exercises.json
git add scripts/pexels-log.txt

# Коммит
git commit -m "GIMN-025: Pexels Video API → живые гифки для 76 упражнений"

# Пуш
git push origin main
```

**Автоматический деплой на Vercel** через GitHub Actions (~2-3 мин).

---

## РЕЗУЛЬТАТ

✅ 76 упражнений с живыми анимированными видео  
✅ `public/exercises/` синхронизирован с Vercel  
✅ `exercises.image_url` обновлены в Supabase  
✅ Коммит в Git + деплой готов  
✅ https://gimn-zdorovia.vercel.app отрефрешится автоматически

---

## FALLBACK (если есть проблемы)

**Если Pexels вернул мало видео:**
- `scripts/pexels-log.txt` покажет, для каких упражнений не нашлось видео
- Можно дополнить вручную теми же 26 wger-гифками или Pixabay (позже)

**Если ffmpeg не установлен:**
```bash
# Windows (через choco)
choco install ffmpeg

# или вручную: https://ffmpeg.org/download.html
```

**Если видео слишком большие:**
- Уменьшить fps: `fps=5` вместо `fps=10`
- Или разрешение: `scale=300:-1` вместо `scale=400:-1`

---

## ВРЕМЯ ВЫПОЛНЕНИЯ: **20–30 минут**

- Экспорт упражнений: 1 мин
- Pexels запросы (параллель): 2–3 мин
- Скачивание видео: 5–10 мин (интернет-зависимо)
- Конвертация ffmpeg: 5–8 мин (параллель на 4 ядра)
- Миграция + коммит + деплой: 2–3 мин

**Начинаешь код?** Готов.
