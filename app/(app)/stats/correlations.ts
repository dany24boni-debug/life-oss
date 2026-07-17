/**
 * Correlazioni native (run-12, PROP-stats-03/CROSS-06) — logica pura,
 * ricostruita nei moduli correnti: il legacy Insights resta congelato.
 * NIENTE p-value theater: ogni carta è un confronto di MEDIE tra due
 * gruppi di giorni (split binario), con la n dichiarata e una soglia
 * minima onesta per gruppo sotto cui la carta dice "ancora pochi dati".
 * Solo dati che il modello corrente persiste: allenamenti, abitudini,
 * focus, task, dieta, peso, energia di Sera.
 */

import { shiftDay } from "@/data/streak";
import { weekOf, type DayString } from "@/ui/calendar-core";

/** Finestra delle correlazioni: 60 giorni CONCLUSI (oggi escluso —
 *  un giorno a metà falserebbe le medie). */
export function correlationWindow(today: DayString): {
  from: DayString;
  to: DayString;
} {
  const to = shiftDay(today, -1);
  return { from: shiftDay(to, -59), to };
}

/** Sotto questa taglia PER GRUPPO la carta non parla. */
export const MIN_BUCKET = 5;

export type SplitComparison = {
  n: number;
  nA: number;
  nB: number;
  meanA: number;
  meanB: number;
  /** meanA − meanB: il segno È la direzione. */
  diff: number;
};

export function splitComparison(
  samples: ReadonlyArray<{ inA: boolean; value: number }>,
  minPerBucket = MIN_BUCKET,
): SplitComparison | null {
  const a: number[] = [];
  const b: number[] = [];
  for (const s of samples) (s.inA ? a : b).push(s.value);
  if (a.length < minPerBucket || b.length < minPerBucket) return null;
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const meanA = mean(a);
  const meanB = mean(b);
  return {
    n: samples.length,
    nA: a.length,
    nB: b.length,
    meanA,
    meanB,
    diff: meanA - meanB,
  };
}

/** Una carta pronta: la frase in linguaggio piano e la n. */
export type CorrelationLine = { line: string; n: number };

const DEC1 = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const KG_SIGNED = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
} as Intl.NumberFormatOptions);

/* ── 1 · Giorni di allenamento × completamento abitudini ─────────────── */

export function trainingHabitsLine(
  habitDays: ReadonlyArray<{ date: DayString; scheduled: number; done: number }>,
  trainedDays: ReadonlySet<DayString>,
): CorrelationLine | null {
  const c = splitComparison(
    habitDays.map((d) => ({
      inA: trainedDays.has(d.date),
      value: (d.done / d.scheduled) * 100,
    })),
  );
  if (c === null) return null;
  const pp = Math.round(Math.abs(c.diff));
  const line =
    pp < 1
      ? `Con o senza allenamento le abitudini vanno uguali — su ${c.n} giorni.`
      : `Nei giorni di allenamento completi il ${pp}% di abitudini in ${
          c.diff > 0 ? "più" : "meno"
        } — su ${c.n} giorni.`;
  return { line, n: c.n };
}

/* ── 2 · Minuti di focus × task chiusi ───────────────────────────────── */

export function focusTasksLine(
  days: ReadonlyArray<DayString>,
  doneByDay: ReadonlyMap<DayString, number>,
  focusMinByDay: ReadonlyMap<DayString, number>,
): CorrelationLine | null {
  const c = splitComparison(
    days.map((d) => ({
      inA: (focusMinByDay.get(d) ?? 0) > 0,
      value: doneByDay.get(d) ?? 0,
    })),
  );
  if (c === null) return null;
  const line =
    Math.abs(c.diff) < 0.15
      ? `Focus o no, chiudi in media gli stessi task — su ${c.n} giorni.`
      : `Nei giorni con almeno un focus chiudi in media ${DEC1.format(c.meanA)} task, senza ${DEC1.format(c.meanB)} — su ${c.n} giorni.`;
  return { line, n: c.n };
}

/* ── 3 · Energia di Sera × task chiusi ───────────────────────────────── */

export function energyTasksLine(
  checkins: ReadonlyArray<{ date: DayString; energy: number }>,
  doneByDay: ReadonlyMap<DayString, number>,
): CorrelationLine | null {
  const c = splitComparison(
    checkins.map((k) => ({
      inA: k.energy >= 4,
      value: doneByDay.get(k.date) ?? 0,
    })),
  );
  if (c === null) return null;
  const line =
    Math.abs(c.diff) < 0.15
      ? `Energia alta o bassa, i task chiusi non cambiano — su ${c.n} serate.`
      : `Nelle giornate chiuse con energia alta (4–5) hai fatto in media ${DEC1.format(c.meanA)} task, nelle altre ${DEC1.format(c.meanB)} — su ${c.n} serate.`;
  return { line, n: c.n };
}

/* ── 4 · Aderenza dieta × andamento peso (per settimana) ─────────────── */

/**
 * Settimane ISO qualificate: ≥4 giorni loggati E ≥2 pesate (delta =
 * ultima − prima della settimana). "La dieta tiene" = ≥70% dei giorni
 * loggati dentro il ±10% del target kcal CORRENTE (semplificazione
 * dichiarata: il target storico non viene ricostruito). Gruppi minimi:
 * 3 settimane l'uno.
 */
export function dietWeightLine(
  consumed: ReadonlyArray<{ date: DayString; kcal: number }>,
  weights: ReadonlyArray<{ date: DayString; weight_kg: number }>,
  kcalTarget: number | null,
): CorrelationLine | null {
  if (kcalTarget === null || kcalTarget <= 0) return null;

  type Week = { logged: number; adherent: number; kgs: Array<{ date: DayString; kg: number }> };
  const weeks = new Map<DayString, Week>();
  const weekKey = (d: DayString) => weekOf(d)[0];
  for (const c of consumed) {
    const k = weekKey(c.date);
    const w = weeks.get(k) ?? { logged: 0, adherent: 0, kgs: [] };
    w.logged += 1;
    if (Math.abs(c.kcal - kcalTarget) <= kcalTarget * 0.1) w.adherent += 1;
    weeks.set(k, w);
  }
  for (const b of weights) {
    const k = weekKey(b.date);
    const w = weeks.get(k) ?? { logged: 0, adherent: 0, kgs: [] };
    w.kgs.push({ date: b.date, kg: b.weight_kg });
    weeks.set(k, w);
  }

  const samples: Array<{ inA: boolean; value: number }> = [];
  for (const w of weeks.values()) {
    if (w.logged < 4 || w.kgs.length < 2) continue;
    w.kgs.sort((a, b) => a.date.localeCompare(b.date));
    const delta = w.kgs[w.kgs.length - 1].kg - w.kgs[0].kg;
    samples.push({ inA: w.adherent / w.logged >= 0.7, value: delta });
  }

  const c = splitComparison(samples, 3);
  if (c === null) return null;
  return {
    line: `Nelle settimane in cui la dieta tiene (±10% per ≥70% dei giorni) il peso si muove in media di ${KG_SIGNED.format(c.meanA)} kg, nelle altre ${KG_SIGNED.format(c.meanB)} — su ${c.n} settimane.`,
    n: c.n,
  };
}
