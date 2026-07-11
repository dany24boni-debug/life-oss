import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalBodyRepo, bodyDayId } from "./body";

let counter = 0;
let db: LifeosDb;
let repo: LocalBodyRepo;

beforeEach(() => {
  db = new LifeosDb(`test-body-${++counter}`);
  repo = new LocalBodyRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalBodyRepo — una pesata per giorno, id derivato", () => {
  it("upsert crea e aggiorna la STESSA riga del giorno", async () => {
    const created = await must(
      repo.upsertDay("2026-07-11", { weight_kg: 82.4 }),
    );
    expect(created.id).toBe(await bodyDayId("2026-07-11"));

    const updated = await must(
      repo.upsertDay("2026-07-11", { weight_kg: 82.6, note: "sera" }),
    );
    expect(updated.id).toBe(created.id);
    expect(updated.weight_kg).toBe(82.6);
    expect(updated.note).toBe("sera");
    expect(await db.body.count()).toBe(1);
  });

  it("creazione senza peso: validation; dominio 20..400 rispettato", async () => {
    const senzaPeso = await repo.upsertDay("2026-07-11", { note: "x" });
    expect(!senzaPeso.ok && senzaPeso.error.code).toBe("validation");
    const fuori = await repo.upsertDay("2026-07-11", { weight_kg: 500 });
    expect(!fuori.ok && fuori.error.code).toBe("validation");
  });

  it("latest, range crescente, recenti decrescenti", async () => {
    await must(repo.upsertDay("2026-07-01", { weight_kg: 83 }));
    await must(repo.upsertDay("2026-07-08", { weight_kg: 82.5 }));
    await must(repo.upsertDay("2026-07-11", { weight_kg: 82.4 }));

    expect((await repo.latest())?.date).toBe("2026-07-11");
    expect(
      (await repo.listRange("2026-07-01", "2026-07-10")).map((e) => e.date),
    ).toEqual(["2026-07-01", "2026-07-08"]);
    expect(
      (await repo.listRecent("2026-07-11", 2)).map((e) => e.date),
    ).toEqual(["2026-07-11", "2026-07-08"]);
  });

  it("elimina il giorno con undo; ripesarsi rianima la tombstone", async () => {
    await must(repo.upsertDay("2026-07-11", { weight_kg: 82.4 }));
    await must(repo.softDeleteDay("2026-07-11"));
    expect(await repo.getByDay("2026-07-11")).toBeNull();
    expect(await repo.latest()).toBeNull();

    const restored = await must(repo.restoreDay("2026-07-11"));
    expect(restored.weight_kg).toBe(82.4);

    await must(repo.softDeleteDay("2026-07-11"));
    const riscritta = await must(
      repo.upsertDay("2026-07-11", { weight_kg: 82.0 }),
    );
    expect(riscritta.deleted_at).toBeNull();
    expect(riscritta.weight_kg).toBe(82);
  });

  it("purgeTombstones rimuove solo le tombstone vecchie", async () => {
    await must(repo.upsertDay("2026-07-10", { weight_kg: 82 }));
    await must(repo.upsertDay("2026-07-11", { weight_kg: 82.2 }));
    await must(repo.softDeleteDay("2026-07-10"));
    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    expect(purged.ok && purged.data).toBe(1);
    expect(await db.body.count()).toBe(1);
  });
});
