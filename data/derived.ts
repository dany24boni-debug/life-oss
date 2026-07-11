/**
 * Stime derivate dal profilo (run-07 prompt 4) — pure, testate contro
 * valori noti, ESPORTATE per il run-08 (acqua e nutrizione).
 *
 * Sono STIME, non prescrizioni (la copy della UI lo dice): formule
 * standard di popolazione applicate a quattro numeri di profilo.
 *   - Acqua: ~35 ml per kg di peso, clampata 1500..4000 ml.
 *   - Calorie: Mifflin-St Jeor → TDEE (fattori di attività 1..5) →
 *     obiettivo (deficit −500 / mantenimento / surplus +300),
 *     arrotondato ai 10 kcal.
 * Ogni funzione restituisce null quando manca un pezzo del profilo:
 * mai numeri inventati.
 */

import type { Sex } from "./schemas";

/** ~35 ml/kg, clamp 1500..4000. */
export function waterTargetMl(weightKg: number | null): number | null {
  if (weightKg === null || weightKg <= 0) return null;
  return Math.round(Math.max(1500, Math.min(4000, weightKg * 35)));
}

/** Età (approssimata all'anno civile: basta per una stima onesta). */
export function ageFromBirthYear(
  birthYear: number | null,
  todayYear: number,
): number | null {
  if (birthYear === null) return null;
  const age = todayYear - birthYear;
  return age >= 0 && age <= 120 ? age : null;
}

/** Mifflin-St Jeor: 10·kg + 6,25·cm − 5·anni + (m: +5 · f: −161). */
export function bmrMifflinKcal(input: {
  weightKg: number | null;
  heightCm: number | null;
  ageYears: number | null;
  sex: Sex | null;
}): number | null {
  const { weightKg, heightCm, ageYears, sex } = input;
  if (
    weightKg === null ||
    heightCm === null ||
    ageYears === null ||
    sex === null
  ) {
    return null;
  }
  return (
    10 * weightKg + 6.25 * heightCm - 5 * ageYears + (sex === "m" ? 5 : -161)
  );
}

/** Fattori TDEE per livello di attività 1..5 (sedentario → atleta). */
export const ACTIVITY_FACTORS = [1.2, 1.375, 1.55, 1.725, 1.9] as const;

export type CalorieGoal = "deficit" | "maintain" | "surplus";

const GOAL_DELTA: Record<CalorieGoal, number> = {
  deficit: -500,
  maintain: 0,
  surplus: 300,
};

export type CalorieProfile = {
  weightKg: number | null;
  heightCm: number | null;
  birthYear: number | null;
  sex: Sex | null;
  /** 1..5; fuori dominio o null = nessuna stima. */
  activityLevel: number | null;
};

/**
 * kcal/dì per l'obiettivo, o null se manca un pezzo del profilo.
 * Arrotondate ai 10; mai sotto le 1200 (un deficit più aggressivo non è
 * una stima onesta da mostrare).
 */
export function calorieTargetKcal(
  profile: CalorieProfile,
  todayYear: number,
  goal: CalorieGoal,
): number | null {
  const bmr = bmrMifflinKcal({
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    ageYears: ageFromBirthYear(profile.birthYear, todayYear),
    sex: profile.sex,
  });
  if (bmr === null) return null;
  const level = profile.activityLevel;
  if (level === null || level < 1 || level > 5) return null;
  const tdee = bmr * ACTIVITY_FACTORS[level - 1];
  const target = tdee + GOAL_DELTA[goal];
  return Math.max(1200, Math.round(target / 10) * 10);
}

/**
 * Forza relativa: e1RM / peso corporeo del giorno della seduta (la riga
 * "Forza Rel." del foglio Progressi). Null quando manca uno dei due.
 */
export function relativeStrength(
  e1rmKg: number | null,
  bodyweightKg: number | null,
): number | null {
  if (e1rmKg === null || bodyweightKg === null || bodyweightKg <= 0) {
    return null;
  }
  return Math.round((e1rmKg / bodyweightKg) * 100) / 100;
}
