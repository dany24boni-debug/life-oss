/**
 * TasksRepo su Dexie. Semantica delle scritture:
 *   - soft delete = set deleted_at (+ bump updated_at, serve al sync)
 *   - ogni lettura filtra le tombstone
 *   - ogni scrittura bumpa updated_at (clock monotono di default)
 */

import type { LifeosDb } from "../db";
import { deriveUuidV8, uuidv7 } from "../ids";
import {
  buildSpawnTask,
  maxDay,
  nextOccurrence,
  normalizeRecurrence,
} from "../recurrence";
import { attempt, err, ok, type Result } from "../result";
import {
  TaskCreateSchema,
  TaskPatchSchema,
  type IsoDay,
  type IsoInstant,
  type Subtask,
  type SubtaskInput,
  type Task,
  type TaskCreate,
  type TaskPatch,
} from "../schemas";
import type { TasksRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const TASK_NON_TROVATO = "Task non trovato (o già eliminato).";

/** Id deterministico della prossima occorrenza (dal task completato). */
export function taskRecurSpawnId(completedTaskId: string): Promise<string> {
  return deriveUuidV8(`lifeos:task-recur:${completedTaskId}`);
}

export class LocalTasksRepo implements TasksRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: TaskCreate): Promise<Result<Task>> {
    return attempt(async () => {
      const v = validate(TaskCreateSchema, input);
      if (!v.ok) return v;
      const data = v.data;
      const now = this.clock();
      const task: Task = {
        id: uuidv7(),
        title: data.title,
        notes: data.notes ?? null,
        date: data.date ?? null,
        time: data.time ?? null,
        priority: data.priority ?? null,
        tags: data.tags ?? [],
        module_link: data.module_link ?? null,
        status: "open",
        completed_at: null,
        recurrence: data.recurrence ? normalizeRecurrence(data.recurrence) : null,
        estimate_min: data.estimate_min ?? null,
        sort_order: await this.nextSortOrder(),
        subtasks: fillSubtaskIds(data.subtasks ?? []),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.tasks.add(task);
      return ok(task);
    });
  }

  update(id: string, patch: TaskPatch): Promise<Result<Task>> {
    return attempt(async () => {
      const v = validate(TaskPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getById(id);
      if (!current) return err("not_found", TASK_NON_TROVATO);
      const data = v.data;
      const next: Task = {
        ...current,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.time !== undefined && { time: data.time }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.module_link !== undefined && { module_link: data.module_link }),
        ...(data.recurrence !== undefined && {
          recurrence:
            data.recurrence === null
              ? null
              : normalizeRecurrence(data.recurrence),
        }),
        ...(data.estimate_min !== undefined && {
          estimate_min: data.estimate_min,
        }),
        ...(data.subtasks !== undefined && {
          subtasks: fillSubtaskIds(data.subtasks),
        }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.tasks.put(next);
      return ok(next);
    });
  }

  complete(id: string, opts?: { today?: IsoDay }): Promise<Result<Task>> {
    return attempt(async () => {
      const current = await this.getById(id);
      if (!current) return err("not_found", TASK_NON_TROVATO);
      if (current.status === "done") return ok(current); // idempotente
      // L'id derivato usa crypto.subtle (promise nativa): va calcolato
      // PRIMA della transazione Dexie (lezione run-07: dentro, la
      // farebbe committare troppo presto).
      const spawnId = current.recurrence
        ? await taskRecurSpawnId(current.id)
        : null;
      const now = bumpFrom(this.clock, current.updated_at);
      const next: Task = {
        ...current,
        status: "done",
        completed_at: now,
        updated_at: now,
      };
      return this.db.transaction("rw", this.db.tasks, async () => {
        await this.db.tasks.put(next);
        if (spawnId !== null && current.recurrence) {
          // Prossima occorrenza: strettamente dopo max(oggi, data del
          // task) — un ricorrente in ritardo completato oggi riparte
          // da oggi, non accumula occorrenze fantasma.
          const today = opts?.today ?? now.slice(0, 10);
          const date = nextOccurrence(
            current.recurrence,
            maxDay(today, current.date ?? today),
          );
          const existing = await this.db.tasks.get(spawnId);
          const spawn = buildSpawnTask(current, {
            id: spawnId,
            date,
            now: this.clock(),
            sortOrder: await this.nextSortOrder(),
          });
          if (existing) {
            // Già generata (altro device) o tombstonata da un undo:
            // ri-completare È l'intento — si rianima con la data nuova.
            await this.db.tasks.put({
              ...spawn,
              created_at: existing.created_at,
              sort_order: existing.sort_order,
              updated_at: bumpFrom(this.clock, existing.updated_at),
            });
          } else {
            await this.db.tasks.add(spawn);
          }
        }
        return ok(next);
      });
    });
  }

  uncomplete(id: string): Promise<Result<Task>> {
    return attempt(async () => {
      const current = await this.getById(id);
      if (!current) return err("not_found", TASK_NON_TROVATO);
      if (current.status === "open") return ok(current); // idempotente
      const spawnId = current.recurrence
        ? await taskRecurSpawnId(current.id)
        : null;
      const next: Task = {
        ...current,
        status: "open",
        completed_at: null,
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      return this.db.transaction("rw", this.db.tasks, async () => {
        await this.db.tasks.put(next);
        if (spawnId !== null) {
          // L'undo del "fatto" annulla anche la prossima occorrenza —
          // ma solo se è ancora una spawn intonsa (aperta e viva).
          const spawn = await this.db.tasks.get(spawnId);
          if (spawn && spawn.deleted_at === null && spawn.status === "open") {
            const mark = bumpFrom(this.clock, spawn.updated_at);
            await this.db.tasks.put({
              ...spawn,
              deleted_at: mark,
              updated_at: mark,
            });
          }
        }
        return ok(next);
      });
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.tasks.get(id);
      if (!row) return err("not_found", TASK_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined); // idempotente
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.tasks.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  restore(id: string): Promise<Result<Task>> {
    return attempt(async () => {
      const row = await this.db.tasks.get(id);
      if (!row) return err("not_found", TASK_NON_TROVATO);
      if (row.deleted_at === null) return ok(row); // idempotente
      const next: Task = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.tasks.put(next);
      return ok(next);
    });
  }

  reorder(orderedIds: string[]): Promise<Result<void>> {
    return attempt(async () => {
      await this.db.transaction("rw", this.db.tasks, async () => {
        const rows = await this.db.tasks.bulkGet(orderedIds);
        const updates: Task[] = [];
        for (let i = 0; i < orderedIds.length; i++) {
          const row = rows[i];
          if (!row || row.deleted_at !== null) continue; // id ignoto: salta
          if (row.sort_order === i) continue;
          updates.push({
            ...row,
            sort_order: i,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        if (updates.length > 0) await this.db.tasks.bulkPut(updates);
      });
      return ok(undefined);
    });
  }

  async getById(id: string): Promise<Task | null> {
    const row = await this.db.tasks.get(id);
    return row && alive(row) ? row : null;
  }

  async listByDay(date: IsoDay): Promise<Task[]> {
    const rows = await this.db.tasks.where("date").equals(date).toArray();
    return rows.filter(alive).sort(bySortOrder);
  }

  async listOverdue(today: IsoDay): Promise<Task[]> {
    const rows = await this.db.tasks.where("date").below(today).toArray();
    return rows
      .filter((t) => alive(t) && t.status === "open")
      .sort(byDateThenSortOrder);
  }

  async listInbox(): Promise<Task[]> {
    // date null non entra nell'indice: scansione filtrata (scala personale).
    const rows = await this.db.tasks
      .filter((t) => t.date === null && alive(t))
      .toArray();
    return rows.sort(bySortOrder);
  }

  async listUpcoming(from: IsoDay, to: IsoDay): Promise<Task[]> {
    const rows = await this.db.tasks
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return rows.filter(alive).sort(byDateThenSortOrder);
  }

  async listDone(opts?: {
    limit?: number;
    before?: IsoInstant;
  }): Promise<Task[]> {
    const limit = opts?.limit ?? 50;
    const before = opts?.before;
    const rows = await this.db.tasks.where("status").equals("done").toArray();
    return rows
      .filter(
        (t) =>
          alive(t) &&
          t.completed_at !== null &&
          (before === undefined || t.completed_at < before),
      )
      .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))
      .slice(0, limit);
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.tasks, olderThan)));
  }

  /** I nuovi task vanno in coda: max sort_order vivo + 1. */
  private async nextSortOrder(): Promise<number> {
    const last = await this.db.tasks.orderBy("sort_order").last();
    return last ? last.sort_order + 1 : 0;
  }
}

function fillSubtaskIds(subtasks: SubtaskInput[]): Subtask[] {
  return subtasks.map((s) => ({
    id: s.id ?? uuidv7(),
    title: s.title,
    done: s.done ?? false,
  }));
}

function bySortOrder(a: Task, b: Task): number {
  return a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);
}

function byDateThenSortOrder(a: Task, b: Task): number {
  const byDate = (a.date ?? "").localeCompare(b.date ?? "");
  return byDate !== 0 ? byDate : bySortOrder(a, b);
}
