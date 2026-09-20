/**
 * Типы БД.
 *
 * Обычно это делает `supabase gen types typescript`, но у кота нет доступа
 * к проекту Supabase (нет connection string / PAT), поэтому типы написаны
 * вручную строго по supabase/migrations/*.sql. При изменении миграций
 * правьте оба места.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Режим — единый источник в @/lib/modes (GIMN-012).
export type { Mode } from "@/lib/modes";
import type { Mode } from "@/lib/modes";
export type ThemeName = "sage" | "terracotta" | "ocean" | "lavender" | "sand" | "mint" | "graphite";
/** Своя палитра поверх темы (0014). */
export type CustomTheme = { bg: string; text: string; card: string; glow: boolean; glow_strength: number };
export type InfoCardTint = "neutral" | "blue" | "sage" | "coral" | "sand" | "lavender";
export type MealCategory = "porridge" | "meat" | "fish" | "vegetables" | "dairy" | "soup" | "eggs" | "fruit";
export type FeedbackType = "review" | "bug" | "idea";
export type SoundPack =
  | "soft"
  | "energetic"
  | "minimal"
  | "nature"
  | "digital"
  | "warm"
  | "none";
export type Intensity = "low" | "medium" | "high";
export type SequenceIntensity = "low" | "medium" | "normal";
export type ExerciseType = "breathing" | "warmup" | "main" | "stretch" | "massage";
export type TargetJoint = "spine" | "shoulder" | "neck" | "legs" | "hips" | "core" | "full_body";
export type Level = "beginner" | "intermediate" | "advanced";
export type FeedbackStatus = "done" | "difficult" | "skipped";
export type WorkoutStatus = "planned" | "in_progress" | "completed" | "skipped";
export type WorkoutSource = "plan" | "custom" | "template";
export type MealType = "breakfast" | "lunch" | "snack" | "dinner";
/** Длина занятия (0013): short — 4-5 упр., medium — 7-8, full — весь план. */
export type WorkoutLength = "short" | "medium" | "full";
export type Symptom =
  | "pressure_up"
  | "headache"
  | "cramp"
  | "joint_pain"
  | "nausea"
  | "dizziness"
  | "just_hard"
  | "other";
export type NextAdjustment =
  | "none"
  | "reduce_intensity_10"
  | "reduce_intensity_20"
  | "skip_joint"
  | "skip_exercise"
  | "lighter_only";
export type ReferralSource = "link" | "qr" | "telegram" | "share" | "unknown";

export type UserRow = {
  id: string;
  telegram_id: number | null;
  telegram_username: string | null;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  workout_length: WorkoutLength | null;
  custom_theme: CustomTheme | null;
  info_card_tint: InfoCardTint;
  avatar_url: string | null;
  name: string;
  gender: "male" | "female" | null;
  birth_date: string | null;
  mode: Mode;
  theme: ThemeName;
  auto_theme: boolean;
  sounds_enabled: boolean;
  sound_pack: SoundPack;
  sound_volume: number;
  morning_reminder_time: string;
  evening_reminder_time: string;
  reminders_enabled: boolean;
  tour_completed: boolean;
  tour_completed_at: string | null;
  workout_tour_completed: boolean;
  referral_code: string;
  referred_by: string | null;
  referred_at: string | null;
  registered_at: string;
  next_report_date: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type UserDiagnosticsRow = {
  id: string;
  user_id: string;
  shober_test_cm: number | null;
  side_bend_left_cm: number | null;
  side_bend_right_cm: number | null;
  rotation_degrees: number | null;
  pain_areas: string[];
  stiffness_level: "low" | "medium" | "high" | null;
  blood_pressure_ok: boolean | null;
  calculated_intensity: SequenceIntensity;
  calculated_focus: string[];
  /** Углублённая диагностика (0014): ключ вопроса → вариант. См. lib/diagnostics/extended.ts. */
  extended_answers: Record<string, string> | null;
  extended_completed_at: string | null;
  created_at: string;
};

export type UserProfileGeneralRow = {
  id: string;
  user_id: string;
  weight_kg: number;
  height_cm: number;
  goal: "lose" | "gain" | "maintain";
  activity_level: "sedentary" | "light" | "medium" | "high" | "very_high";
  difficulty: Level;
  training_days: number[];
  calculated_bmr: number;
  calculated_tdee: number;
  calculated_target_calories: number;
  created_at: string;
  updated_at: string;
};

export type ExerciseRow = {
  id: string;
  slug: string;
  name: string;
  type: ExerciseType;
  target_joint: TargetJoint;
  mode: Mode | "both";
  description: string;
  technique: string;
  gif_url: string | null;
  duration_sec: number | null;
  repetitions: number | null;
  level: Level;
  contraindications: string[];
  side_effects: { trigger: string; action: string }[];
  /** Положение тела (0014): any | standing | standing_free | sitting | sitting_floor | kneeling | quadruped | supine | prone | side. */
  position: string;
  /** Щадящее: микроамплитуда или изометрика (0014). */
  gentle: boolean;
  created_at: string;
};

/** Элемент последовательности. duration_sec и repetitions взаимоисключающи. */
export type SequenceItem = {
  order: number;
  slug: string;
  duration_sec?: number;
  repetitions?: number;
};

export type WorkoutSequenceRow = {
  id: string;
  slug: string;
  mode: Mode;
  day_of_week: number;
  focus_joint: string;
  intensity: SequenceIntensity;
  exercises_order: SequenceItem[];
  total_duration_min: number;
  created_at: string;
};

export type UserWeekPlanRow = {
  id: string;
  user_id: string;
  mode: Mode;
  day_of_week: number;
  focus: string;
  duration_min: number;
  intensity: Intensity;
  is_rest_day: boolean;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
};

export type CustomExerciseItem = {
  exercise_id: string;
  order: number;
  duration_sec?: number | null;
  repetitions?: number | null;
  rest_sec?: number | null;
};

export type UserCustomWorkoutRow = {
  id: string;
  user_id: string;
  mode: Mode;
  name: string;
  focus: string;
  duration_min: number;
  intensity: Intensity;
  exercises_order: CustomExerciseItem[];
  times_used: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Снимок упражнения на момент генерации тренировки. */
export type ExerciseSnapshot = {
  exercise_id: string;
  slug: string;
  name: string;
  type: ExerciseType;
  target_joint: TargetJoint;
  description: string;
  technique: string;
  gif_url: string | null;
  duration_sec: number | null;
  repetitions: number | null;
  order: number;
  warning?: string | null;
  /** Отдых после упражнения. Нет поля — стандартные 15 секунд. */
  rest_sec?: number | null;
  /** Название упражнения, которое это заменило. */
  replaced?: string | null;
  /** Почему заменили: weekly — тяжело на прошлой неделе, position — недоступное положение, gentle — щадящее для ограниченной зоны. */
  replaced_reason?: "weekly" | "position" | "gentle" | null;
  /** Щадящее для ограниченной зоны — короткое занятие его не отрезает. */
  priority?: boolean;
};

export type UserWorkoutRow = {
  id: string;
  user_id: string;
  mode: Mode;
  scheduled_date: string;
  started_at: string | null;
  completed_at: string | null;
  status: WorkoutStatus;
  generated_from_sequence_id: string | null;
  custom_workout_id: string | null;
  source: WorkoutSource;
  exercises_snapshot: ExerciseSnapshot[];
  created_at: string;
  updated_at: string;
};

export type WorkoutFeedbackRow = {
  id: string;
  user_id: string;
  user_workout_id: string;
  exercise_id: string | null;
  status: FeedbackStatus;
  notes: string | null;
  created_at: string;
};

export type SideEffectEventRow = {
  id: string;
  user_id: string;
  user_workout_id: string | null;
  exercise_id: string | null;
  symptom: Symptom;
  description: string | null;
  action_taken: "continued" | "paused" | "stopped";
  applied_adjustment: string | null;
  reminded_at: string | null;
  created_at: string;
};

export type SideEffectRuleRow = {
  id: string;
  symptom: Symptom;
  conditions: { exercise_type?: ExerciseType; target_joint?: TargetJoint };
  advice: { order: number; text: string }[];
  next_workout_adjustment: NextAdjustment;
  skip_exercise: boolean;
  require_doctor_visit_threshold: number;
  priority: number;
  created_at: string;
};

export type MealIngredient = { product: string; grams: number; kcal: number };

export type MealRow = {
  id: string;
  slug: string;
  name: string;
  meal_type: MealType;
  ingredients: MealIngredient[];
  total_kcal: number;
  total_protein_g: number;
  total_fat_g: number;
  total_carbs_g: number;
  cook_time_min: number;
  recipe: string;
  contraindications: string[];
  category: MealCategory | null;
  created_at: string;
};

export type FeedbackRow = {
  id: string;
  user_id: string;
  type: FeedbackType;
  text: string;
  created_at: string;
};

export type UserMealRow = {
  id: string;
  user_id: string;
  mode: Mode;
  date: string;
  meal_type: MealType;
  meal_id: string;
  consumed: boolean;
  /** Множитель порции (0.5-2.5), миграция 0010. */
  portion: number;
  created_at: string;
};

export type ShoppingListItem = { product: string; grams: number; purchased: boolean };

export type ShoppingListRow = {
  id: string;
  user_id: string;
  mode: Mode;
  week_start_date: string;
  items: ShoppingListItem[];
  created_at: string;
  updated_at: string;
};

export type UserProgressRow = {
  id: string;
  user_id: string;
  date: string;
  weight_kg: number | null;
  shober_test_cm: number | null;
  stiffness_level: number | null;
  workouts_this_week: number;
  streak_days: number;
  created_at: string;
};

export type PersonalReportRow = {
  id: string;
  user_id: string;
  mode: Mode;
  period_number: number;
  period_start: string;
  period_end: string;
  flexibility_change_percent: number | null;
  weight_change_kg: number | null;
  stiffness_change: number | null;
  total_workouts: number;
  custom_workouts: number;
  side_effects_count: number;
  recommendation: string;
  adjustment_applied: string;
  sent_to_telegram: boolean;
  created_at: string;
};

export type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  referral_code: string;
  source: ReferralSource;
  created_at: string;
};

export type ReferralClickRow = {
  id: string;
  referral_code: string;
  source: string;
  user_agent: string | null;
  converted: boolean;
  created_at: string;
};

export type NotificationLogRow = {
  id: string;
  user_id: string;
  type: "morning_reminder" | "evening_reminder" | "personal_report" | "doctor_advice" | "other";
  channel: "telegram" | "push" | "email";
  status: "sent" | "failed";
  error: string | null;
  sent_at: string;
};

/** Одно «домашнее» сообщение бота на чат (0012). */
export type TelegramChatRow = {
  chat_id: number;
  home_message_id: number | null;
  workout_message_ids: number[];
  updated_at: string;
};

/**
 * Почти у всех колонок есть DEFAULT в БД, поэтому при вставке обязателен
 * лишь небольшой набор. Req перечисляет именно его — список выведен
 * из NOT NULL без DEFAULT в миграциях.
 */
type TableDef<Row, Req extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Required<Pick<Row, Req>>;
  Update: Partial<Row>;
  Relationships: [];
};

/** Режим, которым пользователь занимается (0015). is_active=false — только смотрел. */
export type UserModeRow = {
  id: string;
  user_id: string;
  mode: Mode;
  is_active: boolean;
  activated_at: string;
  last_used_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: TableDef<UserRow, "id" | "name" | "mode" | "referral_code">;
      user_diagnostics: TableDef<UserDiagnosticsRow, "user_id" | "calculated_intensity">;
      user_profiles_general: TableDef<
        UserProfileGeneralRow,
        | "user_id"
        | "weight_kg"
        | "height_cm"
        | "goal"
        | "activity_level"
        | "difficulty"
        | "calculated_bmr"
        | "calculated_tdee"
        | "calculated_target_calories"
      >;
      exercises: TableDef<
        ExerciseRow,
        "slug" | "name" | "type" | "target_joint" | "mode" | "description" | "technique"
      >;
      workout_sequences: TableDef<
        WorkoutSequenceRow,
        "slug" | "mode" | "day_of_week" | "focus_joint" | "intensity" | "total_duration_min"
      >;
      user_week_plan: TableDef<
        UserWeekPlanRow,
        "user_id" | "day_of_week" | "focus" | "duration_min" | "intensity"
      >;
      user_custom_workouts: TableDef<
        UserCustomWorkoutRow,
        "user_id" | "name" | "focus" | "duration_min" | "intensity"
      >;
      user_workouts: TableDef<UserWorkoutRow, "user_id">;
      workout_feedback: TableDef<
        WorkoutFeedbackRow,
        "user_id" | "user_workout_id" | "status"
      >;
      side_effect_events: TableDef<SideEffectEventRow, "user_id" | "symptom">;
      side_effect_rules: TableDef<SideEffectRuleRow, "symptom" | "next_workout_adjustment">;
      meals: TableDef<MealRow, "slug" | "name" | "meal_type" | "total_kcal" | "recipe">;
      user_meals: TableDef<UserMealRow, "user_id" | "date" | "meal_type" | "meal_id">;
      shopping_list: TableDef<ShoppingListRow, "user_id" | "week_start_date">;
      user_progress: TableDef<UserProgressRow, "user_id">;
      personal_reports: TableDef<
        PersonalReportRow,
        | "user_id"
        | "period_number"
        | "period_start"
        | "period_end"
        | "recommendation"
        | "adjustment_applied"
      >;
      referrals: TableDef<
        ReferralRow,
        "referrer_id" | "referred_id" | "referral_code" | "source"
      >;
      referral_clicks: TableDef<ReferralClickRow, "referral_code">;
      notifications_log: TableDef<NotificationLogRow, "user_id" | "type" | "status">;
      telegram_chats: TableDef<TelegramChatRow, "chat_id">;
      feedback: TableDef<FeedbackRow, "user_id" | "type" | "text">;
      user_modes: TableDef<UserModeRow, "user_id" | "mode">;
    };
    Views: Record<never, never>;
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
