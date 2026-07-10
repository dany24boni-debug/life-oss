/**
 * Logica pura del modulo Palestra (B2.3) — calcolatori di volume e PR,
 * record nuovi della sessione, matematica wake-safe del timer di
 * recupero, trend per-esercizio. Zero side effect; l'1RM stimato riusa
 * lib/fitness.ts (Brzycki, già testato — NON riscritto).
 *
 * Definizioni (documentate perché "PR" è ambiguo):
 *   - peso massimo: il carico più alto di un singolo set (kg);
 *   - ripetizioni massime: il set con più ripetizioni;
 *   - volume: somma di peso × ripetizioni; il PR di volume è la SESSIONE
 *     col volume totale più alto per quell'esercizio;
 *   - 1RM stimato: Brzycki sul set migliore.
 * I set a corpo libero (weight_kg null) pesano 0 nel volume e non
 * concorrono ai PR di peso/1RM; contano per le ripetizioni.
 */

import { estimateOneRepMax } from "@/lib/fitness";
import type { GymSet } from "@/data/schemas";

/* ── Volume ──────────────────────────────────────────────────────────── */

export function setVolumeKg(set: Pick<GymSet, "weight_kg" | "reps">): number {
  return (set.weight_kg ?? 0) * set.reps;
}

export function totalVolumeKg(sets: readonly GymSet[]): number {
  return sets.reduce((sum, s) => sum + setVolumeKg(s), 0);
}

/* ── PR per esercizio, calcolati dai set al momento della lettura ────── */

export type ExercisePRs = {
  maxWeightKg: number | null;
  maxReps: number | null;
  /** Volume totale della sessione migliore. */
  maxSessionVolumeKg: number | null;
  /** 1RM stimato (Brzycki) del set migliore. */
  best1RmKg: number | null;
};

export function computePRs(sets: readonly GymSet[]): ExercisePRs {
  let maxWeightKg: number | null = null;
  let maxReps: number | null = null;
  let best1RmKg: number | null = null;
  const volumeBySession = new Map<string, number>();

  for (const s of sets) {
    if (s.reps > 0 && (maxReps === null || s.reps > maxReps)) maxReps = s.reps;
    if (s.weight_kg !== null && s.weight_kg > 0) {
      if (maxWeightKg === null || s.weight_kg > maxWeightKg) {
        maxWeightKg = s.weight_kg;
      }
      const rm = estimateOneRepMax(s.weight_kg, s.reps);
      if (rm > 0 && (best1RmKg === null || rm > best1RmKg)) best1RmKg = rm;
    }
    volumeBySession.set(
      s.session_id,
      (volumeBySession.get(s.session_id) ?? 0) + setVolumeKg(s),
    );
  }

  let maxSessionVolumeKg: number | null = null;
  for (const v of volumeBySession.values()) {
    if (v > 0 && (maxSessionVolumeKg === null || v > maxSessionVolumeKg)) {
      maxSessionVolumeKg = v;
    }
  }
  return { maxWeightKg, maxReps, maxSessionVolumeKg, best1RmKg };
}

/* ── Record battuti in una sessione (schermata di fine) ──────────────── */

export type NewRecord = {
  exercise_id: string;
  kind: "peso" | "ripetizioni" | "volume";
  value: number;
};

/**
 * Confronta i set della sessione con TUTTA la storia precedente (set di
 * altre sessioni): un record c'è solo se batte strettamente il passato,
 * e solo se un passato esiste (la prima sessione non è "tutta record").
 */
export function newRecords(
  sessionSets: readonly GymSet[],
  priorSets: readonly GymSet[],
): NewRecord[] {
  const out: NewRecord[] = [];
  const exerciseIds = [...new Set(sessionSets.map((s) => s.exercise_id))];

  for (const exerciseId of exerciseIds) {
    const now = computePRs(
      sessionSets.filter((s) => s.exercise_id === exerciseId),
    );
    const prior = computePRs(
      priorSets.filter((s) => s.exercise_id === exerciseId),
    );
    if (
      prior.maxWeightKg !== null &&
      now.maxWeightKg !== null &&
      now.maxWeightKg > prior.maxWeightKg
    ) {
      out.push({ exercise_id: exerciseId, kind: "peso", value: now.maxWeightKg });
    }
    if (
      prior.maxReps !== null &&
      now.maxReps !== null &&
      now.maxReps > prior.maxReps
    ) {
      out.push({
        exercise_id: exerciseId,
        kind: "ripetizioni",
        value: now.maxReps,
      });
    }
    if (
      prior.maxSessionVolumeKg !== null &&
      now.maxSessionVolumeKg !== null &&
      now.maxSessionVolumeKg > prior.maxSessionVolumeKg
    ) {
      out.push({
        exercise_id: exerciseId,
        kind: "volume",
        value: now.maxSessionVolumeKg,
      });
    }
  }
  return out;
}

/* ── Timer di recupero: matematica wake-safe ─────────────────────────── */

/**
 * Secondi rimanenti: derivati SEMPRE da (adesso − startedAt), mai da un
 * contatore decrementato — un tab addormentato o uno schermo spento non
 * perdono il tempo (B2.3 "elapsed-time correctness in background tabs").
 */
export function restRemainingS(
  startedAtMs: number,
  durationS: number,
  nowMs: number,
): number {
  const elapsed = Math.floor((nowMs - startedAtMs) / 1000);
  return Math.max(0, durationS - elapsed);
}

/** "1:32" per il timer; niente ore (i recuperi stanno sotto i 15 min). */
export function formatRestS(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/* ── Durata sessione e formati ───────────────────────────────────────── */

/** Minuti tra started_at e finished_at; null senza entrambi gli estremi. */
export function sessionDurationMin(
  startedAt: string | null,
  finishedAt: string | null,
): number | null {
  if (!startedAt || !finishedAt) return null;
  const ms = Date.parse(finishedAt) - Date.parse(startedAt);
  if (Number.isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 60_000);
}

/**
 * Formato italiano dei kg: "1.250 kg" (B4), senza decimali spuri.
 * `useGrouping: "always"`: il CLDR italiano raggruppa solo da 10.000
 * (minimumGroupingDigits 2), ma B4 vuole il punto già a quattro cifre.
 */
const KG_FORMAT = new Intl.NumberFormat("it-IT", {
  useGrouping: "always",
} as Intl.NumberFormatOptions);

export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${KG_FORMAT.format(rounded)} kg`;
}

/* ── Trend per-esercizio (sparkline della scheda) ────────────────────── */

export type TrendPoint = { day: string; topWeightKg: number };

/**
 * Miglior carico per giorno (dal set col peso più alto), ordinato per
 * giorno crescente: i punti della sparkline. I set a corpo libero non
 * producono punti. `days` è la mappa session_id → giorno civile.
 */
export function exerciseTrend(
  sets: readonly GymSet[],
  days: ReadonlyMap<string, string>,
): TrendPoint[] {
  const best = new Map<string, number>();
  for (const s of sets) {
    if (s.weight_kg === null || s.weight_kg <= 0) continue;
    const day = days.get(s.session_id);
    if (!day) continue;
    const cur = best.get(day);
    if (cur === undefined || s.weight_kg > cur) best.set(day, s.weight_kg);
  }
  return [...best.entries()]
    .map(([day, topWeightKg]) => ({ day, topWeightKg }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Punti SVG "x,y ..." per una polyline larga `w` e alta `h` (padding 2):
 * asse y scalato tra min e max del trend (piatto = linea a metà).
 */
export function sparklinePath(
  trend: readonly TrendPoint[],
  w: number,
  h: number,
): string {
  if (trend.length === 0) return "";
  const pad = 2;
  const min = Math.min(...trend.map((p) => p.topWeightKg));
  const max = Math.max(...trend.map((p) => p.topWeightKg));
  const span = max - min;
  return trend
    .map((p, i) => {
      const x =
        trend.length === 1
          ? w / 2
          : pad + (i * (w - pad * 2)) / (trend.length - 1);
      const y =
        span === 0
          ? h / 2
          : pad + (h - pad * 2) * (1 - (p.topWeightKg - min) / span);
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}

/* ── Adesso, per i gesti (set fatto, recupero partito) ───────────────── */

/**
 * L'istante del gesto, in entrambe le forme che servono al runner. Vive
 * qui (fuori dai componenti) così i gesti restano puri agli occhi del
 * compilatore React: il valore nasce solo dentro gli event handler.
 */
export function nowInstant(): { ms: number; iso: string } {
  const d = new Date();
  return { ms: d.getTime(), iso: d.toISOString() };
}

/* ── Stepper del peso ────────────────────────────────────────────────── */

/** Passo ±2.5 kg, mai sotto zero; null (corpo libero) parte da 0. */
export function stepWeight(current: number | null, direction: 1 | -1): number {
  const next = (current ?? 0) + direction * 2.5;
  return Math.max(0, Math.round(next * 10) / 10);
}

/** Passo ±1 rep, mai sotto 1 (un set da 0 reps non si logga a mano). */
export function stepReps(current: number, direction: 1 | -1): number {
  return Math.max(1, current + direction);
}
