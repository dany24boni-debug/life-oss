/**
 * Logica PURA del rituale del mattino (run-11 P2) — niente React,
 * niente storage: candidati al rollover, passi del flusso, matematica
 * di capacità (stime vs tempo libero dall'agenda). Import SOLO dal
 * corpo lazy della card: lo stato per-giorno che serve anche alla shell
 * vive in `ritual-state.ts`. Tutto testato in `ritual-logic.test.ts`.
 */

import type { Task } from "@/data/schemas";
import type { AgendaItem } from "../../calendar/agenda";

/* ── Passi del flusso ────────────────────────────────────────────────── */

export type RitualStepKey = "rollover" | "lista" | "ordine" | "capacita";

/**
 * I passi disponibili dato lo stato del giorno: il rollover esiste solo
 * se ci sono task arretrati da decidere; l'ordine ha senso solo con
 * almeno due task aperti. Lista e capacità ci sono sempre (la lista
 * vuota è un invito onesto, la capacità mostra il tempo libero).
 */
export function ritualSteps(
  rolloverCount: number,
  openTodayCount: number,
): RitualStepKey[] {
  const steps: RitualStepKey[] = [];
  if (rolloverCount > 0) steps.push("rollover");
  steps.push("lista");
  if (openTodayCount >= 2) steps.push("ordine");
  steps.push("capacita");
  return steps;
}

/* ── Rollover ────────────────────────────────────────────────────────── */

/**
 * I candidati ancora da decidere: gli arretrati meno quelli "lasciati"
 * in questa sessione del rituale (lasciare non tocca i dati — il task
 * resta In ritardo su /tasks, solo il rituale smette di chiederlo).
 */
export function visibleRollover(
  overdue: readonly Task[],
  leftIds: ReadonlySet<string>,
): Task[] {
  return overdue.filter((t) => !leftIds.has(t.id));
}

/* ── Stime e capacità ────────────────────────────────────────────────── */

/** Le scelte rapide del rituale (brief run-11: 15/30/60/90). */
export const RITUAL_ESTIMATE_CHOICES = [15, 30, 60, 90] as const;

/** Somma delle stime presenti (i task senza stima contano 0, onesto). */
export function sumEstimates(
  tasks: ReadonlyArray<Pick<Task, "estimate_min">>,
): number {
  return tasks.reduce((sum, t) => sum + (t.estimate_min ?? 0), 0);
}

export type BusyBlock = { startMin: number; endMin: number };

/** Fine convenzionale della giornata pianificabile (23:00). */
export const DAY_END_MIN = 23 * 60;
/** Un evento senza fine dichiarata occupa un'ora (come gli slot). */
export const DEFAULT_EVENT_MINUTES = 60;

/**
 * I blocchi occupati del giorno dagli item d'agenda: SOLO eventi con
 * orario (locali e Google) — i task non sono blocchi, sono l'altra metà
 * dell'equazione (le stime). All-day e voci senza inizio non occupano.
 */
export function busyBlocksFromAgenda(
  items: ReadonlyArray<Pick<AgendaItem, "source" | "allDay" | "start" | "end">>,
): BusyBlock[] {
  const blocks: BusyBlock[] = [];
  for (const it of items) {
    if (it.source === "task" || it.allDay || it.start === null) continue;
    const startMin = hhmmToMin(it.start);
    if (startMin === null) continue;
    const endRaw = it.end === null ? null : hhmmToMin(it.end);
    const endMin =
      endRaw !== null && endRaw > startMin
        ? endRaw
        : Math.min(startMin + DEFAULT_EVENT_MINUTES, 24 * 60);
    blocks.push({ startMin, endMin });
  }
  return blocks;
}

/** "HH:mm" → minuti dal principio del giorno; null su forma inattesa. */
function hhmmToMin(hhmm: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Minuti liberi da ADESSO alla fine della giornata pianificabile, tolti
 * i blocchi occupati (clampati alla finestra, sovrapposizioni fuse).
 * Mai negativo; finestra già chiusa = 0.
 */
export function freeMinutes(
  nowMin: number,
  blocks: readonly BusyBlock[],
  dayEndMin: number = DAY_END_MIN,
): number {
  const from = Math.max(0, nowMin);
  if (from >= dayEndMin) return 0;
  const clamped = blocks
    .map((b) => ({
      startMin: Math.max(b.startMin, from),
      endMin: Math.min(b.endMin, dayEndMin),
    }))
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  let busy = 0;
  let cursor = from;
  for (const b of clamped) {
    const start = Math.max(b.startMin, cursor);
    if (b.endMin > start) {
      busy += b.endMin - start;
      cursor = b.endMin;
    }
  }
  return Math.max(0, dayEndMin - from - busy);
}

/** Minuti in forma umana: "45'", "4h", "5h30". */
export function formatMin(min: number): string {
  const safe = Math.max(0, Math.round(min));
  if (safe < 60) return `${safe}'`;
  const h = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${h}h` : `${h}h${String(rest).padStart(2, "0")}`;
}

export type CapacityLine = { over: boolean; text: string };

/**
 * La riga di capacità, gentile e mai bloccante: sopra il tempo libero
 * il testo del brief ("Hai pianificato 5h30 su ~4h libere."); dentro,
 * la stessa forma senza allarme. Nessuna stima = nessuna riga (null):
 * il conteggio resta a task, onesto.
 */
export function capacityLine(
  estimatedMin: number,
  freeMin: number,
): CapacityLine | null {
  if (estimatedMin <= 0) return null;
  const over = estimatedMin > freeMin;
  const text = over
    ? `Hai pianificato ${formatMin(estimatedMin)} su ~${formatMin(freeMin)} libere.`
    : `Stimato ${formatMin(estimatedMin)} su ~${formatMin(freeMin)} libere.`;
  return { over, text };
}

