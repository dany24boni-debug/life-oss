/**
 * GymRepo su Dexie — esercizi, piani, sessioni, set. I set sono una tabella
 * separata indicizzata per exercise_id e session_id (storico e PR del
 * prompt 10 senza scansioni complete).
 */

import type { Table } from "dexie";
import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  ExerciseCreateSchema,
  ExercisePatchSchema,
  PlanCreateSchema,
  PlanPatchSchema,
  SessionCreateSchema,
  SessionPatchSchema,
  SetCreateSchema,
  SetPatchSchema,
  type ExerciseCreate,
  type ExercisePatch,
  type GymExercise,
  type GymPlan,
  type GymSession,
  type GymSet,
  type IsoDay,
  type IsoInstant,
  type MuscleGroup,
  type PlanCreate,
  type PlanPatch,
  type SessionCreate,
  type SessionPatch,
  type SetCreate,
  type SetPatch,
} from "../schemas";
import type { GymRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const ESERCIZIO_NON_TROVATO = "Esercizio non trovato (o già eliminato).";
const PIANO_NON_TROVATO = "Piano non trovato (o già eliminato).";
const SESSIONE_NON_TROVATA = "Sessione non trovata (o già eliminata).";
const SET_NON_TROVATO = "Set non trovato (o già eliminato).";

export class LocalGymRepo implements GymRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  // ── Esercizi ─────────────────────────────────────────────────────────

  createExercise(input: ExerciseCreate): Promise<Result<GymExercise>> {
    return attempt(async () => {
      const v = validate(ExerciseCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const exercise: GymExercise = {
        id: uuidv7(),
        name: v.data.name,
        muscle_group: v.data.muscle_group,
        default_rest_seconds: v.data.default_rest_seconds ?? null,
        note: v.data.note ?? null,
        is_custom: v.data.is_custom ?? true,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.gym_exercises.add(exercise);
      return ok(exercise);
    });
  }

  updateExercise(
    id: string,
    patch: ExercisePatch,
  ): Promise<Result<GymExercise>> {
    return attempt(async () => {
      const v = validate(ExercisePatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getExerciseById(id);
      if (!current) return err("not_found", ESERCIZIO_NON_TROVATO);
      const d = v.data;
      const next: GymExercise = {
        ...current,
        ...(d.name !== undefined && { name: d.name }),
        ...(d.muscle_group !== undefined && { muscle_group: d.muscle_group }),
        ...(d.default_rest_seconds !== undefined && {
          default_rest_seconds: d.default_rest_seconds,
        }),
        ...(d.note !== undefined && { note: d.note }),
        ...(d.is_custom !== undefined && { is_custom: d.is_custom }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.gym_exercises.put(next);
      return ok(next);
    });
  }

  softDeleteExercise(id: string): Promise<Result<void>> {
    return this.softDeleteRow(this.db.gym_exercises, id, ESERCIZIO_NON_TROVATO);
  }

  async getExerciseById(id: string): Promise<GymExercise | null> {
    const row = await this.db.gym_exercises.get(id);
    return row && alive(row) ? row : null;
  }

  async listExercises(opts?: { group?: MuscleGroup }): Promise<GymExercise[]> {
    const rows = opts?.group
      ? await this.db.gym_exercises
          .where("muscle_group")
          .equals(opts.group)
          .toArray()
      : await this.db.gym_exercises.toArray();
    return rows
      .filter(alive)
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }

  // ── Piani ────────────────────────────────────────────────────────────

  createPlan(input: PlanCreate): Promise<Result<GymPlan>> {
    return attempt(async () => {
      const v = validate(PlanCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const plan: GymPlan = {
        id: uuidv7(),
        name: v.data.name,
        entries: v.data.entries ?? [],
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.gym_plans.add(plan);
      return ok(plan);
    });
  }

  updatePlan(id: string, patch: PlanPatch): Promise<Result<GymPlan>> {
    return attempt(async () => {
      const v = validate(PlanPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getPlanById(id);
      if (!current) return err("not_found", PIANO_NON_TROVATO);
      const next: GymPlan = {
        ...current,
        ...(v.data.name !== undefined && { name: v.data.name }),
        ...(v.data.entries !== undefined && { entries: v.data.entries }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.gym_plans.put(next);
      return ok(next);
    });
  }

  softDeletePlan(id: string): Promise<Result<void>> {
    return this.softDeleteRow(this.db.gym_plans, id, PIANO_NON_TROVATO);
  }

  async getPlanById(id: string): Promise<GymPlan | null> {
    const row = await this.db.gym_plans.get(id);
    return row && alive(row) ? row : null;
  }

  async listPlans(): Promise<GymPlan[]> {
    const rows = await this.db.gym_plans.toArray();
    return rows
      .filter(alive)
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }

  // ── Sessioni ─────────────────────────────────────────────────────────

  createSession(input: SessionCreate): Promise<Result<GymSession>> {
    return attempt(async () => {
      const v = validate(SessionCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const session: GymSession = {
        id: uuidv7(),
        date: v.data.date,
        plan_id: v.data.plan_id ?? null,
        started_at: v.data.started_at ?? null,
        finished_at: v.data.finished_at ?? null,
        notes: v.data.notes ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.gym_sessions.add(session);
      return ok(session);
    });
  }

  updateSession(id: string, patch: SessionPatch): Promise<Result<GymSession>> {
    return attempt(async () => {
      const v = validate(SessionPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getSessionById(id);
      if (!current) return err("not_found", SESSIONE_NON_TROVATA);
      const d = v.data;
      const next: GymSession = {
        ...current,
        ...(d.date !== undefined && { date: d.date }),
        ...(d.plan_id !== undefined && { plan_id: d.plan_id }),
        ...(d.started_at !== undefined && { started_at: d.started_at }),
        ...(d.finished_at !== undefined && { finished_at: d.finished_at }),
        ...(d.notes !== undefined && { notes: d.notes }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.gym_sessions.put(next);
      return ok(next);
    });
  }

  /** Tombstone alla sessione E a tutti i suoi set (transazione unica). */
  softDeleteSession(id: string): Promise<Result<void>> {
    return attempt(async () => {
      return this.db.transaction(
        "rw",
        [this.db.gym_sessions, this.db.gym_sets],
        async () => {
          const row = await this.db.gym_sessions.get(id);
          if (!row) return err<void>("not_found", SESSIONE_NON_TROVATA);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.gym_sessions.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          const sets = await this.db.gym_sets
            .where("session_id")
            .equals(id)
            .toArray();
          const doomed = sets
            .filter(alive)
            .map((s) => ({
              ...s,
              deleted_at: now,
              updated_at: bumpFrom(this.clock, s.updated_at),
            }));
          if (doomed.length > 0) await this.db.gym_sets.bulkPut(doomed);
          return ok(undefined);
        },
      );
    });
  }

  async getSessionById(id: string): Promise<GymSession | null> {
    const row = await this.db.gym_sessions.get(id);
    return row && alive(row) ? row : null;
  }

  async listSessionsByDay(date: IsoDay): Promise<GymSession[]> {
    const rows = await this.db.gym_sessions.where("date").equals(date).toArray();
    return rows.filter(alive).sort(byCreated);
  }

  async listSessionsRange(from: IsoDay, to: IsoDay): Promise<GymSession[]> {
    const rows = await this.db.gym_sessions
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return rows
      .filter(alive)
      .sort((a, b) => a.date.localeCompare(b.date) || byCreated(a, b));
  }

  // ── Set ──────────────────────────────────────────────────────────────

  addSet(input: SetCreate): Promise<Result<GymSet>> {
    return attempt(async () => {
      const v = validate(SetCreateSchema, input);
      if (!v.ok) return v;
      const session = await this.getSessionById(v.data.session_id);
      if (!session) return err("not_found", SESSIONE_NON_TROVATA);
      const now = this.clock();
      const set: GymSet = {
        id: uuidv7(),
        session_id: v.data.session_id,
        exercise_id: v.data.exercise_id,
        set_number:
          v.data.set_number ??
          (await this.nextSetNumber(v.data.session_id, v.data.exercise_id)),
        weight_kg: v.data.weight_kg ?? null,
        reps: v.data.reps,
        done_at: v.data.done_at ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.gym_sets.add(set);
      return ok(set);
    });
  }

  updateSet(id: string, patch: SetPatch): Promise<Result<GymSet>> {
    return attempt(async () => {
      const v = validate(SetPatchSchema, patch);
      if (!v.ok) return v;
      const row = await this.db.gym_sets.get(id);
      if (!row || !alive(row)) return err("not_found", SET_NON_TROVATO);
      const d = v.data;
      const next: GymSet = {
        ...row,
        ...(d.exercise_id !== undefined && { exercise_id: d.exercise_id }),
        ...(d.set_number !== undefined && { set_number: d.set_number }),
        ...(d.weight_kg !== undefined && { weight_kg: d.weight_kg }),
        ...(d.reps !== undefined && { reps: d.reps }),
        ...(d.done_at !== undefined && { done_at: d.done_at }),
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.gym_sets.put(next);
      return ok(next);
    });
  }

  softDeleteSet(id: string): Promise<Result<void>> {
    return this.softDeleteRow(this.db.gym_sets, id, SET_NON_TROVATO);
  }

  async listSetsBySession(sessionId: string): Promise<GymSet[]> {
    const rows = await this.db.gym_sets
      .where("session_id")
      .equals(sessionId)
      .toArray();
    return rows
      .filter(alive)
      .sort(
        (a, b) =>
          a.exercise_id.localeCompare(b.exercise_id) ||
          a.set_number - b.set_number,
      );
  }

  async listSetsByExercise(
    exerciseId: string,
    opts?: { limit?: number },
  ): Promise<GymSet[]> {
    const rows = await this.db.gym_sets
      .where("exercise_id")
      .equals(exerciseId)
      .toArray();
    const sorted = rows
      .filter(alive)
      // Più recenti prima: id UUIDv7 = ordine di creazione.
      .sort((a, b) => b.id.localeCompare(a.id));
    return opts?.limit !== undefined ? sorted.slice(0, opts.limit) : sorted;
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => {
      const counts = await Promise.all([
        purgeTable(this.db.gym_exercises, olderThan),
        purgeTable(this.db.gym_plans, olderThan),
        purgeTable(this.db.gym_sessions, olderThan),
        purgeTable(this.db.gym_sets, olderThan),
      ]);
      return ok(counts.reduce((a, b) => a + b, 0));
    });
  }

  // ── Interni ──────────────────────────────────────────────────────────

  private softDeleteRow<
    T extends { deleted_at: string | null; updated_at: string },
  >(
    table: Table<T, string>,
    id: string,
    missingMessage: string,
  ): Promise<Result<void>> {
    return attempt(async () => {
      const row = await table.get(id);
      if (!row) return err("not_found", missingMessage);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await table.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  private async nextSetNumber(
    sessionId: string,
    exerciseId: string,
  ): Promise<number> {
    const rows = await this.db.gym_sets
      .where("session_id")
      .equals(sessionId)
      .toArray();
    const nums = rows
      .filter((s) => alive(s) && s.exercise_id === exerciseId)
      .map((s) => s.set_number);
    return nums.length > 0 ? Math.max(...nums) + 1 : 1;
  }
}

function byCreated(a: { created_at: string }, b: { created_at: string }) {
  return a.created_at.localeCompare(b.created_at);
}
