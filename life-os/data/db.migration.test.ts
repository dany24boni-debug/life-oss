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

  it("LifeosDb apre a versione 1 con tutte le tabelle attese", async () => {
    const dbTest = new LifeosDb("schema-shape-test");
    await dbTest.open();
    expect(dbTest.verno).toBe(1);
    expect(dbTest.tables.map((t) => t.name).sort()).toEqual([
      "events",
      "gym_exercises",
      "gym_plans",
      "gym_sessions",
      "gym_sets",
      "reminders",
      "settings",
      "tasks",
    ]);
    expect(DB_NAME).toBe("lifeos");
    dbTest.close();
    await Dexie.delete("schema-shape-test");
  });
});
