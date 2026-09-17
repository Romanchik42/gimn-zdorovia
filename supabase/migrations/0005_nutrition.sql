-- 0005: справочник блюд, меню пользователя, список покупок (SPEC 2.1, 5.3).

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(80) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  meal_type VARCHAR(20) NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_kcal INT NOT NULL CHECK (total_kcal > 0),
  total_protein_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  total_fat_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  total_carbs_g NUMERIC(5,1) NOT NULL DEFAULT 0,
  cook_time_min INT NOT NULL DEFAULT 15,
  recipe TEXT NOT NULL,
  contraindications JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE meals IS 'Справочник блюд из топ-30 доступных продуктов (SPEC 5.3)';
COMMENT ON COLUMN meals.ingredients IS 'JSON: [{"product":"Овсянка","grams":60,"kcal":228}]';

CREATE INDEX IF NOT EXISTS idx_meals_type ON meals(meal_type);
CREATE INDEX IF NOT EXISTS idx_meals_kcal ON meals(meal_type, total_kcal);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  consumed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date, meal_type)
);

COMMENT ON TABLE user_meals IS 'Меню пользователя на конкретную дату. Одно блюдо на приём пищи';

CREATE INDEX IF NOT EXISTS idx_user_meals_date ON user_meals(user_id, date);

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start_date)
);

COMMENT ON TABLE shopping_list IS 'Список покупок на неделю, агрегированный из меню';
COMMENT ON COLUMN shopping_list.items IS 'JSON: [{"product":"Куриная грудка","grams":1400,"purchased":false}]';

CREATE TRIGGER shopping_list_updated_at BEFORE UPDATE ON shopping_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals_read_all" ON meals FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "user_meals_own" ON user_meals FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "shopping_list_own" ON shopping_list FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
