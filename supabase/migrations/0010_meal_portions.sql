-- 0010: порция блюда в меню.
-- Одно блюдо на приём пищи даёт 1000-1800 ккал в день, а норма по Миффлину
-- бывает и 3000+. Попасть в «норма ±5%» (US-07) без масштабирования порций
-- невозможно, поэтому граммы рецепта умножаются на portion.

ALTER TABLE user_meals
  ADD COLUMN IF NOT EXISTS portion NUMERIC(3,2) NOT NULL DEFAULT 1.00
    CHECK (portion BETWEEN 0.50 AND 2.50);

COMMENT ON COLUMN user_meals.portion IS 'Множитель порции: граммы и ккал рецепта умножаются на него. 1.00 = как в рецепте';
