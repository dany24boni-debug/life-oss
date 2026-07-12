/**
 * FocusRepo su Dexie (run-08 prompt 5) — il registro append-only delle
 * fasi di lavoro concluse dal timer pomodoro: una riga per fase, id
 * UUIDv7 (non derivato: due fasi lo stesso giorno sono due righe VERE).
 */

import type { LifeosDb } from "../db";
import { uuidv7 } from "../ids";
import { attempt, ok, type Result } from "../result";
import {
  FocusMinutesSchema,
  IsoDaySchema,
  type FocusSession,
  type IsoDay,
  type IsoInstant,
} from "../schemas";
import type { FocusRepo } from "../ports";
import {
  alive,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

export class LocalFocusRepo implements FocusRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  add(input: { date: IsoDay; minutes: number }): Promise<Result<FocusSession>> {
    return attempt(async () => {
      const d = validate(IsoDaySchema, input.date);
      if (!d.ok) return d;
      const m = validate(FocusMinutesSchema, input.minutes);
      if (!m.ok) return m;
      const now = this.clock();
      const row: FocusSession = {
        id: uuidv7(),
        date: d.data,
        minutes: m.data,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.focus_sessions.add(row);
      return ok(row);
    });
  }

  async listRange(from: IsoDay, to: IsoDay): Promise<FocusSession[]> {
    const rows = await this.db.focus_sessions
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return rows
      .filter(alive)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          a.created_at.localeCompare(b.created_at),
      );
  }

  async minutesByDay(
    from: IsoDay,
    to: IsoDay,
  ): Promise<Array<{ date: IsoDay; minutes: number }>> {
    const rows = await this.listRange(from, to);
    const byDay = new Map<IsoDay, number>();
    for (const r of rows) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.minutes);
    return [...byDay.entries()]
      .map(([date, minutes]) => ({ date, minutes }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () =>
      ok(await purgeTable(this.db.focus_sessions, olderThan)),
    );
  }
}
