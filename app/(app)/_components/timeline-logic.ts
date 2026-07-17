/**
 * Logica PURA della timeline di Oggi (run-11 P3, CROSS-05/WOW-09):
 * fonde in UN flusso ordinato per ora gli item d'agenda (eventi locali,
 * task con orario, Google), gli slot del piano settimanale e le fasi
 * focus concluse; calcola dove cade il cursore "adesso" e riordina i
 * task senza orario nell'ordine playlist del rituale (sort_order).
 * Niente React, niente storage — testata in `timeline-logic.test.ts`.
 */

import type { WeekSlotEntry } from "@/data/planner";
import { hhmmToMinutes } from "../settimana/logic";
import type { AgendaItem } from "../calendar/agenda";

export type TimedEntry =
  | { kind: "slot"; startMin: number; entry: WeekSlotEntry }
  | { kind: "item"; startMin: number; item: AgendaItem }
  | {
      kind: "focus";
      startMin: number;
      id: string;
      hhmm: string;
      minutes: number;
    };

/** A parità di minuto: prima gli slot (il piano incornicia l'ora), poi
 *  le voci d'agenda, poi le fasi focus (che sono passato compiuto). */
const KIND_ORDER: Record<TimedEntry["kind"], number> = {
  slot: 0,
  item: 1,
  focus: 2,
};

export type FocusRow = { id: string; hhmm: string; minutes: number };

/**
 * Il flusso con orario, ordinato per inizio (stabile: a parità di
 * minuto e specie vale l'ordine d'arrivo — gli item arrivano già
 * ordinati da buildDayAgenda, gli slot da sort_order del piano).
 */
export function buildTimedStream(input: {
  items: readonly AgendaItem[];
  slots: readonly WeekSlotEntry[];
  focus: readonly FocusRow[];
}): TimedEntry[] {
  const out: TimedEntry[] = [];
  for (const e of input.slots) {
    out.push({
      kind: "slot",
      startMin: hhmmToMinutes(e.slot.start_hhmm),
      entry: e,
    });
  }
  for (const item of input.items) {
    if (item.allDay || item.start === null) continue;
    out.push({ kind: "item", startMin: hhmmToMinutes(item.start), item });
  }
  for (const f of input.focus) {
    out.push({
      kind: "focus",
      startMin: hhmmToMinutes(f.hhmm),
      id: f.id,
      hhmm: f.hhmm,
      minutes: f.minutes,
    });
  }
  // Array.prototype.sort è stabile: pari (minuto, specie) = ordine
  // d'arrivo, che è già quello giusto per ciascuna sorgente.
  return out.sort(
    (a, b) => a.startMin - b.startMin || KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

/**
 * L'indice del cursore "adesso" nel flusso: prima voce che inizia DOPO
 * questo minuto (le voci del minuto corrente restano sopra il cursore
 * — sono "in corso"). Lista vuota o giornata finita: in coda.
 */
export function nowCursorIndex(
  stream: readonly TimedEntry[],
  nowMin: number,
): number {
  for (let i = 0; i < stream.length; i++) {
    if (stream[i].startMin > nowMin) return i;
  }
  return stream.length;
}

/**
 * La fascia senza orario, con i TASK riordinati secondo la playlist del
 * rituale (l'ordine di `sort_order` che arriva da useTasks): gli eventi
 * all-day e Google restano dove sono (in testa, ordine d'arrivo), i
 * task si accodano nell'ordine in cui verranno fatti — non più
 * alfabetico. Id fuori playlist (task appena nati altrove): in coda,
 * ordine d'arrivo.
 */
export function orderBandTasks(
  band: readonly AgendaItem[],
  playlistIds: readonly string[],
): AgendaItem[] {
  const rank = new Map(playlistIds.map((id, i) => [id, i]));
  const others = band.filter((i) => i.source !== "task");
  const tasks = band
    .filter((i) => i.source === "task")
    .map((item, arrival) => ({ item, arrival }))
    .sort((a, b) => {
      const ra = rank.get(a.item.id) ?? Number.MAX_SAFE_INTEGER;
      const rb = rank.get(b.item.id) ?? Number.MAX_SAFE_INTEGER;
      return ra - rb || a.arrival - b.arrival;
    })
    .map((t) => t.item);
  return [...others, ...tasks];
}
