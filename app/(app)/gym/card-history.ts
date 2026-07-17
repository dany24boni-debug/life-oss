/**
 * Logica pura della vista scheda-centrica (run-10 P2) — la rotazione IA
 * chiesta da Davide: /gym presenta le CARD dei giorni-scheda e ogni card
 * mostra la griglia storica del SUO giorno, come il foglio Excel — righe
 * = esercizi nell'ordine della scheda, colonne = date delle esecuzioni
 * passate (più recenti prima), celle = "peso × reps". Zero side effect;
 * nessuna query qui — i componenti passano ciò che gli hook esistenti
 * restituiscono (fence P2: data/** intoccato).
 */

import type { GymSession, GymSet } from "@/data/schemas";

/* ── Colonne della griglia storica ───────────────────────────────────── */

export type HistoryColumn = {
  sessionId: string;
  /** Giorno civile della seduta. */
  date: string;
  /** true = la seduta di oggi (anche in corso): la colonna viva. */
  isToday: boolean;
};

/**
 * Le colonne della griglia dal risultato di listSessionsByProgramDay
 * (già più-recenti-prima): tutte le sedute CONCLUSE più quella di oggi
 * anche se in corso (la colonna si riempie loggando). Le sedute
 * abbandonate di giorni passati (mai concluse) non sono storia: fuori.
 */
export function historyColumns(
  sessions: readonly Pick<GymSession, "id" | "date" | "finished_at">[],
  today: string,
  maxColumns = 10,
): HistoryColumn[] {
  const columns: HistoryColumn[] = [];
  for (const s of sessions) {
    if (s.finished_at === null && s.date !== today) continue;
    columns.push({ sessionId: s.id, date: s.date, isToday: s.date === today });
    if (columns.length >= maxColumns) break;
  }
  return columns;
}

/** Il giorno dell'ultima seduta CONCLUSA del giorno-scheda; null se mai. */
export function lastDoneDate(
  sessions: readonly Pick<GymSession, "date" | "finished_at">[],
): string | null {
  for (const s of sessions) {
    if (s.finished_at !== null) return s.date;
  }
  return null;
}

/* ── Riepilogo sezioni della card ("3 FORZA · 3 IPERTROFIA · 1 CORE") ── */

/**
 * Conta gli slot per gruppo di sezione CONSECUTIVO (stessa regola
 * visiva di sectionGroups: l'ordine della scheda è la verità). I gruppi
 * senza sezione contano come "esercizi"; una scheda tutta senza sezioni
 * si riassume in "N esercizi".
 */
export function sectionSummary(
  slots: readonly { section: string | null }[],
): string {
  if (slots.length === 0) return "Vuota";
  const parts: string[] = [];
  let current: string | null | undefined;
  let count = 0;
  const flush = () => {
    if (count === 0) return;
    parts.push(
      current === null
        ? `${count} ${count === 1 ? "esercizio" : "esercizi"}`
        : `${count} ${current}`,
    );
  };
  for (const slot of slots) {
    if (current === undefined || slot.section !== current) {
      flush();
      current = slot.section;
      count = 1;
    } else {
      count += 1;
    }
  }
  flush();
  return parts.join(" · ");
}

/* ── Celle: i set dell'esercizio per colonna ─────────────────────────── */

/**
 * Dai set di UN esercizio (qualsiasi ordine, tutta la storia) alla mappa
 * session_id → set ordinati per set_number, limitata alle colonne della
 * griglia. Sessioni fuori colonna restano fuori.
 */
export function setsBySessionForExercise(
  sets: readonly GymSet[],
  columns: readonly HistoryColumn[],
): Map<string, GymSet[]> {
  const wanted = new Set(columns.map((c) => c.sessionId));
  const out = new Map<string, GymSet[]>();
  for (const set of sets) {
    if (!wanted.has(set.session_id)) continue;
    const list = out.get(set.session_id) ?? [];
    list.push(set);
    out.set(set.session_id, list);
  }
  for (const list of out.values()) {
    list.sort((a, b) => a.set_number - b.set_number);
  }
  return out;
}

/* ── Deep link della card ────────────────────────────────────────────── */

/**
 * La rotta della card di un giorno-scheda: è il bersaglio del tile
 * Palestra di Oggi e di ogni scorciatoia "inizia" — la porta d'ingresso
 * è la scheda, il log parte da lì (run-10 P2).
 */
export function gymCardHref(dayId: string): string {
  return `/gym?scheda=${encodeURIComponent(dayId)}`;
}
