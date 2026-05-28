// Pure-logic insight detectors over user_events + raw module data.
// Each function takes a structured input (already fetched by the caller)
// and returns 0..N InsightCandidate. The caller persists the survivors
// into user_insights via persistInsights(). No DB access in this file.

import type { InsightEvidence, ToneKey } from "@/lib/types";

// Re-export ToneKey under the historical name so existing callers/tests
// don't need to change. New callers should import ToneKey from lib/types.
export type InsightTone = ToneKey;

export type InsightCandidate = {
  kind: string;
  headline: string;
  detail?: string;
  tone: InsightTone;
  confidence: number; // 0-1
  periodStart?: string; // YYYY-MM-DD
  periodEnd?: string;
  // Free-form evidence — historical shape, used by current detectors. Persisted
  // into user_insights.evidence (jsonb) as-is.
  evidence?: Record<string, unknown>;
  // Pulse-aligned typed evidence (see lib/types.ts InsightEvidence). New
  // detectors populate this; UI in /insights renders via Evidence/*. When
  // both are set, evidenceTyped takes precedence at render time.
  evidenceTyped?: InsightEvidence;
};

// ----------------------------------------------------------------------------
// Weekly rhythm — which day of the week the user completes the most tasks.
// ----------------------------------------------------------------------------
export type WeeklyRhythmInput = {
  // Each row = one task on a date with a completion flag. Last 28+ days.
  tasks: Array<{ date: string; completed: boolean }>;
};

const WEEKDAY_LABELS = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];

export function computeWeeklyRhythm(i: WeeklyRhythmInput): InsightCandidate | null {
  if (i.tasks.length < 14) return null; // need at least 2 weeks of signal

  const stats: { total: number; done: number }[] = Array.from({ length: 7 }, () => ({
    total: 0,
    done: 0,
  }));
  for (const t of i.tasks) {
    const d = new Date(t.date + "T00:00:00Z");
    const dow = d.getUTCDay(); // 0=Sun..6=Sat
    stats[dow].total += 1;
    if (t.completed) stats[dow].done += 1;
  }

  const rates = stats.map((s, dowIdx) => ({
    dow: dowIdx,
    rate: s.total > 0 ? s.done / s.total : 0,
    total: s.total,
  }));

  const meaningful = rates.filter((r) => r.total >= 2);
  if (meaningful.length < 4) return null;

  meaningful.sort((a, b) => b.rate - a.rate);
  const best = meaningful[0];
  const worst = meaningful[meaningful.length - 1];
  const delta = best.rate - worst.rate;
  if (delta < 0.15) return null; // flat profile, not interesting

  // Evidence: 7-bar histogram with the best day flagged hi=true.
  // Reorder rates from Mon..Sun (ISO) for display.
  const isoOrder = [1, 2, 3, 4, 5, 6, 0];
  const dowAbbr = ["DOM", "LUN", "MAR", "MER", "GIO", "VEN", "SAB"];
  const days = isoOrder.map((d) => ({
    d: dowAbbr[d],
    v: rates[d].rate * 100,
    hi: d === best.dow,
  }));

  return {
    kind: "weekly_rhythm",
    headline: `${WEEKDAY_LABELS[best.dow]} è il tuo giorno migliore`,
    detail: `Completi il ${Math.round(best.rate * 100)}% dei task il ${WEEKDAY_LABELS[best.dow].toLowerCase()}, vs ${Math.round(worst.rate * 100)}% il ${WEEKDAY_LABELS[worst.dow].toLowerCase()}.`,
    tone: "info",
    confidence: Math.min(0.9, 0.5 + delta),
    evidence: { perDow: rates },
    evidenceTyped: { kind: "weekdayBars", days },
  };
}

// ----------------------------------------------------------------------------
// Sleep × completion correlation — whether sleep ≥7h boosts daily completion.
// ----------------------------------------------------------------------------
export type SleepCorrelationInput = {
  // Last ~30 days. One row per day with sleep hours + completion rate.
  days: Array<{ date: string; sleepHours: number | null; completionRate: number; total: number }>;
};

export function computeSleepCorrelation(i: SleepCorrelationInput): InsightCandidate | null {
  const withBoth = i.days.filter((d) => d.sleepHours !== null && d.total > 0);
  if (withBoth.length < 7) return null;

  const high = withBoth.filter((d) => (d.sleepHours ?? 0) >= 7);
  const low = withBoth.filter((d) => (d.sleepHours ?? 0) < 7);
  if (high.length < 3 || low.length < 3) return null;

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const hiRate = avg(high.map((d) => d.completionRate));
  const loRate = avg(low.map((d) => d.completionRate));
  const delta = hiRate - loRate;

  if (Math.abs(delta) < 0.08) return null;

  const positive = delta > 0;

  // Evidence: scatter (sleep hours x completion %) with threshold at 7h.
  const points: [number, number][] = withBoth.map((d) => [
    d.sleepHours ?? 0,
    d.completionRate * 100,
  ]);

  return {
    kind: "sleep_completion_corr",
    headline: positive
      ? `Dormi 7h+ → completi il ${Math.round(delta * 100)}% in più`
      : `Dormi meno di 7h ma comunque completi`,
    detail: positive
      ? `${Math.round(hiRate * 100)}% completion media le notti da 7h+, vs ${Math.round(loRate * 100)}% sotto le 7h.`
      : `Sopra 7h ${Math.round(hiRate * 100)}%, sotto ${Math.round(loRate * 100)}%. Il sonno non è il leverage qui.`,
    tone: positive ? "good" : "info",
    confidence: Math.min(0.9, 0.4 + Math.abs(delta) * 2),
    evidence: { highSleepRate: hiRate, lowSleepRate: loRate, n_high: high.length, n_low: low.length },
    evidenceTyped: { kind: "scatter", points, threshold: 7 },
  };
}

// ----------------------------------------------------------------------------
// Streak record approach — flags when the current streak is within 2 of best.
// ----------------------------------------------------------------------------
export type StreakRecordInput = {
  current: number;
  best: number;
};

export function computeStreakRecordApproach(i: StreakRecordInput): InsightCandidate | null {
  if (i.best <= 2) return null;
  const gap = i.best - i.current;
  if (gap < 0) {
    return {
      kind: "streak_record_approach",
      headline: `Nuovo record: ${i.current} giorni 🔥`,
      detail: `Hai superato il tuo record precedente di ${i.best}. Tienilo.`,
      tone: "good",
      confidence: 0.95,
      evidence: { current: i.current, best: i.best },
    };
  }
  if (gap === 0) {
    return {
      kind: "streak_record_approach",
      headline: `Sei al tuo record di ${i.best} giorni`,
      detail: "Domani lo superi. Tieni i LIGHT.",
      tone: "energy",
      confidence: 0.9,
      evidence: { current: i.current, best: i.best },
    };
  }
  if (gap <= 2 && i.current > 0) {
    return {
      kind: "streak_record_approach",
      headline: `${gap} giorno${gap > 1 ? "i" : ""} al record (${i.best})`,
      detail: `Sei a ${i.current}. ${gap} giorno${gap > 1 ? "i" : ""} di LIGHT chiusi e batti il personal best.`,
      tone: "energy",
      confidence: 0.8,
      evidence: { current: i.current, best: i.best },
    };
  }
  return null;
}

// ----------------------------------------------------------------------------
// Monthly target trajectory — at this pace, will the user hit / miss / crush
// each monthly target?
// ----------------------------------------------------------------------------
export type TargetTrajectoryInput = {
  targets: Array<{ module: string; metric: string; current: number; target: number }>;
  dayOfMonth: number; // 1..31
  daysInMonth: number;
};

export function computeTargetTrajectories(i: TargetTrajectoryInput): InsightCandidate[] {
  const out: InsightCandidate[] = [];
  if (i.targets.length === 0 || i.dayOfMonth < 5) return out;
  // Guard against malformed daysInMonth — types declare `number` but the
  // domain is 28..31. A 0 here would yield Infinity ratios and emit spurious
  // "rischio di mancarlo" insights.
  if (i.daysInMonth < 1 || i.dayOfMonth > i.daysInMonth) return out;

  for (const t of i.targets) {
    if (t.target <= 0) continue;
    const expectedNow = (t.target * i.dayOfMonth) / i.daysInMonth;
    const ratio = t.current / expectedNow;
    const projected = (t.current * i.daysInMonth) / i.dayOfMonth;
    const projectedPct = Math.round((projected / t.target) * 100);

    let headline: string;
    let tone: InsightTone;
    if (ratio < 0.6) {
      headline = `${t.module} ${t.metric}: rischio di mancarlo`;
      tone = "bad";
    } else if (ratio < 0.9) {
      headline = `${t.module} ${t.metric}: sotto il passo`;
      tone = "warn";
    } else if (ratio > 1.2) {
      headline = `${t.module} ${t.metric}: stai sopra al passo`;
      tone = "good";
    } else {
      continue; // ~on pace, not interesting
    }

    out.push({
      kind: "target_trajectory",
      headline,
      detail: `${Math.round(t.current)}/${Math.round(t.target)} a giorno ${i.dayOfMonth}/${i.daysInMonth}. A questo ritmo chiudi a ${projectedPct}% del target.`,
      tone,
      confidence: 0.7 + Math.min(0.2, (i.dayOfMonth / i.daysInMonth) * 0.3),
      evidence: {
        module: t.module,
        metric: t.metric,
        current: t.current,
        target: t.target,
        projected,
      },
      evidenceTyped: {
        kind: "progressDots",
        current: t.current,
        target: t.target,
      },
    });
  }
  return out;
}

// ----------------------------------------------------------------------------
// Top exercise PR — flags any exercise where today's est. 1RM is the user's
// new personal best.
// ----------------------------------------------------------------------------
export type RecentPRInput = {
  // All workouts ordered by date desc, with computed est_1rm.
  workouts: Array<{ exercise: string; date: string; est1rm: number }>;
};

export function computeRecentPRs(i: RecentPRInput): InsightCandidate[] {
  if (i.workouts.length === 0) return [];

  // Best per exercise across full history.
  const bestEver = new Map<string, number>();
  for (const w of i.workouts) {
    const cur = bestEver.get(w.exercise) ?? 0;
    if (w.est1rm > cur) bestEver.set(w.exercise, w.est1rm);
  }

  // Recent 7-day PRs: an exercise where the all-time best date is within last 7 days.
  const today = i.workouts[0]?.date;
  if (!today) return [];
  const sevenDaysAgo = (() => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();

  const recentBest = new Map<string, { est1rm: number; date: string }>();
  for (const w of i.workouts) {
    if (w.date < sevenDaysAgo) continue;
    const cur = recentBest.get(w.exercise);
    if (!cur || w.est1rm > cur.est1rm) recentBest.set(w.exercise, { est1rm: w.est1rm, date: w.date });
  }

  const out: InsightCandidate[] = [];
  for (const [exercise, recent] of recentBest) {
    const allTime = bestEver.get(exercise) ?? 0;
    if (recent.est1rm >= allTime - 0.01) {
      // Recent best matches all-time best → it's a PR (or tie).
      out.push({
        kind: "recent_pr",
        headline: `PR ${exercise}: ${Math.round(recent.est1rm)} kg stimati`,
        detail: `Tuo nuovo massimo stimato. Registrato il ${recent.date}.`,
        tone: "good",
        confidence: 0.85,
        evidence: { exercise, est1rm: recent.est1rm, date: recent.date },
      });
    }
  }
  return out;
}

// ----------------------------------------------------------------------------
// Module activity heat — which module the user has touched the most this week.
// ----------------------------------------------------------------------------
export type ModuleHeatInput = {
  events: Array<{ module: string; occurredAt: string }>;
  weekStart: string; // YYYY-MM-DD
};

export function computeModuleHeat(i: ModuleHeatInput): InsightCandidate | null {
  const since = i.weekStart;
  const recent = i.events.filter((e) => e.occurredAt.slice(0, 10) >= since);
  if (recent.length < 5) return null;

  const counts = new Map<string, number>();
  for (const e of recent) counts.set(e.module, (counts.get(e.module) ?? 0) + 1);

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const [topMod, topCount] = ranked[0];
  if (topCount < 3) return null;

  const labels: Record<string, string> = {
    gym: "Gym",
    health: "Health",
    finance: "Finance",
    chameleon_os: "Chameleon OS",
    studio: "Studio",
    voglia: "Voglia",
    state: "Stato",
    mood: "Mood",
  };
  const label = labels[topMod] ?? (topMod.startsWith("custom:") ? "Custom" : topMod);

  return {
    kind: "module_heat_week",
    headline: `${label} è il modulo più caldo della settimana`,
    detail: `${topCount} eventi registrati. Secondo: ${
      ranked[1] ? `${labels[ranked[1][0]] ?? ranked[1][0]} (${ranked[1][1]})` : "—"
    }.`,
    tone: "info",
    confidence: 0.7,
    periodStart: since,
    evidence: { ranked: ranked.slice(0, 5) },
  };
}
