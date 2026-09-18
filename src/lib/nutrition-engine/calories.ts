/** Расчёт калорий по Миффлину-Сан-Жеору (SPEC 5.1). */

export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  light: 1.375,
  medium: 1.55,
  high: 1.725,
  very_high: 1.9,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_MULTIPLIERS;
export type Goal = "lose" | "gain" | "maintain";

export function calculateBMR(
  gender: "male" | "female",
  weightKg: number,
  heightCm: number,
  ageYears: number,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return Math.round(gender === "male" ? base + 5 : base - 161);
}

export function calculateTDEE(bmr: number, activity: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activity]);
}

export function calculateTargetCalories(tdee: number, goal: Goal): number {
  if (goal === "lose") return Math.round(tdee * 0.8);
  if (goal === "gain") return Math.round(tdee * 1.15);
  return tdee;
}

export function calculateAll(input: {
  gender: "male" | "female";
  weightKg: number;
  heightCm: number;
  ageYears: number;
  activity: ActivityLevel;
  goal: Goal;
}) {
  const bmr = calculateBMR(input.gender, input.weightKg, input.heightCm, input.ageYears);
  const tdee = calculateTDEE(bmr, input.activity);
  const target = calculateTargetCalories(tdee, input.goal);
  return { bmr, tdee, target };
}

/** Возраст в полных годах по дате рождения. */
export function ageFromBirthDate(birthDate: string | Date): number {
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
