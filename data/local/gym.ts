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
  ProgramCreateSchema,
  ProgramDayCreateSchema,
  ProgramDayPatchSchema,
  ProgramPatchSchema,
  ProgramSlotCreateSchema,
  ProgramSlotPatchSchema,
  SessionCreateSchema,
  SessionPatchSchema,
  SetCreateSchema,
  SetPatchSchema,
  type ExerciseCreate,
  type ExercisePatch,
  type GymExercise,
  type GymPlan,
  type GymProgram,
  type GymProgramDay,
  type GymProgramSlot,
  type GymSession,
  type GymSet,
  type IsoDay,
  type IsoInstant,
  type MuscleGroup,
  type PlanCreate,
  type PlanPatch,
  type ProgramCreate,
  type ProgramDayCreate,
  type ProgramDayPatch,
  type ProgramPatch,
  type ProgramSlotCreate,
  type ProgramSlotPatch,
  type SessionCreate,
  type SessionPatch,
  type SetCreate,
  type SetPatch,
} from "../schemas";
import { nextDayInRotation } from "../gym-programs";
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
const PROGRAMMA_NON_TROVATO = "Programma non trovato (o già eliminato).";
const GIORNO_NON_TROVATO = "Giorno non trovato (o già eliminato).";
const SLOT_NON_TROVATO = "Esercizio del giorno non trovato (o già eliminato).";
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

  // ── Programmi (run-07) ───────────────────────────────────────────────

  createProgram(input: ProgramCreate): Promise<Result<GymProgram>> {
    return attempt(async () => {
      const v = validate(ProgramCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const program: GymProgram = {
        id: uuidv7(),
        name: v.data.name,
        notes: v.data.notes ?? null,
        is_active: v.data.is_active ?? false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      return this.db.transaction("rw", this.db.gym_programs, async () => {
        if (program.is_active) await this.deactivateOtherPrograms(program.id);
        await this.db.gym_programs.add(program);
        return ok(program);
      });
    });
  }

  updateProgram(id: string, patch: ProgramPatch): Promise<Result<GymProgram>> {
    return attempt(async () => {
      const v = validate(ProgramPatchSchema, patch);
      if (!v.ok) return v;
      const d = v.data;
      return this.db.transaction("rw", this.db.gym_programs, async () => {
        const current = await this.getProgramById(id);
        if (!current) return err<GymProgram>("not_found", PROGRAMMA_NON_TROVATO);
        const next: GymProgram = {
          ...current,
          ...(d.name !== undefined && { name: d.name }),
          ...(d.notes !== undefined && { notes: d.notes }),
          ...(d.is_active !== undefined && { is_active: d.is_active }),
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        if (next.is_active && !current.is_active) {
          await this.deactivateOtherPrograms(id);
        }
        await this.db.gym_programs.put(next);
        return ok(next);
      });
    });
  }

  /** Tombstone a programma + giorni + slot, con lo STESSO deleted_at. */
  softDeleteProgram(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.programTables(), async () => {
        const row = await this.db.gym_programs.get(id);
        if (!row) return err<void>("not_found", PROGRAMMA_NON_TROVATO);
        if (row.deleted_at !== null) return ok(undefined);
        const now = bumpFrom(this.clock, row.updated_at);
        await this.db.gym_programs.put({
          ...row,
          deleted_at: now,
          updated_at: now,
        });
        const days = (
          await this.db.gym_program_days.where("program_id").equals(id).toArray()
        ).filter(alive);
        await this.tombstoneCascade(this.db.gym_program_days, days, now);
        const slots = (await this.slotsOfDays(days.map((d) => d.id))).filter(
          alive,
        );
        await this.tombstoneCascade(this.db.gym_program_slots, slots, now);
        return ok(undefined);
      }),
    );
  }

  /** Revive programma + righe del suo cascade (deleted_at identico). */
  restoreProgram(id: string): Promise<Result<GymProgram>> {
    return attempt(async () =>
      this.db.transaction("rw", this.programTables(), async () => {
        const row = await this.db.gym_programs.get(id);
        if (!row) return err<GymProgram>("not_found", PROGRAMMA_NON_TROVATO);
        if (row.deleted_at === null) return ok(row);
        const mark = row.deleted_at;
        const next: GymProgram = {
          ...row,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, row.updated_at),
        };
        await this.db.gym_programs.put(next);
        const days = await this.db.gym_program_days
          .where("program_id")
          .equals(id)
          .toArray();
        await this.reviveCascade(this.db.gym_program_days, days, mark);
        const slots = await this.slotsOfDays(days.map((d) => d.id));
        await this.reviveCascade(this.db.gym_program_slots, slots, mark);
        return ok(next);
      }),
    );
  }

  duplicateProgram(id: string): Promise<Result<GymProgram>> {
    return attempt(async () =>
      this.db.transaction("rw", this.programTables(), async () => {
        const source = await this.getProgramById(id);
        if (!source) return err<GymProgram>("not_found", PROGRAMMA_NON_TROVATO);
        const now = this.clock();
        const copy: GymProgram = {
          ...source,
          id: uuidv7(),
          name: withCopySuffix(source.name),
          is_active: false,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        await this.db.gym_programs.add(copy);
        for (const day of await this.listProgramDays(id)) {
          const dayCopy: GymProgramDay = {
            ...day,
            id: uuidv7(),
            program_id: copy.id,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.gym_program_days.add(dayCopy);
          await this.copySlotsInto(day.id, dayCopy.id, now);
        }
        return ok(copy);
      }),
    );
  }

  async getProgramById(id: string): Promise<GymProgram | null> {
    const row = await this.db.gym_programs.get(id);
    return row && alive(row) ? row : null;
  }

  async listPrograms(): Promise<GymProgram[]> {
    const rows = await this.db.gym_programs.toArray();
    return rows
      .filter(alive)
      .sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          a.name.localeCompare(b.name, "it"),
      );
  }

  async activeProgram(): Promise<GymProgram | null> {
    const rows = (await this.db.gym_programs.toArray()).filter(
      (p) => alive(p) && p.is_active,
    );
    if (rows.length === 0) return null;
    // Più attivi possono coesistere dopo un merge di sync (le scritture
    // del pull non passano dal repo): vince l'updated_at più recente.
    return rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  }

  // ── Giorni di programma ──────────────────────────────────────────────

  createProgramDay(input: ProgramDayCreate): Promise<Result<GymProgramDay>> {
    return attempt(async () => {
      const v = validate(ProgramDayCreateSchema, input);
      if (!v.ok) return v;
      const d = v.data;
      return this.db.transaction(
        "rw",
        [this.db.gym_programs, this.db.gym_program_days],
        async () => {
          const program = await this.getProgramById(d.program_id);
          if (!program)
            return err<GymProgramDay>("not_found", PROGRAMMA_NON_TROVATO);
          const now = this.clock();
          const day: GymProgramDay = {
            id: uuidv7(),
            program_id: d.program_id,
            name: d.name,
            subtitle: d.subtitle ?? null,
            weekday: d.weekday ?? null,
            sort_order:
              d.sort_order ??
              (await this.nextSortOrder(
                this.db.gym_program_days,
                "program_id",
                d.program_id,
              )),
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.gym_program_days.add(day);
          return ok(day);
        },
      );
    });
  }

  updateProgramDay(
    id: string,
    patch: ProgramDayPatch,
  ): Promise<Result<GymProgramDay>> {
    return attempt(async () => {
      const v = validate(ProgramDayPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getProgramDayById(id);
      if (!current) return err("not_found", GIORNO_NON_TROVATO);
      const d = v.data;
      const next: GymProgramDay = {
        ...current,
        ...(d.name !== undefined && { name: d.name }),
        ...(d.subtitle !== undefined && { subtitle: d.subtitle }),
        ...(d.weekday !== undefined && { weekday: d.weekday }),
        ...(d.sort_order !== undefined && { sort_order: d.sort_order }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.gym_program_days.put(next);
      return ok(next);
    });
  }

  softDeleteProgramDay(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.gym_program_days, this.db.gym_program_slots],
        async () => {
          const row = await this.db.gym_program_days.get(id);
          if (!row) return err<void>("not_found", GIORNO_NON_TROVATO);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.gym_program_days.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          const slots = (
            await this.db.gym_program_slots.where("day_id").equals(id).toArray()
          ).filter(alive);
          await this.tombstoneCascade(this.db.gym_program_slots, slots, now);
          return ok(undefined);
        },
      ),
    );
  }

  restoreProgramDay(id: string): Promise<Result<GymProgramDay>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.gym_program_days, this.db.gym_program_slots],
        async () => {
          const row = await this.db.gym_program_days.get(id);
          if (!row) return err<GymProgramDay>("not_found", GIORNO_NON_TROVATO);
          if (row.deleted_at === null) return ok(row);
          const mark = row.deleted_at;
          const next: GymProgramDay = {
            ...row,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, row.updated_at),
          };
          await this.db.gym_program_days.put(next);
          const slots = await this.db.gym_program_slots
            .where("day_id")
            .equals(id)
            .toArray();
          await this.reviveCascade(this.db.gym_program_slots, slots, mark);
          return ok(next);
        },
      ),
    );
  }

  duplicateProgramDay(id: string): Promise<Result<GymProgramDay>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.gym_program_days, this.db.gym_program_slots],
        async () => {
          const source = await this.getProgramDayById(id);
          if (!source) return err<GymProgramDay>("not_found", GIORNO_NON_TROVATO);
          const now = this.clock();
          const copy: GymProgramDay = {
            ...source,
            id: uuidv7(),
            name: withCopySuffix(source.name),
            sort_order: await this.nextSortOrder(
              this.db.gym_program_days,
              "program_id",
              source.program_id,
            ),
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.gym_program_days.add(copy);
          await this.copySlotsInto(source.id, copy.id, now);
          return ok(copy);
        },
      ),
    );
  }

  async getProgramDayById(id: string): Promise<GymProgramDay | null> {
    const row = await this.db.gym_program_days.get(id);
    return row && alive(row) ? row : null;
  }

  async listProgramDays(programId: string): Promise<GymProgramDay[]> {
    const rows = await this.db.gym_program_days
      .where("program_id")
      .equals(programId)
      .toArray();
    return rows.filter(alive).sort(bySortOrder);
  }

  reorderProgramDays(
    programId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.gym_program_days, async () => {
        const rows = await this.db.gym_program_days.bulkGet(orderedIds);
        const updates: GymProgramDay[] = [];
        rows.forEach((row, index) => {
          if (!row || !alive(row) || row.program_id !== programId) return;
          if (row.sort_order === index) return;
          updates.push({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        });
        if (updates.length > 0)
          await this.db.gym_program_days.bulkPut(updates);
        return ok(undefined);
      }),
    );
  }

  // ── Slot (le righe della tabella-foglio) ─────────────────────────────

  createProgramSlot(
    input: ProgramSlotCreate,
  ): Promise<Result<GymProgramSlot>> {
    return attempt(async () => {
      const v = validate(ProgramSlotCreateSchema, input);
      if (!v.ok) return v;
      const d = v.data;
      return this.db.transaction(
        "rw",
        [this.db.gym_program_days, this.db.gym_program_slots],
        async () => {
          const day = await this.getProgramDayById(d.day_id);
          if (!day) return err<GymProgramSlot>("not_found", GIORNO_NON_TROVATO);
          const now = this.clock();
          const slot: GymProgramSlot = {
            id: uuidv7(),
            day_id: d.day_id,
            exercise_id: d.exercise_id,
            section: d.section ?? null,
            variant: d.variant ?? null,
            target_sets: d.target_sets ?? 3,
            target_reps: d.target_reps ?? null,
            target_rir: d.target_rir ?? null,
            rest_seconds: d.rest_seconds ?? null,
            bodyweight: d.bodyweight ?? false,
            notes: d.notes ?? null,
            sort_order:
              d.sort_order ??
              (await this.nextSortOrder(
                this.db.gym_program_slots,
                "day_id",
                d.day_id,
              )),
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.gym_program_slots.add(slot);
          return ok(slot);
        },
      );
    });
  }

  updateProgramSlot(
    id: string,
    patch: ProgramSlotPatch,
  ): Promise<Result<GymProgramSlot>> {
    return attempt(async () => {
      const v = validate(ProgramSlotPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getProgramSlotById(id);
      if (!current) return err("not_found", SLOT_NON_TROVATO);
      const d = v.data;
      const next: GymProgramSlot = {
        ...current,
        ...(d.exercise_id !== undefined && { exercise_id: d.exercise_id }),
        ...(d.section !== undefined && { section: d.section }),
        ...(d.variant !== undefined && { variant: d.variant }),
        ...(d.target_sets !== undefined && { target_sets: d.target_sets }),
        ...(d.target_reps !== undefined && { target_reps: d.target_reps }),
        ...(d.target_rir !== undefined && { target_rir: d.target_rir }),
        ...(d.rest_seconds !== undefined && { rest_seconds: d.rest_seconds }),
        ...(d.bodyweight !== undefined && { bodyweight: d.bodyweight }),
        ...(d.notes !== undefined && { notes: d.notes }),
        ...(d.sort_order !== undefined && { sort_order: d.sort_order }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.gym_program_slots.put(next);
      return ok(next);
    });
  }

  softDeleteProgramSlot(id: string): Promise<Result<void>> {
    return this.softDeleteRow(this.db.gym_program_slots, id, SLOT_NON_TROVATO);
  }

  restoreProgramSlot(id: string): Promise<Result<GymProgramSlot>> {
    return attempt(async () => {
      const row = await this.db.gym_program_slots.get(id);
      if (!row) return err<GymProgramSlot>("not_found", SLOT_NON_TROVATO);
      if (row.deleted_at === null) return ok(row);
      const next: GymProgramSlot = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.gym_program_slots.put(next);
      return ok(next);
    });
  }

  duplicateProgramSlot(id: string): Promise<Result<GymProgramSlot>> {
    return attempt(async () => {
      const source = await this.getProgramSlotById(id);
      if (!source) return err<GymProgramSlot>("not_found", SLOT_NON_TROVATO);
      const now = this.clock();
      const copy: GymProgramSlot = {
        ...source,
        id: uuidv7(),
        // Subito sotto l'originale: mezzo passo, normalizzato dal
        // prossimo reorder (che riassegna interi 0..n).
        sort_order: source.sort_order + 0.5,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.gym_program_slots.add(copy);
      return ok(copy);
    });
  }

  async getProgramSlotById(id: string): Promise<GymProgramSlot | null> {
    const row = await this.db.gym_program_slots.get(id);
    return row && alive(row) ? row : null;
  }

  async listProgramSlots(dayId: string): Promise<GymProgramSlot[]> {
    const rows = await this.db.gym_program_slots
      .where("day_id")
      .equals(dayId)
      .toArray();
    return rows.filter(alive).sort(bySortOrder);
  }

  reorderProgramSlots(
    dayId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.gym_program_slots, async () => {
        const rows = await this.db.gym_program_slots.bulkGet(orderedIds);
        const updates: GymProgramSlot[] = [];
        rows.forEach((row, index) => {
          if (!row || !alive(row) || row.day_id !== dayId) return;
          if (row.sort_order === index) return;
          updates.push({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        });
        if (updates.length > 0)
          await this.db.gym_program_slots.bulkPut(updates);
        return ok(undefined);
      }),
    );
  }

  startSessionFromDay(
    dayId: string,
    date: IsoDay,
    startedAt?: IsoInstant,
  ): Promise<Result<GymSession>> {
    return attempt(async () => {
      const day = await this.getProgramDayById(dayId);
      if (!day) return err<GymSession>("not_found", GIORNO_NON_TROVATO);
      return this.createSession({
        date,
        program_day_id: dayId,
        started_at: startedAt ?? new Date().toISOString(),
      });
    });
  }

  async nextUpDay(): Promise<GymProgramDay | null> {
    const program = await this.activeProgram();
    if (!program) return null;
    const days = await this.listProgramDays(program.id);
    if (days.length === 0) return null;
    const dayIds = new Set(days.map((d) => d.id));
    // L'ultima seduta fatta su un giorno di QUESTO programma (le sessioni
    // libere e quelle di altri programmi non muovono la rotazione).
    const sessions = (await this.db.gym_sessions.toArray()).filter(
      (s) =>
        alive(s) &&
        s.program_day_id !== null &&
        dayIds.has(s.program_day_id),
    );
    const last = sessions.sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        (b.started_at ?? b.created_at).localeCompare(
          a.started_at ?? a.created_at,
        ),
    )[0];
    return nextDayInRotation(days, last?.program_day_id ?? null);
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
        program_day_id: v.data.program_day_id ?? null,
        started_at: v.data.started_at ?? null,
        finished_at: v.data.finished_at ?? null,
        rating_1_10: v.data.rating_1_10 ?? null,
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
        ...(d.program_day_id !== undefined && {
          program_day_id: d.program_day_id,
        }),
        ...(d.started_at !== undefined && { started_at: d.started_at }),
        ...(d.finished_at !== undefined && { finished_at: d.finished_at }),
        ...(d.rating_1_10 !== undefined && { rating_1_10: d.rating_1_10 }),
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
        rir_done: v.data.rir_done ?? null,
        rest_actual_s: v.data.rest_actual_s ?? null,
        feeling_1_10: v.data.feeling_1_10 ?? null,
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
        ...(d.rir_done !== undefined && { rir_done: d.rir_done }),
        ...(d.rest_actual_s !== undefined && {
          rest_actual_s: d.rest_actual_s,
        }),
        ...(d.feeling_1_10 !== undefined && { feeling_1_10: d.feeling_1_10 }),
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
        purgeTable(this.db.gym_programs, olderThan),
        purgeTable(this.db.gym_program_days, olderThan),
        purgeTable(this.db.gym_program_slots, olderThan),
        purgeTable(this.db.gym_sessions, olderThan),
        purgeTable(this.db.gym_sets, olderThan),
      ]);
      return ok(counts.reduce((a, b) => a + b, 0));
    });
  }

  // ── Interni ──────────────────────────────────────────────────────────

  private programTables() {
    return [
      this.db.gym_programs,
      this.db.gym_program_days,
      this.db.gym_program_slots,
    ];
  }

  /** Spegne is_active su ogni altro programma vivo (al più uno attivo). */
  private async deactivateOtherPrograms(exceptId: string): Promise<void> {
    const rows = await this.db.gym_programs.toArray();
    const updates = rows
      .filter((p) => alive(p) && p.is_active && p.id !== exceptId)
      .map((p) => ({
        ...p,
        is_active: false,
        updated_at: bumpFrom(this.clock, p.updated_at),
      }));
    if (updates.length > 0) await this.db.gym_programs.bulkPut(updates);
  }

  /** Tutti gli slot dei giorni dati (vivi e no: filtrano i chiamanti). */
  private async slotsOfDays(dayIds: string[]): Promise<GymProgramSlot[]> {
    if (dayIds.length === 0) return [];
    return this.db.gym_program_slots.where("day_id").anyOf(dayIds).toArray();
  }

  /** Tombstone in blocco con lo STESSO deleted_at (marchio del cascade). */
  private async tombstoneCascade<
    T extends { deleted_at: string | null; updated_at: string },
  >(table: Table<T, string>, rows: T[], mark: IsoInstant): Promise<void> {
    if (rows.length === 0) return;
    await table.bulkPut(
      rows.map((row) => ({
        ...row,
        deleted_at: mark,
        updated_at: bumpFrom(this.clock, row.updated_at),
      })),
    );
  }

  /** Revive SOLO le righe cancellate da quel cascade (deleted_at = mark). */
  private async reviveCascade<
    T extends { deleted_at: string | null; updated_at: string },
  >(table: Table<T, string>, rows: T[], mark: IsoInstant): Promise<void> {
    const revived = rows
      .filter((row) => row.deleted_at === mark)
      .map((row) => ({
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      }));
    if (revived.length > 0) await table.bulkPut(revived);
  }

  /** Copia gli slot vivi di un giorno dentro un altro (id nuovi). */
  private async copySlotsInto(
    fromDayId: string,
    toDayId: string,
    now: IsoInstant,
  ): Promise<void> {
    const slots = await this.listProgramSlots(fromDayId);
    if (slots.length === 0) return;
    await this.db.gym_program_slots.bulkAdd(
      slots.map((slot) => ({
        ...slot,
        id: uuidv7(),
        day_id: toDayId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      })),
    );
  }

  /** sort_order in coda: max tra le righe vive del genitore, +1 (da 0). */
  private async nextSortOrder<
    T extends { deleted_at: string | null; sort_order: number },
  >(
    table: Table<T, string>,
    parentKey: "program_id" | "day_id",
    parentId: string,
  ): Promise<number> {
    const rows = await table.where(parentKey).equals(parentId).toArray();
    const orders = rows.filter(alive).map((r) => r.sort_order);
    return orders.length > 0 ? Math.max(...orders) + 1 : 0;
  }

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

function bySortOrder(
  a: { sort_order: number; created_at: string },
  b: { sort_order: number; created_at: string },
) {
  return a.sort_order - b.sort_order || byCreated(a, b);
}

/** "Torso A" → "Torso A (copia)", rispettando il tetto dei 120 caratteri. */
function withCopySuffix(name: string): string {
  const suffix = " (copia)";
  return name.length + suffix.length <= 120
    ? `${name}${suffix}`
    : `${name.slice(0, 120 - suffix.length)}${suffix}`;
}
