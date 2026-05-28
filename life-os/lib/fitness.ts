// Estimated 1-rep max via Brzycki formula. Reasonable up to ~10 reps.
// 1RM = weight × (36 / (37 - reps))
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return weightKg;
  return weightKg * (36 / (37 - reps));
}
