/** RemindersRepo su Dexie — coda dei promemoria per il prompt 12. */

import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  ReminderCreateSchema,
  ReminderPatchSchema,
  type IsoInstant,
  type Reminder,
  type ReminderCreate,
  type ReminderPatch,
} from "../schemas";
import type { RemindersRepo } from "../ports";
import { alive, monotonicClock, purgeTable, validate, type Clock } from "./util";

const PROMEMORIA_NON_TROVATO = "Promemoria non trovato (o già eliminato).";

export class LocalRemindersRepo implements RemindersRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: ReminderCreate): Promise<Result<Reminder>> {
    return attempt(async () => {
      const v = validate(ReminderCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const reminder: Reminder = {
        id: uuidv7(),
        kind: v.data.kind,
        ref_id: v.data.ref_id,
        fire_at: v.data.fire_at,
        fired_at: null,
        dismissed_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.reminders.add(reminder);
      return ok(reminder);
    });
  }

  update(id: string, patch: ReminderPatch): Promise<Result<Reminder>> {
    return attempt(async () => {
      const v = validate(ReminderPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getById(id);
      if (!current) return err("not_found", PROMEMORIA_NON_TROVATO);
      const next: Reminder = {
        ...current,
        ...(v.data.fire_at !== undefined && {
          fire_at: v.data.fire_at,
          // Rischedulare un promemoria lo riarma: torna vergine.
          fired_at: null,
          dismissed_at: null,
        }),
        updated_at: this.clock(),
      };
      await this.db.reminders.put(next);
      return ok(next);
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.reminders.get(id);
      if (!row) return err("not_found", PROMEMORIA_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined);
      const now = this.clock();
      await this.db.reminders.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  async getById(id: string): Promise<Reminder | null> {
    const row = await this.db.reminders.get(id);
    return row && alive(row) ? row : null;
  }

  async listPending(now: IsoInstant): Promise<Reminder[]> {
    const rows = await this.db.reminders
      .where("fire_at")
      .belowOrEqual(now)
      .toArray();
    return rows
      .filter(
        (r) => alive(r) && r.fired_at === null && r.dismissed_at === null,
      )
      .sort((a, b) => a.fire_at.localeCompare(b.fire_at));
  }

  async listUpcoming(from: IsoInstant, to: IsoInstant): Promise<Reminder[]> {
    const rows = await this.db.reminders
      .where("fire_at")
      .between(from, to, true, true)
      .toArray();
    return rows
      .filter((r) => alive(r) && r.dismissed_at === null)
      .sort((a, b) => a.fire_at.localeCompare(b.fire_at));
  }

  async listByRef(refId: string): Promise<Reminder[]> {
    const rows = await this.db.reminders.where("ref_id").equals(refId).toArray();
    return rows
      .filter(alive)
      .sort((a, b) => a.fire_at.localeCompare(b.fire_at));
  }

  async listFiredUndismissed(): Promise<Reminder[]> {
    // fired_at non è indicizzato: scansione filtrata, scala personale.
    const rows = await this.db.reminders
      .filter(
        (r) => alive(r) && r.fired_at !== null && r.dismissed_at === null,
      )
      .toArray();
    return rows.sort((a, b) => b.fire_at.localeCompare(a.fire_at));
  }

  markFired(id: string, at: IsoInstant): Promise<Result<Reminder>> {
    return this.stamp(id, { fired_at: at });
  }

  dismiss(id: string, at: IsoInstant): Promise<Result<Reminder>> {
    return this.stamp(id, { dismissed_at: at });
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () =>
      ok(await purgeTable(this.db.reminders, olderThan)),
    );
  }

  private stamp(
    id: string,
    fields: Partial<Pick<Reminder, "fired_at" | "dismissed_at">>,
  ): Promise<Result<Reminder>> {
    return attempt(async () => {
      const current = await this.getById(id);
      if (!current) return err("not_found", PROMEMORIA_NON_TROVATO);
      const next: Reminder = {
        ...current,
        ...fields,
        updated_at: this.clock(),
      };
      await this.db.reminders.put(next);
      return ok(next);
    });
  }
}
