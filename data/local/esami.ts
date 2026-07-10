/** EsamiRepo su Dexie — stesse convenzioni di events.ts (run-05 prompt 3). */

import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  ExamCreateSchema,
  ExamPatchSchema,
  type Exam,
  type ExamCreate,
  type ExamPatch,
  type IsoInstant,
} from "../schemas";
import type { EsamiRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const ESAME_NON_TROVATO = "Esame non trovato (o già eliminato).";

export class LocalEsamiRepo implements EsamiRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: ExamCreate): Promise<Result<Exam>> {
    return attempt(async () => {
      const v = validate(ExamCreateSchema, input);
      if (!v.ok) return v;
      const data = v.data;
      const now = this.clock();
      const total = data.total_chapters ?? 0;
      const exam: Exam = {
        id: uuidv7(),
        title: data.title,
        date: data.date,
        total_chapters: total,
        // Invariante alla nascita: mai oltre il totale.
        completed_chapters: Math.min(data.completed_chapters ?? 0, total),
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.esami.add(exam);
      return ok(exam);
    });
  }

  update(id: string, patch: ExamPatch): Promise<Result<Exam>> {
    return attempt(async () => {
      const v = validate(ExamPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getById(id);
      if (!current) return err("not_found", ESAME_NON_TROVATO);
      const data = v.data;
      const merged: Exam = {
        ...current,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.total_chapters !== undefined && {
          total_chapters: data.total_chapters,
        }),
        ...(data.completed_chapters !== undefined && {
          completed_chapters: data.completed_chapters,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      // Invariante sulla riga risultante: clamp, mai errore (abbassare il
      // totale è un gesto legittimo e i completati lo seguono).
      const next: Exam = {
        ...merged,
        completed_chapters: Math.min(
          merged.completed_chapters,
          merged.total_chapters,
        ),
      };
      await this.db.esami.put(next);
      return ok(next);
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.esami.get(id);
      if (!row) return err("not_found", ESAME_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.esami.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  restore(id: string): Promise<Result<Exam>> {
    return attempt(async () => {
      const row = await this.db.esami.get(id);
      if (!row) return err("not_found", ESAME_NON_TROVATO);
      if (row.deleted_at === null) return ok(row); // idempotente
      const next: Exam = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.esami.put(next);
      return ok(next);
    });
  }

  async getById(id: string): Promise<Exam | null> {
    const row = await this.db.esami.get(id);
    return row && alive(row) ? row : null;
  }

  async listAll(): Promise<Exam[]> {
    const rows = await this.db.esami.toArray();
    return rows
      .filter(alive)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.title.localeCompare(b.title),
      );
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.esami, olderThan)));
  }
}
