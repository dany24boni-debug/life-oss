/**
 * SeraRepo su Dexie (run-05 prompt 5) — una riga per giorno per
 * COSTRUZIONE: l'id è `deriveUuidV8("lifeos:sera-day:<date>")`, quindi
 * due dispositivi che scrivono lo stesso giorno producono la stessa PK e
 * il sync li fonde con LWW invece di duplicare (niente vincoli unique
 * server-side che farebbero fallire i push). L'importer legacy usa la
 * STESSA derivazione: un check-in importato e uno scritto a mano per lo
 * stesso giorno sono la stessa riga.
 */

import type { LifeosDb } from "../db";
import { deriveUuidV8 } from "../ids";
import { attempt, ok, type Result } from "../result";
import {
  CheckinPatchSchema,
  type CheckinPatch,
  type EveningCheckin,
  type IsoDay,
  type IsoInstant,
} from "../schemas";
import type { SeraRepo } from "../ports";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

/** Id deterministico del giorno — condiviso con l'importer del modulo. */
export function seraDayId(date: IsoDay): Promise<string> {
  return deriveUuidV8(`lifeos:sera-day:${date}`);
}

export class LocalSeraRepo implements SeraRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  upsertDay(
    date: IsoDay,
    patch: CheckinPatch,
  ): Promise<Result<EveningCheckin>> {
    return attempt(async () => {
      const v = validate(CheckinPatchSchema, patch);
      if (!v.ok) return v;
      const data = v.data;
      const id = await seraDayId(date);
      const current = await this.db.sera.get(id);

      if (current) {
        // Aggiorna (e revive un'eventuale tombstone arrivata dal sync:
        // scrivere il giorno È l'intento che la annulla).
        const next: EveningCheckin = {
          ...current,
          ...(data.energy_1_5 !== undefined && { energy_1_5: data.energy_1_5 }),
          ...(data.mood !== undefined && { mood: data.mood }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.journal !== undefined && { journal: data.journal }),
          deleted_at: null,
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.sera.put(next);
        return ok(next);
      }

      const now = this.clock();
      const row: EveningCheckin = {
        id,
        date,
        energy_1_5: data.energy_1_5 ?? null,
        mood: data.mood ?? null,
        notes: data.notes ?? null,
        journal: data.journal ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.sera.add(row);
      return ok(row);
    });
  }

  async getByDay(date: IsoDay): Promise<EveningCheckin | null> {
    const row = await this.db.sera.get(await seraDayId(date));
    return row && alive(row) ? row : null;
  }

  async listRecent(before: IsoDay, limit: number): Promise<EveningCheckin[]> {
    if (limit <= 0) return [];
    const rows = await this.db.sera
      .where("date")
      .below(before)
      .toArray();
    return rows
      .filter(alive)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => ok(await purgeTable(this.db.sera, olderThan)));
  }
}
