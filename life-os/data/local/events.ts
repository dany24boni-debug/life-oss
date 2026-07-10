/** EventsRepo su Dexie — stesse convenzioni di tasks.ts. */

import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  EventCreateSchema,
  EventPatchSchema,
  type EventCreate,
  type EventPatch,
  type IsoDay,
  type IsoInstant,
  type LocalEvent,
} from "../schemas";
import type { EventsRepo } from "../ports";
import { alive, monotonicClock, purgeTable, validate, type Clock } from "./util";

const EVENTO_NON_TROVATO = "Evento non trovato (o già eliminato).";

export class LocalEventsRepo implements EventsRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: EventCreate): Promise<Result<LocalEvent>> {
    return attempt(async () => {
      const v = validate(EventCreateSchema, input);
      if (!v.ok) return v;
      const data = v.data;
      const now = this.clock();
      const event: LocalEvent = {
        id: uuidv7(),
        title: data.title,
        date: data.date,
        start_time: data.start_time ?? null,
        end_time: data.end_time ?? null,
        all_day: data.all_day ?? (data.start_time == null),
        notes: data.notes ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.events.add(event);
      return ok(event);
    });
  }

  update(id: string, patch: EventPatch): Promise<Result<LocalEvent>> {
    return attempt(async () => {
      const v = validate(EventPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.getById(id);
      if (!current) return err("not_found", EVENTO_NON_TROVATO);
      const data = v.data;
      const next: LocalEvent = {
        ...current,
        ...(data.title !== undefined && { title: data.title }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.start_time !== undefined && { start_time: data.start_time }),
        ...(data.end_time !== undefined && { end_time: data.end_time }),
        ...(data.all_day !== undefined && { all_day: data.all_day }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updated_at: this.clock(),
      };
      await this.db.events.put(next);
      return ok(next);
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.events.get(id);
      if (!row) return err("not_found", EVENTO_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined);
      const now = this.clock();
      await this.db.events.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  async getById(id: string): Promise<LocalEvent | null> {
    const row = await this.db.events.get(id);
    return row && alive(row) ? row : null;
  }

  async listByDay(date: IsoDay): Promise<LocalEvent[]> {
    const rows = await this.db.events.where("date").equals(date).toArray();
    return rows.filter(alive).sort(byTime);
  }

  async listRange(from: IsoDay, to: IsoDay): Promise<LocalEvent[]> {
    const rows = await this.db.events
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return rows
      .filter(alive)
      .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.events, olderThan)));
  }
}

/** All-day per primi, poi per orario di inizio, poi per titolo. */
function byTime(a: LocalEvent, b: LocalEvent): number {
  if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
  const at = a.start_time ?? "";
  const bt = b.start_time ?? "";
  return at.localeCompare(bt) || a.title.localeCompare(b.title);
}
