/**
 * Stato per-giorno del rituale (run-11 P2) — la parte PURA che serve
 * anche alla shell sempre-caricata di Oggi: tipo, chiavi localStorage,
 * parse difensivo e potatura. Separata da `ritual-logic.ts` (passi e
 * capacità, solo corpo lazy) per non far pagare alla home byte che
 * userebbe solo la card aperta. Testata in `ritual-logic.test.ts`.
 */

/**
 * Lo stato del rituale per UN giorno. Solo UX di dispositivo: il piano
 * vero (date, stime, ordine) è già tutto nei task sincronizzati — qui
 * vive solo "il rituale è girato/congedato QUI oggi" più i numeri dello
 * stamp per la riga del brief.
 */
export type RitualDayState = {
  /** "Non oggi": la card non torna fino a domani. */
  dismissed?: boolean;
  /** Istante ISO dello stamp "giornata pianificata" (anche parziale). */
  planned_at?: string;
  /** Task aperti al momento dello stamp. */
  tasks_planned?: number;
  /** Somma delle stime allo stamp (minuti). */
  estimated_min?: number;
  /** Minuti liberi calcolati allo stamp. */
  free_min?: number;
};

export const RITUAL_KEY_PREFIX = "lifeos.ritual.";

export function ritualKey(day: string): string {
  return `${RITUAL_KEY_PREFIX}${day}`;
}

/** Parse difensivo (pattern pwa-logic): mai throw, mai forma sporca. */
export function parseRitualDay(raw: string | null): RitualDayState | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    const state: RitualDayState = {};
    if (o.dismissed === true) state.dismissed = true;
    if (typeof o.planned_at === "string") state.planned_at = o.planned_at;
    if (typeof o.tasks_planned === "number" && o.tasks_planned >= 0) {
      state.tasks_planned = o.tasks_planned;
    }
    if (typeof o.estimated_min === "number" && o.estimated_min >= 0) {
      state.estimated_min = o.estimated_min;
    }
    if (typeof o.free_min === "number" && o.free_min >= 0) {
      state.free_min = o.free_min;
    }
    return state;
  } catch {
    return null;
  }
}

/**
 * Le chiavi rituale da RIMUOVERE tenendo solo il giorno corrente
 * (potatura alla scrittura, pattern brief-cache: lo storage non
 * accumula giorni morti).
 */
export function staleRitualKeys(
  allKeys: readonly string[],
  keepDay: string,
): string[] {
  const keep = ritualKey(keepDay);
  return allKeys.filter((k) => k.startsWith(RITUAL_KEY_PREFIX) && k !== keep);
}
