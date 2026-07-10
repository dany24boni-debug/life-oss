import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalSpeseRepo } from "./spese";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeRepo(): LocalSpeseRepo {
  const db = new LifeosDb(`spese-test-${++counter}`);
  dbs.push(db);
  return new LocalSpeseRepo(db);
}

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("LocalSpeseRepo", () => {
  it("create + getById: importo decimale e nota opzionale", async () => {
    const repo = makeRepo();
    const spesa = must(
      await repo.create({
        amount: 12.5,
        category: "cibo",
        date: "2026-07-10",
      }),
    );
    expect(spesa.amount).toBe(12.5);
    expect(spesa.note).toBeNull();
    expect(await repo.getById(spesa.id)).toEqual(spesa);
  });

  it("rifiuta importi non validi: zero, negativi, tre decimali", async () => {
    const repo = makeRepo();
    expect(
      (await repo.create({ amount: 0, category: "cibo", date: "2026-07-10" }))
        .ok,
    ).toBe(false);
    expect(
      (await repo.create({ amount: -5, category: "cibo", date: "2026-07-10" }))
        .ok,
    ).toBe(false);
    expect(
      (
        await repo.create({
          amount: 1.999,
          category: "cibo",
          date: "2026-07-10",
        })
      ).ok,
    ).toBe(false);
  });

  it("listMonth: solo il mese chiesto, giorno decrescente, tombstone escluse", async () => {
    const repo = makeRepo();
    const a = must(
      await repo.create({ amount: 10, category: "cibo", date: "2026-07-03" }),
    );
    const b = must(
      await repo.create({ amount: 20, category: "svago", date: "2026-07-28" }),
    );
    must(
      await repo.create({ amount: 30, category: "casa", date: "2026-06-30" }),
    );
    const luglio = await repo.listMonth("2026-07");
    expect(luglio.map((e) => e.id)).toEqual([b.id, a.id]);

    must(await repo.softDelete(b.id));
    expect((await repo.listMonth("2026-07")).map((e) => e.id)).toEqual([a.id]);

    // Undo: torna nella lista.
    must(await repo.restore(b.id));
    expect(await repo.listMonth("2026-07")).toHaveLength(2);

    // Mese malformato: lista vuota, mai throw.
    expect(await repo.listMonth("luglio")).toEqual([]);
  });

  it("update patcha importo e categoria con bump updated_at", async () => {
    const repo = makeRepo();
    const spesa = must(
      await repo.create({ amount: 8, category: "cibo", date: "2026-07-10" }),
    );
    const next = must(
      await repo.update(spesa.id, { amount: 8.6, category: "trasporto" }),
    );
    expect(next.amount).toBe(8.6);
    expect(next.category).toBe("trasporto");
    expect(next.updated_at > spesa.updated_at).toBe(true);
  });
});
