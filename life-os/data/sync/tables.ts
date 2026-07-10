/**
 * Registro delle tabelle sincronizzate (prompt 08) — l'unico posto che sa
 * quali tabelle Dexie hanno uno specchio remoto e come si chiamano.
 *
 * Disegno "row mirror" (B3.1): il motore sync muove RIGHE INTERE tra il
 * Dexie locale e le tabelle `lo_*` di Supabase; non re-implementa i port.
 * Ogni voce porta:
 *   - `parse`: validazione zod della riga in arrivo (pull o import JSON) —
 *     una riga malformata da remoto viene scartata, mai scritta locale.
 *     Il parse zod fa anche da strip: campi sconosciuti non entrano.
 *   - `instantColumns`: le colonne istante ISO da rinormalizzare al pull.
 *     Postgres/PostgREST restituisce i timestamptz come "…+00:00", gli
 *     schemi locali (e il confronto LWW per stringa) vogliono la forma
 *     "…Z" di `Date.toISOString()`.
 */

import type { Table } from "dexie";
import type { LifeosDb } from "../db";
import {
  ExamSchema,
  GymExerciseSchema,
  GymPlanSchema,
  GymSessionSchema,
  GymSetSchema,
  LocalEventSchema,
  ReminderSchema,
  SettingsSchema,
  TaskSchema,
  type IsoInstant,
} from "../schemas";

/** I campi che ogni riga sincronizzata possiede (convenzioni B3.1). */
export type SyncRow = {
  id: string;
  updated_at: IsoInstant;
  deleted_at: IsoInstant | null;
} & Record<string, unknown>;

export type LocalTableName =
  | "tasks"
  | "events"
  | "esami"
  | "gym_exercises"
  | "gym_plans"
  | "gym_sessions"
  | "gym_sets"
  | "reminders"
  | "settings";

export type RemoteTableName = `lo_${LocalTableName}`;

export type SyncTableSpec = {
  readonly local: LocalTableName;
  readonly remote: RemoteTableName;
  /** null = riga rifiutata dallo schema (scartata dal pull/import). */
  readonly parse: (row: unknown) => SyncRow | null;
  readonly instantColumns: readonly string[];
};

type Parseable = {
  safeParse: (v: unknown) => { success: boolean; data?: unknown };
};

function parserFor(schema: Parseable): SyncTableSpec["parse"] {
  return (row) => {
    const r = schema.safeParse(row);
    return r.success ? (r.data as SyncRow) : null;
  };
}

const AUDIT = ["created_at", "updated_at", "deleted_at"] as const;

export const SYNC_TABLES: readonly SyncTableSpec[] = [
  {
    local: "tasks",
    remote: "lo_tasks",
    parse: parserFor(TaskSchema),
    instantColumns: [...AUDIT, "completed_at"],
  },
  {
    local: "events",
    remote: "lo_events",
    parse: parserFor(LocalEventSchema),
    instantColumns: AUDIT,
  },
  {
    local: "esami",
    remote: "lo_esami",
    parse: parserFor(ExamSchema),
    instantColumns: AUDIT,
  },
  {
    local: "gym_exercises",
    remote: "lo_gym_exercises",
    parse: parserFor(GymExerciseSchema),
    instantColumns: AUDIT,
  },
  {
    local: "gym_plans",
    remote: "lo_gym_plans",
    parse: parserFor(GymPlanSchema),
    instantColumns: AUDIT,
  },
  {
    local: "gym_sessions",
    remote: "lo_gym_sessions",
    parse: parserFor(GymSessionSchema),
    instantColumns: [...AUDIT, "started_at", "finished_at"],
  },
  {
    local: "gym_sets",
    remote: "lo_gym_sets",
    parse: parserFor(GymSetSchema),
    instantColumns: [...AUDIT, "done_at"],
  },
  {
    local: "reminders",
    remote: "lo_reminders",
    parse: parserFor(ReminderSchema),
    instantColumns: [...AUDIT, "fire_at", "fired_at", "dismissed_at"],
  },
  {
    local: "settings",
    remote: "lo_settings",
    parse: parserFor(SettingsSchema),
    instantColumns: AUDIT,
  },
];

export function specByRemote(remote: string): SyncTableSpec | null {
  return SYNC_TABLES.find((s) => s.remote === remote) ?? null;
}

/** La Table Dexie di una voce del registro, tipata come righe sync. */
export function localTable(
  db: LifeosDb,
  spec: SyncTableSpec,
): Table<SyncRow, string> {
  return db.table(spec.local);
}
