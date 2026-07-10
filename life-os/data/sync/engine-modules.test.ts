import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { createLocalRepos } from "../local";
import type { Repos } from "../ports";
import type { Result } from "../result";
import { FakeRemote } from "./fake-remote";
import { SyncEngine } from "./engine";

/**
 * Round-trip su FakeRemote per le tabelle dei moduli portati nel run-05
 * (esami; spese e sera si aggiungono coi loro prompt): la prova che basta
 * la voce di registro in tables.ts perché l'engine le muova come le altre.
 * Harness minimale ricalcato da engine.test.ts.
 */

let counter = 0;
const dbs: LifeosDb[] = [];

function makeDevice(remote: FakeRemote): {
  repos: Repos;
  engine: SyncEngine;
  db: LifeosDb;
} {
  const db = new LifeosDb(`engine-modules-test-${++counter}`);
  dbs.push(db);
  const repos = createLocalRepos(db);
  const engine = new SyncEngine({
    db,
    remote,
    userId: "utente-1",
    onState: () => {},
    onFirstSync: () => {},
  });
  return { repos, engine, db };
}

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("SyncEngine — round-trip lo_esami", () => {
  it("un esame creato su A arriva su B identico (push -> pull)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const exam = must(
      await a.repos.esami.create({
        title: "Storia moderna",
        date: "2026-09-10",
        total_chapters: 14,
        notes: "Manuale Rossi",
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(await b.db.esami.get(exam.id)).toEqual(exam);
    expect(remote.rowsOf("lo_esami")).toHaveLength(1);
  });

  it("LWW: il progresso segnato dopo vince; la tombstone viaggia", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const exam = must(
      await a.repos.esami.create({
        title: "Analisi 1",
        date: "2026-09-01",
        total_chapters: 10,
      }),
    );
    await a.engine.syncNow();
    await b.engine.syncNow();

    // B avanza un capitolo DOPO: al round-trip vince su A.
    must(await b.repos.esami.update(exam.id, { completed_chapters: 1 }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.esami.getById(exam.id))?.completed_chapters).toBe(1);

    // A elimina: la tombstone arriva su B e l'esame sparisce dalle liste.
    must(await a.repos.esami.softDelete(exam.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.esami.getById(exam.id)).toBeNull();
    expect(await b.repos.esami.listAll()).toHaveLength(0);
  });
});
