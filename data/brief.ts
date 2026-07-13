/**
 * Morning brief (run-09 prompt 4) — UNA frase italiana composta da dati
 * VERI, deterministica e testata su fixture. Mai un throw, mai numeri
 * inventati: ogni pezzo mancante viene semplicemente omesso; con zero
 * dati la frase è null (il componente non rende nulla).
 *
 * La frase deterministica È il prodotto; la rifinitura LLM
 * (app/api/brief, key-gated) è condimento facoltativo che riceve SOLO
 * questo snapshot aggregato — mai dump di tabelle.
 *
 * Regole di priorità (ordine fisso, al più QUATTRO pezzi per restare
 * una frase): palestra → task (i ritardi pesano) → slot del piano →
 * pasti → acqua → streak.
 */

import { z } from "zod";
import { IsoDaySchema } from "./schemas";

/** Lo snapshot aggregato: il client lo compone dagli hook locali. */
export const BriefSnapshotSchema = z.object({
  date: IsoDaySchema,
  /** Task aperti di oggi e in ritardo (conteggi, mai liste). */
  tasksOpen: z.number().int().min(0).max(10_000),
  tasksOverdue: z.number().int().min(0).max(10_000),
  /** Prossimo giorno di programma ("Torso A"); null senza programmi. */
  gymNextUp: z.string().trim().min(1).max(120).nullable(),
  gymDoneToday: z.boolean(),
  /** Lo slot del piano: in corso o il prossimo di oggi. */
  planSlot: z
    .object({
      title: z.string().trim().min(1).max(200),
      start_hhmm: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      now: z.boolean(),
    })
    .nullable(),
  /** Pasti di oggi; null senza piano con pasti oggi. */
  meals: z
    .object({
      eaten: z.number().int().min(0).max(50),
      total: z.number().int().min(0).max(50),
    })
    .nullable(),
  /** Acqua del giorno in ml; target null = nessun obiettivo noto. */
  water: z
    .object({
      ml: z.number().min(0).max(1_000_000),
      targetMl: z.number().min(1).max(1_000_000).nullable(),
    })
    .nullable(),
  streak: z
    .object({
      current: z.number().int().min(0).max(100_000),
      todayCounts: z.boolean(),
    })
    .nullable(),
});
export type BriefSnapshot = z.infer<typeof BriefSnapshotSchema>;

/** Quanti pezzi al massimo: oltre non è più una frase. */
const MAX_CLAUSES = 4;

/**
 * La frase del mattino, o null con zero dati. Prima lettera maiuscola,
 * punto finale, pezzi separati da virgole — quieta per costruzione.
 */
export function composeBrief(snapshot: BriefSnapshot): string | null {
  const clauses: string[] = [];

  // 1. Palestra: il next-up, o il fatto.
  if (snapshot.gymDoneToday) {
    clauses.push("palestra già fatta");
  } else if (snapshot.gymNextUp !== null) {
    clauses.push(`palestra: ${snapshot.gymNextUp}`);
  }

  // 2. Task: i ritardi pesano di più dei conteggi.
  const open = Math.max(0, snapshot.tasksOpen);
  const overdue = Math.max(0, snapshot.tasksOverdue);
  if (overdue > 0 && open > 0) {
    clauses.push(
      `${open} task aperti (${overdue} in ritardo)`.replace(
        "1 task aperti",
        "1 task aperto",
      ),
    );
  } else if (overdue > 0) {
    clauses.push(`${overdue} task in ritardo`);
  } else if (open > 0) {
    clauses.push(open === 1 ? "1 task aperto" : `${open} task aperti`);
  }

  // 3. Lo slot del piano: adesso, o il prossimo.
  if (snapshot.planSlot !== null) {
    clauses.push(
      snapshot.planSlot.now
        ? `adesso ${snapshot.planSlot.title}`
        : `alle ${snapshot.planSlot.start_hhmm} ${snapshot.planSlot.title}`,
    );
  }

  // 4. Pasti del piano.
  if (snapshot.meals !== null && snapshot.meals.total > 0) {
    clauses.push(
      snapshot.meals.eaten >= snapshot.meals.total
        ? "pasti tutti fatti"
        : `${snapshot.meals.eaten}/${snapshot.meals.total} pasti`,
    );
  }

  // 5. Acqua: solo quando c'è già un progresso e un obiettivo.
  if (
    snapshot.water !== null &&
    snapshot.water.targetMl !== null &&
    snapshot.water.ml > 0
  ) {
    const pct = Math.round((snapshot.water.ml / snapshot.water.targetMl) * 100);
    clauses.push(pct >= 100 ? "acqua fatta" : `acqua al ${pct}%`);
  }

  // 6. Streak, quando esiste.
  if (snapshot.streak !== null && snapshot.streak.current > 0) {
    clauses.push(
      snapshot.streak.todayCounts
        ? `streak a ${snapshot.streak.current} (oggi conta già)`
        : `streak a ${snapshot.streak.current} da tenere`,
    );
  }

  if (clauses.length === 0) return null;
  const chosen = clauses.slice(0, MAX_CLAUSES);
  const sentence = chosen.join(", ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}
