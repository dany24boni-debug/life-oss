// Phase 1.5 mock data — hardcoded values for the dashboard visual polish pass.
// Phase 2+ replaces these exports with real Supabase queries; the dashboard's
// rendering structure stays identical.

export type StackItem = { emoji: string; text: string };

// ----------------------------------------------------------------------------
// HEADER
// ----------------------------------------------------------------------------

export const MOCK_HEADER = {
  // Generic placeholder — real dashboard reads `profile.display_name`
  // (see app/dashboard/page.tsx) and falls back to this only when
  // the profile row is missing. "Utente" is a neutral string that
  // any user sees if their profile.display_name is null.
  displayName: "Utente",
  // Hardcoded date string, Italian abbreviated. Phase 2 derives from todayInTimezone.
  dateLabel: "Ven, 8 mag",
  state: "Esami" as const,
  stateLabel: "Esami mode",
};

// ----------------------------------------------------------------------------
// HERO RING
// ----------------------------------------------------------------------------

export const MOCK_HERO = {
  value: 81,
  label: "OGGI",
  subtitle: "Tieni il focus",
  color: "good" as const,
};

// ----------------------------------------------------------------------------
// STREAK
// ----------------------------------------------------------------------------

// 14 days, oldest → newest. Two missed days in the middle to feel real.
export const MOCK_STREAK = {
  count: 12,
  best: 18,
  history: [
    true, true, true, false, true, true, true,
    true, true, false, true, true, true, true,
  ],
};

// ----------------------------------------------------------------------------
// STAT GRID
// ----------------------------------------------------------------------------

export const MOCK_STATS = {
  monthly: {
    label: "MENSILE",
    value: "380€",
    unit: "/700€",
    subtitle: "Business",
    status: "warn" as const,
    trend: [120, 160, 190, 220, 250, 280, 310, 320, 340, 350, 360, 370, 375, 380],
  },
  weekly: {
    label: "SETTIMANA",
    value: "18",
    unit: "/24",
    subtitle: "in linea",
    status: "good" as const,
    trend: [60, 65, 72, 70, 75, 80, 75],
  },
  exams: {
    label: "ESAMI",
    value: "47",
    unit: "giorni",
    subtitle: "al prossimo esame",
    status: "warn" as const,
  },
  studyHours: {
    label: "STUDIO",
    value: "4.5",
    unit: "h",
    subtitle: "obiettivo 6h",
    status: "warn" as const,
  },
};

// ----------------------------------------------------------------------------
// DAILY STACK
// ----------------------------------------------------------------------------

export const MOCK_DAILY_STACK: Record<
  "morning" | "lunch" | "evening",
  { label: string; items: StackItem[]; initiallyChecked: boolean[] }
> = {
  morning: {
    label: "MATTINA",
    items: [
      { emoji: "💧", text: "2L acqua avviata" },
      { emoji: "💊", text: "Creatina 5g" },
      { emoji: "📱", text: "1 post business" },
      { emoji: "💻", text: "30 min dev session" },
    ],
    initiallyChecked: [false, true, false, false],
  },
  lunch: {
    label: "PRANZO",
    items: [
      { emoji: "🥗", text: "Pranzo proteico" },
      { emoji: "🚰", text: "Hydration check" },
    ],
    initiallyChecked: [false, false],
  },
  evening: {
    label: "SERA",
    items: [
      { emoji: "📚", text: "Wind-down + journal" },
    ],
    initiallyChecked: [false],
  },
};

// ----------------------------------------------------------------------------
// HEAVY TASKS
// ----------------------------------------------------------------------------

export const MOCK_HEAVY_TASKS: Array<{ id: string; emoji: string; text: string }> = [
  { id: "h1", emoji: "📚", text: "Blocco studio · 3h" },
  { id: "h2", emoji: "📖", text: "Ripasso · 1h" },
  { id: "h3", emoji: "💪", text: "Allenamento · 1h20m" },
];

// ----------------------------------------------------------------------------
// WHY (long-term goals)
// ----------------------------------------------------------------------------

// Generic placeholder goals — real WHY panel pulls from
// `user_long_term_goals` (see app/dashboard or /more pages).
// These are visible only in the static mock-render path until
// real goals exist.
export const MOCK_WHY: Array<{ text: string }> = [
  { text: "Vivere bene e in salute" },
  { text: "Stabilità finanziaria nei prossimi 2 anni" },
  { text: "Completare la formazione/laurea" },
  { text: "Mantenere abitudini sportive regolari" },
];

// ----------------------------------------------------------------------------
// Helpers shared with other parts of the app.
// ----------------------------------------------------------------------------

// Back-compat with the previous pass (reused on dashboard, gym, health, etc.).
export const DAILY_STACK_PRESETS = {
  morning: MOCK_DAILY_STACK.morning.items,
  lunch: MOCK_DAILY_STACK.lunch.items,
  evening: MOCK_DAILY_STACK.evening.items,
};

export function placeholderSparkline(length = 14, min = 30, max = 90): number[] {
  const out: number[] = [];
  let prev = (min + max) / 2;
  for (let i = 0; i < length; i++) {
    const drift = Math.sin(i * 1.1) * (max - min) * 0.18;
    const noise = (Math.cos(i * 2.3) - 0.5) * 6;
    prev = Math.max(min, Math.min(max, prev + drift * 0.2 + noise * 0.3));
    out.push(Math.round(prev));
  }
  return out;
}

export const MODULE_EMOJI: Record<string, string> = {
  studio: "📚",
  gym: "💪",
  health: "💧",
  finance: "💶",
  chameleon_os: "🦎",
  general: "✨",
};

export function emojiForModule(moduleSlug: string): string {
  if (moduleSlug.startsWith("custom:")) return "✨";
  return MODULE_EMOJI[moduleSlug] ?? "○";
}
