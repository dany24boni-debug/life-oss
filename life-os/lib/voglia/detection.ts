// Voglia Engine — Layer B (silent observer).
// Pure detection logic. Inputs are pre-aggregated; no DB access here.

export type DetectionSignal = {
  // Ratio of tasks completed in the last 2 days. 0..1.
  completionRate2Day: number;
  // Count of LIGHT tasks NOT completed across the last 3 days.
  lightSkipPattern: number;
  // Average mood (1-5) from mood_entries over the last 3 days. null if no entries.
  moodSliderAvg3Day: number | null;
};

export type SlipReason = "completion_low" | "light_skipped" | "mood_low";

export function detectSlip(s: DetectionSignal): SlipReason | null {
  if (s.completionRate2Day < 0.5) return "completion_low";
  if (s.lightSkipPattern >= 5) return "light_skipped";
  if (s.moodSliderAvg3Day !== null && s.moodSliderAvg3Day <= 2) return "mood_low";
  return null;
}

export const SLIP_REASON_LABEL: Record<SlipReason, string> = {
  completion_low: "Sei in calo da 2 giorni — meno della metà dei task chiusi.",
  light_skipped: "Stai saltando i LIGHT — la catena base è interrotta.",
  mood_low: "Mood basso da 3 giorni di fila.",
};
