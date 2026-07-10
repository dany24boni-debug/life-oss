// Shared types — Pulse-flavoured insight labels live alongside the existing
// lowercase tokens (good/warn/bad/info/energy). Pulse labels are uppercase
// (WIN/PUSH/WATCH/RECOVER/INFO). Both are first-class — bridges live below.

// ----------------------------------------------------------------------------
// Modules
// ----------------------------------------------------------------------------

// Internal module slugs. Custom modules use a `custom:<uuid>` namespace and
// fall through to `custom` for tone/icon lookup.
export type ModuleKey =
  | "gym"
  | "health"
  | "finance"
  | "chameleon_os"
  | "studio"
  | "general"
  | "voglia"
  | "state"
  | "mood"
  | "onboarding"
  | "custom";

// Module → tone convention from README.md "Mappa moduli → colore".
// Used by Timeline event stripes, Pulse module dots, etc.
export const MODULE_TONE: Record<ModuleKey, ToneKey> = {
  gym: "bad",
  finance: "good",
  chameleon_os: "info", // closest existing tone; UI uses --color-module-violet directly
  mood: "energy",
  state: "info",
  studio: "info",
  general: "info",
  voglia: "energy",
  onboarding: "info",
  custom: "info",
  health: "good",
};

// ----------------------------------------------------------------------------
// Tones
// ----------------------------------------------------------------------------

export type ToneKey = "energy" | "good" | "warn" | "bad" | "info";

// Pulse-flavoured insight labels — used purely as a display label on the
// InsightToneCard. The detector functions in lib/insights/compute.ts emit
// ToneKey; pulseTone() converts at render time.
export type PulseInsightTone = "WIN" | "PUSH" | "WATCH" | "RECOVER" | "INFO";

const TONE_TO_PULSE: Record<ToneKey, PulseInsightTone> = {
  good: "WIN",
  energy: "PUSH",
  warn: "WATCH",
  bad: "RECOVER",
  info: "INFO",
};

const PULSE_TO_TONE: Record<PulseInsightTone, ToneKey> = {
  WIN: "good",
  PUSH: "energy",
  WATCH: "warn",
  RECOVER: "bad",
  INFO: "info",
};

export function toPulseTone(tone: ToneKey): PulseInsightTone {
  return TONE_TO_PULSE[tone];
}

export function fromPulseTone(label: PulseInsightTone): ToneKey {
  return PULSE_TO_TONE[label];
}

// ----------------------------------------------------------------------------
// Insight evidence — typed union for the InsightToneCard renderer
// ----------------------------------------------------------------------------

export type InsightEvidence =
  | { kind: "streakBars"; values: number[] }
  | { kind: "progressDots"; current: number; target: number }
  | { kind: "weekdayBars"; days: { d: string; v: number; hi?: boolean }[] }
  | { kind: "sleepDots"; nights: (number | null)[] }
  | { kind: "scatter"; points: [number, number][]; threshold?: number };

export type InsightEvidenceKind = InsightEvidence["kind"];

// ----------------------------------------------------------------------------
// Today's Call (handoff TodaysCall + existing voglia stub)
// ----------------------------------------------------------------------------

export type CallTone = "GREEN" | "YELLOW" | "RED" | "RECUPERO" | "VACANZA";

export type TodaysCallView = {
  tone: CallTone;
  text: string;             // 1–2 lines, max ~140 char
  source?: string;          // e.g. "Stub · 8:24" or "Claude · 8:24"
  generatedAt?: string;     // ISO
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// Extracts the canonical module slug from a daily_tasks.module string,
// stripping the "custom:<uuid>" prefix used by generated tasks for custom
// modules. Returns "custom" for any namespaced custom module.
export function moduleSlugBase(moduleSlug: string): ModuleKey {
  if (moduleSlug?.startsWith?.("custom:")) return "custom";
  if (isModuleKey(moduleSlug)) return moduleSlug;
  return "custom";
}

function isModuleKey(s: string): s is ModuleKey {
  return [
    "gym",
    "health",
    "finance",
    "chameleon_os",
    "studio",
    "general",
    "voglia",
    "state",
    "mood",
    "onboarding",
    "custom",
  ].includes(s);
}
