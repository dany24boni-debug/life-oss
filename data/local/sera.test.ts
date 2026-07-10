import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalSeraRepo, seraDayId } from "./sera";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeRepo(): LocalSeraRepo {
  const db = new LifeosDb(`sera-test-${++counter}`);
  dbs.push(db);
  return new LocalSeraRepo(db);
}

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("LocalSeraRepo — una riga per giorno", () => {
  it("upsertDay crea la riga del giorno con id derivato dalla data", async () => {
    const repo = makeRepo();
    const row = must(await repo.upsertDay("2026-07-10", { energy_1_5: 4 }));
    expect(row.id).toBe(await seraDayId("2026-07-10"));
    expect(row.energy_1_5).toBe(4);
    expect(row.journal).toBeNull();
    expect(await repo.getByDay("2026-07-10")).toEqual(row);
  });

  it("upsert successivi AGGIORNANO la stessa riga (mai duplicati)", async () => {
    const repo = makeRepo();
    const prima = must(await repo.upsertDay("2026-07-10", { energy_1_5: 3 }));
    const dopo = must(
      await repo.upsertDay("2026-07-10", {
        journal: "Giornata piena ma buona.",
        mood: "sereno",
      }),
    );
    expect(dopo.id).toBe(prima.id);
    expect(dopo.energy_1_5).toBe(3); // campo non toccato dal patch
    expect(dopo.journal).toBe("Giornata piena ma buona.");
    expect(dopo.updated_at > prima.updated_at).toBe(true);
  });

  it("l'id è deterministico: stessa data → stesso id (cross-device)", async () => {
    expect(await seraDayId("2026-07-10")).toBe(await seraDayId("2026-07-10"));
    expect(await seraDayId("2026-07-10")).not.toBe(
      await seraDayId("2026-07-11"),
    );
  });

  it("listRecent: solo giorni prima di `before`, dal più recente, paginati", async () => {
    const repo = makeRepo();
    must(await repo.upsertDay("2026-07-07", { energy_1_5: 2 }));
    must(await repo.upsertDay("2026-07-08", { energy_1_5: 3 }));
    must(await repo.upsertDay("2026-07-09", { energy_1_5: 4 }));
    must(await repo.upsertDay("2026-07-10", { energy_1_5: 5 })); // oggi: fuori

    const recenti = await repo.listRecent("2026-07-10", 2);
    expect(recenti.map((r) => r.date)).toEqual(["2026-07-09", "2026-07-08"]);
    expect(await repo.listRecent("2026-07-10", 99)).toHaveLength(3);
    expect(await repo.listRecent("2026-07-10", 0)).toEqual([]);
  });

  it("scrivere un giorno con tombstone la revive (l'intento vince)", async () => {
    const repo = makeRepo();
    const row = must(await repo.upsertDay("2026-07-05", { mood: "stanco" }));
    // Tombstone simulata (come arriverebbe dal sync).
    const db = dbs[dbs.length - 1];
    await db.sera.put({
      ...row,
      deleted_at: row.updated_at,
    });
    expect(await repo.getByDay("2026-07-05")).toBeNull();

    const back = must(await repo.upsertDay("2026-07-05", { energy_1_5: 1 }));
    expect(back.deleted_at).toBeNull();
    expect(back.mood).toBe("stanco");
    expect(back.energy_1_5).toBe(1);
  });

  it("rifiuta patch fuori dominio (energia 0 o 6)", async () => {
    const repo = makeRepo();
    expect((await repo.upsertDay("2026-07-10", { energy_1_5: 0 })).ok).toBe(
      false,
    );
    expect((await repo.upsertDay("2026-07-10", { energy_1_5: 6 })).ok).toBe(
      false,
    );
  });
});
