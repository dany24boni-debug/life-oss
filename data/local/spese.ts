/** SpeseRepo su Dexie — stesse convenzioni di events.ts (run-05 prompt 4). */

import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  ExpenseCreateSchema,
  ExpensePatchSchema,
  type Expense,
  type ExpenseCreate,
  type ExpensePatch,
  type IsoInstant,
} from "../schemas";
import type { SpeseRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const SPESA_NON_TROVATA = "Spesa non trovata (o già eliminata).";

const MONTH_RE = /^\d{4}-\d{2}$/;

export class LocalSpeseRepo implements SpeseRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: ExpenseCreate): Promise<Result<Expense>> {
    return attempt(async () => {
      const v = validate(ExpenseCreateSchema, input);
      if (!v.ok) return v;
      const data = v.data;
      const now = this.clock();
      const expense: Expense = {
        id: uuidv7(),
        amount: data.amount,
        category: data.category,
        date: data.date,
        note: data.note ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.spese.add(expense);
      return ok(expense);
    });
  }

  update(id: string, patch: ExpensePatch): Promise<Result<Expense>> {
    return attempt(async () => {
      const v = validate(ExpensePatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getById(id);
      if (!current) return err("not_found", SPESA_NON_TROVATA);
      const data = v.data;
      const next: Expense = {
        ...current,
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.note !== undefined && { note: data.note }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.spese.put(next);
      return ok(next);
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.spese.get(id);
      if (!row) return err("not_found", SPESA_NON_TROVATA);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.spese.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  restore(id: string): Promise<Result<Expense>> {
    return attempt(async () => {
      const row = await this.db.spese.get(id);
      if (!row) return err("not_found", SPESA_NON_TROVATA);
      if (row.deleted_at === null) return ok(row); // idempotente
      const next: Expense = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.spese.put(next);
      return ok(next);
    });
  }

  async getById(id: string): Promise<Expense | null> {
    const row = await this.db.spese.get(id);
    return row && alive(row) ? row : null;
  }

  async listMonth(month: string): Promise<Expense[]> {
    if (!MONTH_RE.test(month)) return [];
    // Confronto lessicale sicuro: i giorni sono "YYYY-MM-DD" zero-padded.
    const rows = await this.db.spese
      .where("date")
      .between(`${month}-01`, `${month}-31`, true, true)
      .toArray();
    return rows
      .filter(alive)
      .sort(
        (a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
      );
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.spese, olderThan)));
  }
}
