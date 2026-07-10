import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import { DB_NAME, LifeosDb, SCHEMA_V1 } from "./db";

/**
 * Il test del "bump di schema": la garanzia che quando (prompt 08+) si
 * aggiungerà un indice, i dati già sul dispositivo sopravvivono alla
 * migrazione Dexie v1 -> v2 senza reshaping.
 */
describe("schema bump v1 -> v2", () => {
  it("i dati scritti a v1 sopravvivono all'apertura a v2 con indice in più", async () => {
    const name = "migration-bump-test";

    // Apri a v1 (lo schema reale) e scrivi una riga.
    const v1 = new LifeosDb(name);
    const row = {
      id: "01980000-0000-7000-8000-000000000001",
      title: "Sopravvivimi",
      notes: null,
      date: "2026-07-10",
      time: null,
      priority: null,
      tags: ["spesa"],
      module_link: null,
      status: "open" as const,
      completed_at: null,
      sort_order: 0,
      subtasks: [],
      created_at: "2026-07-10T08:00:00.000Z",
      updated_at: "2026-07-10T08:00:00.000Z",
      deleted_at: null,
    };
    await v1.tasks.add(row);
    v1.close();

    // Riapri lo stesso database dichiarando v2: stesso store, indice nuovo
    // (completed_at) — la forma che avrà una futura migrazione reale.
    const v2 = new Dexie(name);
    v2.version(1).stores(SCHEMA_V1);
    v2.version(2).stores({
      tasks: `${SCHEMA_V1.tasks}, completed_at`,
    });
    await v2.open();

    expect(v2.verno).toBe(2);
    const survived = await v2.table("tasks").get(row.id);
    expect(survived).toEqual(row);

    // Il nuovo indice funziona sulle righe nuove.
    await v2.table("tasks").put({
      ...row,
      id: "01980000-0000-7000-8000-000000000002",
      status: "done",
      completed_at: "2026-07-10T09:00:00.000Z",
    });
    const byNewIndex = await v2
      .table("tasks")
      .where("completed_at")
      .above("2026-07-10T00:00:00.000Z")
      .toArray();
    expect(byNewIndex).toHaveLength(1);

    v2.close();
    await Dexie.delete(name);
  });

  it("LifeosDb apre a versione 5 con tutte le tabelle attese", async () => {
    const dbTest = new LifeosDb("schema-shape-test");
    await dbTest.open();
    // v3 (run-05, prompt 3): + esami. v4: + spese. v5: + sera.
    expect(dbTest.verno).toBe(5);
    expect(dbTest.tables.map((t) => t.name).sort()).toEqual([
      "esami",
      "events",
      "gym_exercises",
      "gym_plans",
      "gym_sessions",
      "gym_sets",
      "reminders",
      "sera",
      "settings",
      "spese",
      "sync_meta",
      "tasks",
    ]);
    expect(DB_NAME).toBe("lifeos");
    dbTest.close();
    await Dexie.delete("schema-shape-test");
  });

  it("un database scritto a v1 si apre alla versione corrente coi dati intatti", async () => {
    const name = "v1-to-current-real-schema";
    // Simula un dispositivo run-03: db creato con SOLO la v1 reale.
    const v1 = new Dexie(name);
    v1.version(1).stores(SCHEMA_V1);
    await v1.open();
    const row = {
      id: "01980000-0000-7000-8000-00000000000a",
      title: "Riga di run-03",
      notes: null,
      date: null,
      time: null,
      priority: null,
      tags: [],
      module_link: null,
      status: "open" as const,
      completed_at: null,
      sort_order: 0,
      subtasks: [],
      created_at: "2026-07-01T08:00:00.000Z",
      updated_at: "2026-07-01T08:00:00.000Z",
      deleted_at: null,
    };
    await v1.table("tasks").add(row);
    v1.close();

    // Apertura con la classe reale (v1..v5): upgrade additivo.
    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(5);
    expect(await current.tasks.get(row.id)).toEqual(row);
    await current.sync_meta.put({ key: "prova", value: "1" });
    expect((await current.sync_meta.get("prova"))?.value).toBe("1");
    // La tabella nuova è subito usabile sul database migrato.
    await current.esami.put({
      id: "01980000-0000-7000-8000-00000000000b",
      title: "Analisi 1",
      date: "2026-09-01",
      total_chapters: 10,
      completed_chapters: 2,
      notes: null,
      created_at: "2026-07-01T08:00:00.000Z",
      updated_at: "2026-07-01T08:00:00.000Z",
      deleted_at: null,
    });
    expect(await current.esami.count()).toBe(1);
    current.close();
    await Dexie.delete(name);
  });
});
