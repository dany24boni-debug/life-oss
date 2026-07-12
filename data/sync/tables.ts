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
  BodyEntrySchema,
  EveningCheckinSchema,
  ExamSchema,
  ExpenseSchema,
  GymExerciseSchema,
  GymPlanSchema,
  GymProgramDaySchema,
  GymProgramSchema,
  GymProgramSlotSchema,
  GymSessionSchema,
  GymSetSchema,
  HabitLogSchema,
  HabitSchema,
  LocalEventSchema,
  PlanSlotSchema,
  ReminderSchema,
  SettingsSchema,
  SlotCheckSchema,
  TaskSchema,
  WeekPlanSchema,
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
  | "spese"
  | "sera"
  | "body"
  | "habits"
  | "habit_logs"
  | "week_plans"
  | "plan_slots"
  | "slot_checks"
  | "gym_exercises"
  | "gym_plans"
  | "gym_programs"
  | "gym_program_days"
  | "gym_program_slots"
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
    local: "spese",
    remote: "lo_spese",
    parse: parserFor(ExpenseSchema),
    instantColumns: AUDIT,
  },
  {
    local: "sera",
    remote: "lo_sera",
    parse: parserFor(EveningCheckinSchema),
    instantColumns: AUDIT,
  },
  {
    local: "body",
    remote: "lo_body",
    parse: parserFor(BodyEntrySchema),
    instantColumns: AUDIT,
  },
  {
    local: "habits",
    remote: "lo_habits",
    parse: parserFor(HabitSchema),
    instantColumns: [...AUDIT, "archived_at"],
  },
  {
    local: "habit_logs",
    remote: "lo_habit_logs",
    parse: parserFor(HabitLogSchema),
    instantColumns: AUDIT,
  },
  {
    local: "week_plans",
    remote: "lo_week_plans",
    parse: parserFor(WeekPlanSchema),
    instantColumns: AUDIT,
  },
  {
    local: "plan_slots",
    remote: "lo_plan_slots",
    parse: parserFor(PlanSlotSchema),
    instantColumns: AUDIT,
  },
  {
    local: "slot_checks",
    remote: "lo_slot_checks",
    parse: parserFor(SlotCheckSchema),
    instantColumns: [...AUDIT, "checked_at"],
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
    local: "gym_programs",
    remote: "lo_gym_programs",
    parse: parserFor(GymProgramSchema),
    instantColumns: AUDIT,
  },
  {
    local: "gym_program_days",
    remote: "lo_gym_program_days",
    parse: parserFor(GymProgramDaySchema),
    instantColumns: AUDIT,
  },
  {
    local: "gym_program_slots",
    remote: "lo_gym_program_slots",
    parse: parserFor(GymProgramSlotSchema),
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
