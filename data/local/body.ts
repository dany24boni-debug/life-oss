/**
 * BodyRepo su Dexie (run-07 prompt 4) — il peso corporeo, una riga per
 * giorno per COSTRUZIONE: id `deriveUuidV8("lifeos:body-day:<date>")`,
 * lo stesso disegno del modulo Sera — due dispositivi che pesano lo
 * stesso giorno producono la stessa PK e il sync fonde con LWW.
 */

import type { LifeosDb } from "../db";
import { deriveUuidV8 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  BodyPatchSchema,
  type BodyEntry,
  type BodyPatch,
  type IsoDay,
  type IsoInstant,
} from "../schemas";
import type { BodyRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const PESATA_NON_TROVATA = "Nessuna pesata per questo giorno.";

/** Id deterministico del giorno di pesata. */
export function bodyDayId(date: IsoDay): Promise<string> {
  return deriveUuidV8(`lifeos:body-day:${date}`);
}

export class LocalBodyRepo implements BodyRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  upsertDay(date: IsoDay, patch: BodyPatch): Promise<Result<BodyEntry>> {
    return attempt(async () => {
      const v = validate(BodyPatchSchema, patch);
      if (!v.ok) return v;
      const data = v.data;
      const id = await bodyDayId(date);
      const current = await this.db.body.get(id);

      if (current) {
        // Aggiorna (e rianima un'eventuale tombstone: ripesarsi È
        // l'intento che la annulla).
        const next: BodyEntry = {
          ...current,
          ...(data.weight_kg !== undefined && { weight_kg: data.weight_kg }),
          ...(data.note !== undefined && { note: data.note }),
          deleted_at: null,
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.body.put(next);
        return ok(next);
      }

      if (data.weight_kg === undefined) {
        return err<BodyEntry>(
          "validation",
          "Serve il peso per registrare la giornata.",
        );
      }
      const now = this.clock();
      const row: BodyEntry = {
        id,
        date,
        weight_kg: data.weight_kg,
        note: data.note ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.body.add(row);
      return ok(row);
    });
  }

  async getByDay(date: IsoDay): Promise<BodyEntry | null> {
    const row = await this.db.body.get(await bodyDayId(date));
    return row && alive(row) ? row : null;
  }

  async latest(): Promise<BodyEntry | null> {
    const rows = (await this.db.body.toArray()).filter(alive);
    if (rows.length === 0) return null;
    return rows.sort((a, b) => b.date.localeCompare(a.date))[0];
  }

  async listRange(from: IsoDay, to: IsoDay): Promise<BodyEntry[]> {
    const rows = await this.db.body
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return rows.filter(alive).sort((a, b) => a.date.localeCompare(b.date));
  }

  async listRecent(before: IsoDay, limit: number): Promise<BodyEntry[]> {
    if (limit <= 0) return [];
    const rows = await this.db.body
      .where("date")
      .belowOrEqual(before)
      .toArray();
    return rows
      .filter(alive)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  softDeleteDay(date: IsoDay): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.body.get(await bodyDayId(date));
      if (!row) return err<void>("not_found", PESATA_NON_TROVATA);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.body.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  restoreDay(date: IsoDay): Promise<Result<BodyEntry>> {
    return attempt(async () => {
      const row = await this.db.body.get(await bodyDayId(date));
      if (!row) return err<BodyEntry>("not_found", PESATA_NON_TROVATA);
      if (row.deleted_at === null) return ok(row);
      const next: BodyEntry = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.body.put(next);
      return ok(next);
    });
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.body, olderThan)));
  }
}
