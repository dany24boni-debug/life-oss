/**
 * Logica pura della griglia e dei progressi (run-07 prompt 3) — zero
 * side effect, tutta testata:
 *
 *   - parsing delle prescrizioni testuali del foglio ("3–5", "1–2",
 *     "2/1/0") SOLO dove serve giudicare; la grafia resta testo;
 *   - celle della griglia (fatte/fantasma) dagli slot + set reali —
 *     nessun set fantasma persistito: l'aderenza resta onesta;
 *   - verdetto AUMENTA / RESTA per slot sull'ultima seduta completata
 *     (RIR discendente confrontato per-indice, come sul foglio);
 *   - tabella Progressi per esercizio: colonne = ultime sedute datate,
 *     header volume / e1RM (Brzycki, set migliore) / Δ vs precedente,
 *     punto ember sui PR di carico;
 *   - recupero QUIETO: trascorso dall'ultima serie confermata — mai un
 *     countdown.
 */

import { estimateOneRepMax } from "@/lib/fitness";
import type { GymProgramSlot, GymSet } from "@/data/schemas";
import { setVolumeKg } from "./logic";

/* ── Prescrizioni: parsing per il giudizio ───────────────────────────── */

export type RepsRange = { min: number; max: number };

/**
 * "3–5" (o "3-5") → {3,5}; "12" → {12,12}. Testo non numerico ("max",
 * "30s") → null: senza un tetto non si giudica, si mostra soltanto.
 */
export function parseRepsRange(text: string | null): RepsRange | null {
  if (text === null) return null;
  const s = text.trim();
  const range = /^(\d{1,3})\s*[–\-]\s*(\d{1,3})$/.exec(s);
  if (range) {
    const min = Number.parseInt(range[1], 10);
    const max = Number.parseInt(range[2], 10);
    return min <= max ? { min, max } : { min: max, max: min };
  }
  const single = /^(\d{1,3})$/.exec(s);
  if (single) {
    const n = Number.parseInt(single[1], 10);
    return { min: n, max: n };
  }
  return null;
}

/**
 * Pavimenti RIR per-set: "1" → [1]; "1–2" → [1] (il pavimento del
 * range); "2/1/0" → [2,1,0] (discendente, per-indice). Non numerico →
 * null (il RIR non entra nel giudizio).
 */
export function parseRirFloors(text: string | null): number[] | null {
  if (text === null) return null;
  const s = text.trim();
  if (s.includes("/")) {
    const tokens = s.split("/").map((t) => t.trim());
    const floors: number[] = [];
    for (const token of tokens) {
      if (!/^\d{1,2}$/.test(token)) return null;
      floors.push(Number.parseInt(token, 10));
    }
    return floors.length > 0 ? floors : null;
  }
  const range = /^(\d{1,2})\s*[–\-]\s*(\d{1,2})$/.exec(s);
  if (range) {
    return [
      Math.min(
        Number.parseInt(range[1], 10),
        Number.parseInt(range[2], 10),
      ),
    ];
  }
  if (/^\d{1,2}$/.test(s)) return [Number.parseInt(s, 10)];
  return null;
}

/** Pavimento RIR per l'indice di set (l'ultimo token copre la coda). */
export function rirFloorAt(
  floors: number[] | null,
  setIndex: number,
): number | null {
  if (floors === null || floors.length === 0) return null;
  return floors[Math.min(setIndex, floors.length - 1)];
}

/** Il testo RIR del fantasma per l'indice: "2/1/0" al set 2 → "1". */
export function rirLabelAt(text: string | null, setIndex: number): string | null {
  if (text === null) return null;
  if (text.includes("/")) {
    const tokens = text.split("/").map((t) => t.trim());
    return tokens[Math.min(setIndex, tokens.length - 1)] || null;
  }
  return text;
}

/** Etichetta fantasma della cella: "3–5 @RIR1" (le parti presenti). */
export function ghostLabel(
  slot: Pick<GymProgramSlot, "target_reps" | "target_rir">,
  setIndex: number,
): string {
  const rir = rirLabelAt(slot.target_rir, setIndex);
  const reps = slot.target_reps;
  if (reps !== null && rir !== null) return `${reps} @RIR${rir}`;
  if (reps !== null) return reps;
  if (rir !== null) return `@RIR${rir}`;
  return "—";
}

/* ── Verdetto AUMENTA / RESTA ────────────────────────────────────────── */

export type Verdict = "aumenta" | "resta";

/**
 * Giudica uno slot sull'ULTIMA seduta completata: AUMENTA se tutte le
 * serie previste sono state fatte, ogni serie ha le reps AL TETTO del
 * range, e il RIR fatto (quando registrato) non supera il pavimento del
 * suo indice. Senza range di reps o senza storia: nessun verdetto.
 * È un suggerimento, mai un ordine (microcopy della UI).
 */
export function verdictForSlot(
  slot: Pick<GymProgramSlot, "target_sets" | "target_reps" | "target_rir">,
  lastSessionSets: readonly GymSet[],
): Verdict | null {
  const range = parseRepsRange(slot.target_reps);
  if (range === null) return null;
  if (lastSessionSets.length === 0) return null;
  if (lastSessionSets.length < slot.target_sets) return "resta";
  const floors = parseRirFloors(slot.target_rir);
  for (let i = 0; i < slot.target_sets; i++) {
    const set = lastSessionSets[i];
    if (set.reps < range.max) return "resta";
    const floor = rirFloorAt(floors, i);
    if (floor !== null && set.rir_done !== null && set.rir_done > floor) {
      return "resta";
    }
  }
  return "aumenta";
}

/** Testo del chip: il carico suggerito segue lo stepper (±2,5 kg). */
export function verdictLabel(verdict: Verdict, bodyweight: boolean): string {
  if (verdict === "resta") return "RESTA";
  return bodyweight ? "AUMENTA" : "AUMENTA +2,5 kg";
}

/* ── Aderenza (serie fatte / previste) ───────────────────────────────── */

export function plannedSetCount(
  slots: readonly Pick<GymProgramSlot, "target_sets">[],
): number {
  return slots.reduce((sum, s) => sum + s.target_sets, 0);
}

/* ── Griglia: righe e celle ──────────────────────────────────────────── */

export type GridCell =
  | { kind: "done"; set: GymSet; setIndex: number }
  | { kind: "ghost"; label: string; setIndex: number };

export type GridRow = {
  /** slot id, o exercise id per le righe aggiunte al volo. */
  key: string;
  slot: GymProgramSlot | null;
  exerciseId: string;
  section: string | null;
  cells: GridCell[];
};

/**
 * Le righe della griglia: gli slot del giorno nell'ordine della scheda
 * (N celle = target_sets, fantasma finché non confermate; le serie
 * extra allungano la riga), poi gli esercizi aggiunti al volo (prima i
 * già-loggati, poi quelli appena scelti e ancora vuoti). I set si
 * attribuiscono al PRIMO slot con quell'esercizio (il foglio non ripete
 * un esercizio nello stesso giorno).
 */
export function buildGridRows(
  slots: readonly GymProgramSlot[],
  sessionSets: readonly GymSet[],
  pendingExerciseIds: readonly string[] = [],
): GridRow[] {
  const setsByExercise = new Map<string, GymSet[]>();
  for (const set of sessionSets) {
    const list = setsByExercise.get(set.exercise_id) ?? [];
    list.push(set);
    setsByExercise.set(set.exercise_id, list);
  }
  for (const list of setsByExercise.values()) {
    list.sort((a, b) => a.set_number - b.set_number);
  }

  const rows: GridRow[] = [];
  const consumed = new Set<string>();

  for (const slot of slots) {
    const own = consumed.has(slot.exercise_id)
      ? []
      : (setsByExercise.get(slot.exercise_id) ?? []);
    consumed.add(slot.exercise_id);
    const count = Math.max(slot.target_sets, own.length);
    const cells: GridCell[] = [];
    for (let i = 0; i < count; i++) {
      const set = own[i];
      cells.push(
        set !== undefined
          ? { kind: "done", set, setIndex: i }
          : { kind: "ghost", label: ghostLabel(slot, i), setIndex: i },
      );
    }
    rows.push({
      key: slot.id,
      slot,
      exerciseId: slot.exercise_id,
      section: slot.section,
      cells,
    });
  }

  // Esercizi fuori scheda con set già loggati (ordine di primo set).
  for (const [exerciseId, own] of setsByExercise) {
    if (consumed.has(exerciseId)) continue;
    consumed.add(exerciseId);
    rows.push({
      key: exerciseId,
      slot: null,
      exerciseId,
      section: null,
      cells: own.map((set, i) => ({ kind: "done", set, setIndex: i })),
    });
  }

  // Aggiunti al volo, ancora senza set: una riga pronta al primo tap.
  for (const exerciseId of pendingExerciseIds) {
    if (consumed.has(exerciseId)) continue;
    consumed.add(exerciseId);
    rows.push({
      key: exerciseId,
      slot: null,
      exerciseId,
      section: null,
      cells: [],
    });
  }

  return rows;
}

/** Il numero del prossimo set della riga (dai set fatti, non dai ghost). */
export function nextSetNumberInRow(row: GridRow): number {
  const done = row.cells.filter((c) => c.kind === "done").length;
  return done + 1;
}

/** "62,5 × 9", o "× 12" a corpo libero (peso null). */
const CELL_KG = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 1,
  useGrouping: "always",
} as Intl.NumberFormatOptions);

/** Solo il numero, formato italiano: 62.5 → "62,5". */
export function formatKgShort(kg: number): string {
  return CELL_KG.format(kg);
}

export function doneCellLabel(
  set: Pick<GymSet, "weight_kg" | "reps">,
): string {
  if (set.weight_kg === null) return `× ${set.reps}`;
  return `${CELL_KG.format(set.weight_kg)} × ${set.reps}`;
}

/* ── Recupero quieto (MAI countdown) ─────────────────────────────────── */

/** "2:10" dai secondi trascorsi (sale, non scende). */
export function formatElapsed(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/** L'ultima serie confermata della sessione (done_at più recente). */
export function lastDoneSet(sets: readonly GymSet[]): GymSet | null {
  let last: GymSet | null = null;
  for (const set of sets) {
    if (set.done_at === null) continue;
    if (last === null || set.done_at > (last.done_at ?? "")) last = set;
  }
  return last;
}

/**
 * Recupero reale suggerito per la prossima serie: i secondi trascorsi
 * dall'ultima confermata. Oltre l'ora non è più un recupero (pausa,
 * app riaperta il giorno dopo): null.
 */
export function suggestedRestS(
  lastDoneAtIso: string | null,
  nowMs: number,
): number | null {
  if (lastDoneAtIso === null) return null;
  const elapsed = Math.floor((nowMs - Date.parse(lastDoneAtIso)) / 1000);
  if (Number.isNaN(elapsed) || elapsed < 0) return null;
  return elapsed > 3600 ? null : elapsed;
}

/**
 * Parse dell'input "recupero reale" (stessa grammatica del builder ma
 * col dominio del set, 0..3600): "150", "2'30", "2:30".
 */
export function parseActualRestInput(raw: string): number | null {
  const s = raw.trim().replace(/\s+/g, "");
  if (s === "") return null;
  let seconds: number | null = null;
  const plain = /^(\d{1,4})$/.exec(s);
  const minSec = /^(\d{1,2})['’:](\d{1,2})?['’]?$/.exec(s);
  if (plain) {
    seconds = Number.parseInt(plain[1], 10);
  } else if (minSec) {
    const sec = minSec[2] === undefined ? 0 : Number.parseInt(minSec[2], 10);
    if (sec > 59) return null;
    seconds = Number.parseInt(minSec[1], 10) * 60 + sec;
  }
  if (seconds === null) return null;
  return Math.max(0, Math.min(3600, seconds));
}

/* ── Tabella Progressi per esercizio ─────────────────────────────────── */

export type ProgressColumn = {
  sessionId: string;
  /** Giorno civile della seduta. */
  date: string;
  volumeKg: number;
  /** e1RM Brzycki del set migliore; null se tutta corpo libero. */
  e1rmKg: number | null;
  /** Δ e1RM vs la seduta PRECEDENTE (kg); null al primo o senza dato. */
  deltaE1rmKg: number | null;
  /** Set per numero crescente. */
  sets: GymSet[];
  /** true dove il set ha battuto il miglior carico di TUTTE le sedute prima. */
  prFlags: boolean[];
};

export type ProgressTable = {
  /** Colonne più RECENTI prima (la prima è l'ultima seduta). */
  columns: ProgressColumn[];
  /** Righe set 1..maxSets. */
  maxSets: number;
};

export function buildProgressTable(
  sets: readonly GymSet[],
  dateBySession: ReadonlyMap<string, string>,
  opts?: { maxColumns?: number },
): ProgressTable {
  const maxColumns = opts?.maxColumns ?? 10;
  const bySession = new Map<string, GymSet[]>();
  for (const set of sets) {
    if (!dateBySession.has(set.session_id)) continue;
    const list = bySession.get(set.session_id) ?? [];
    list.push(set);
    bySession.set(set.session_id, list);
  }

  const chronological = [...bySession.entries()]
    .map(([sessionId, own]) => ({
      sessionId,
      date: dateBySession.get(sessionId)!,
      sets: own.sort((a, b) => a.set_number - b.set_number),
    }))
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
    );

  const columns: ProgressColumn[] = [];
  let previousE1rm: number | null = null;
  let historicalMaxKg: number | null = null;

  for (const entry of chronological) {
    let volumeKg = 0;
    let e1rmKg: number | null = null;
    const prFlags: boolean[] = [];
    let sessionMaxKg: number | null = null;
    for (const set of entry.sets) {
      volumeKg += setVolumeKg(set);
      if (set.weight_kg !== null && set.weight_kg > 0) {
        const rm = estimateOneRepMax(set.weight_kg, set.reps);
        if (rm > 0 && (e1rmKg === null || rm > e1rmKg)) e1rmKg = rm;
        prFlags.push(
          historicalMaxKg !== null && set.weight_kg > historicalMaxKg,
        );
        if (sessionMaxKg === null || set.weight_kg > sessionMaxKg) {
          sessionMaxKg = set.weight_kg;
        }
      } else {
        prFlags.push(false);
      }
    }
    columns.push({
      sessionId: entry.sessionId,
      date: entry.date,
      volumeKg,
      e1rmKg,
      deltaE1rmKg:
        e1rmKg !== null && previousE1rm !== null
          ? Math.round((e1rmKg - previousE1rm) * 10) / 10
          : null,
      sets: entry.sets,
      prFlags,
    });
    if (e1rmKg !== null) previousE1rm = e1rmKg;
    if (sessionMaxKg !== null) {
      historicalMaxKg =
        historicalMaxKg === null
          ? sessionMaxKg
          : Math.max(historicalMaxKg, sessionMaxKg);
    }
  }

  const recentFirst = columns.slice(-maxColumns).reverse();
  const maxSets = recentFirst.reduce((m, c) => Math.max(m, c.sets.length), 0);
  return { columns: recentFirst, maxSets };
}
