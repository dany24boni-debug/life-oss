/**
 * Abitudini (run-08) — la logica di dominio pura che non appartiene al
 * repo, più il seme dell'acqua:
 *
 *   1. `weekdayOfDay` / `isScheduledOn`: giorni feriali ISO calcolati a
 *      mezzogiorno UTC su stringhe civili — mai toccati dai cambi d'ora
 *      (stessa disciplina di data/streak.ts).
 *   2. `effectiveTarget` / `habitDone`: l'obiettivo EFFETTIVO del giorno
 *      (per l'acqua seminata segue il profilo: waterTargetMl dal peso
 *      più recente; l'override manuale è un daily_target valorizzato) e
 *      il predicato di completamento — usati da board, streak e stats.
 *   3. `WATER_SEED` + `seedWaterHabit`: l'abitudine Acqua con UUID FISSO
 *      (pattern gym-seed: prefisso riservato `…90ac…`, timestamp
 *      "antichi" che perdono ogni LWW, semina insert-only-missing che
 *      non risuscita mai) — due dispositivi che seminano convergono.
 *   4. `HABIT_ICON_KEYS` + `STARTER_HABITS`: il set curato di chiavi
 *      icona e le proposte one-tap dell'empty state (prompt 2).
 */

import type { LifeosDb } from "./db";
import { waterTargetMl } from "./derived";
import { SEED_INSTANT } from "./gym-seed";
import type { Habit, HabitCreate, HabitKind, IsoDay } from "./schemas";

/* ── Giorni feriali (puri, DST-immuni) ───────────────────────────────── */

/**
 * Giorno feriale ISO (1 = lunedì … 7 = domenica) di un giorno civile,
 * calcolato a mezzogiorno UTC: l'aritmetica non attraversa mai un
 * cambio d'ora perché non esiste timezone qui dentro.
 */
export function weekdayOfDay(day: IsoDay): number {
  const sundayFirst = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

/** true se l'abitudine è prevista quel giorno (null = tutti i giorni). */
export function isScheduledOn(
  habit: Pick<Habit, "weekdays">,
  day: IsoDay,
): boolean {
  return habit.weekdays === null || habit.weekdays.includes(weekdayOfDay(day));
}

/* ── Obiettivo effettivo e completamento ─────────────────────────────── */

/**
 * Default onesto dell'acqua quando il profilo non basta ancora: non è
 * una stima di formula (quella è waterTargetMl), è il default di
 * prodotto dell'abitudine seminata — la UI lo dichiara come tale.
 */
export const WATER_DEFAULT_ML = 2000;

/**
 * L'obiettivo EFFETTIVO del giorno:
 *   - daily_target valorizzato = override manuale, vince sempre;
 *   - acqua seminata senza override = segue il profilo (peso più
 *     recente → waterTargetMl), col default di prodotto come rete;
 *   - boolean = sempre 1 (fatto/non fatto);
 *   - altrimenti null = nessun obiettivo (done = valore > 0).
 */
export function effectiveTarget(
  habit: Pick<Habit, "id" | "kind" | "daily_target">,
  latestWeightKg: number | null,
): number | null {
  if (habit.daily_target !== null) return habit.daily_target;
  if (habit.id === WATER_HABIT_ID) {
    return waterTargetMl(latestWeightKg) ?? WATER_DEFAULT_ML;
  }
  if (habit.kind === "boolean") return 1;
  return null;
}

/** Completata: valore >= obiettivo; senza obiettivo basta un valore > 0. */
export function habitDone(
  kind: HabitKind,
  value: number,
  target: number | null,
): boolean {
  if (target !== null) return value >= target;
  return value > 0;
}

/* ── Set curato di chiavi icona (la UI mappa, i dati portano la chiave) ─ */

export const HABIT_ICON_KEYS = [
  "spunta",
  "goccia",
  "libro",
  "passi",
  "stretching",
  "sole",
  "luna",
  "cuore",
  "fiamma",
  "taccuino",
  "musica",
  "respiro",
] as const;
export type HabitIconKey = (typeof HABIT_ICON_KEYS)[number];

export const DEFAULT_HABIT_ICON: HabitIconKey = "spunta";

/* ── Seme: l'abitudine Acqua ─────────────────────────────────────────── */

/**
 * Id riservato dei semi abitudini (prefisso `…90ac…`, distinto da
 * `…90aa…` catalogo esercizi e `…90ab…` programma Torso A) — mai
 * riusare un indice, mai rinumerare.
 */
function seedHabitId(n: number): string {
  return `01970000-90ac-7000-8000-00000000${n.toString(16).padStart(4, "0")}`;
}

export const WATER_HABIT_ID = seedHabitId(0x01);

/**
 * Acqua: quantity in ml, daily_target null = segue il profilo
 * (effectiveTarget sopra); prevista tutti i giorni, prima della board.
 */
export const WATER_SEED: Habit = {
  id: WATER_HABIT_ID,
  name: "Acqua",
  icon: "goccia",
  kind: "quantity",
  unit: "ml",
  daily_target: null,
  weekdays: null,
  sort_order: 0,
  archived_at: null,
  created_at: SEED_INSTANT,
  updated_at: SEED_INSTANT,
  deleted_at: null,
};

/**
 * Semina idempotente e non-resuscitante: inserisce SOLO se l'id è
 * assente — una riga modificata (rinominata, override dell'obiettivo) o
 * eliminata (tombstone) non si tocca mai.
 * @returns 1 se l'acqua è stata seminata ora, 0 se c'era già.
 */
export async function seedWaterHabit(db: LifeosDb): Promise<number> {
  return db.transaction("rw", db.habits, async () => {
    const existing = await db.habits.get(WATER_HABIT_ID);
    if (existing !== undefined) return 0;
    await db.habits.add(WATER_SEED);
    return 1;
  });
}

/* ── Proposte one-tap dell'empty state (prompt 2) ────────────────────── */

/** Input di creazione pronti: l'Acqua è già seminata, queste si offrono. */
export const STARTER_HABITS: ReadonlyArray<HabitCreate> = [
  { name: "Lettura", kind: "quantity", unit: "pagine", daily_target: 10, icon: "libro" },
  { name: "Camminata", kind: "boolean", icon: "passi" },
  { name: "Stretching", kind: "boolean", icon: "stretching" },
];
