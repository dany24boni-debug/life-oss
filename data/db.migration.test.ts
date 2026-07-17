import "fake-indexeddb/auto";
import Dexie from "dexie";
import { describe, expect, it } from "vitest";
import {
  DB_NAME,
  LifeosDb,
  SCHEMA_V1,
  SCHEMA_V5,
  SCHEMA_V7,
  SCHEMA_V10,
  SCHEMA_V11,
} from "./db";

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
      recurrence: null,
      estimate_min: null,
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

  it("LifeosDb apre a versione 12 con tutte le tabelle attese", async () => {
    const dbTest = new LifeosDb("schema-shape-test");
    await dbTest.open();
    // v3 (run-05): + esami. v4: + spese. v5: + sera. v6 (run-07): +
    // programmi. v7 (run-07 P4): + body. v8 (run-08): + abitudini.
    // v9 (run-08 P3): + planner settimanale. v10 (run-08 P5): + focus.
    // v11 (run-09): + dieta. v12 (run-11): solo backfill (stessi store).
    expect(dbTest.verno).toBe(12);
    expect(dbTest.tables.map((t) => t.name).sort()).toEqual([
      "body",
      "diet_extras",
      "diet_meals",
      "diet_plans",
      "esami",
      "events",
      "focus_sessions",
      "foods",
      "gym_exercises",
      "gym_plans",
      "gym_program_days",
      "gym_program_slots",
      "gym_programs",
      "gym_sessions",
      "gym_sets",
      "habit_logs",
      "habits",
      "meal_items",
      "meal_logs",
      "meal_variants",
      "plan_slots",
      "reminders",
      "sera",
      "settings",
      "slot_checks",
      "spese",
      "sync_meta",
      "tasks",
      "week_plans",
    ]);
    expect(DB_NAME).toBe("lifeos");
    dbTest.close();
    await Dexie.delete("schema-shape-test");
  });

  it("v5 → v6: sessioni e set sopravvivono, campi run-07 riempiti a null", async () => {
    const name = "v5-to-v6-gym-survival";
    // Simula un dispositivo run-05/06: db creato con la v5 reale.
    const v5 = new Dexie(name);
    v5.version(5).stores(SCHEMA_V5);
    await v5.open();
    const session = {
      id: "01980000-0000-7000-8000-000000000101",
      date: "2026-07-01",
      plan_id: null,
      started_at: "2026-07-01T18:00:00.000Z",
      finished_at: "2026-07-01T19:00:00.000Z",
      notes: "Petto",
      created_at: "2026-07-01T18:00:00.000Z",
      updated_at: "2026-07-01T19:00:00.000Z",
      deleted_at: null,
    };
    const set = {
      id: "01980000-0000-7000-8000-000000000102",
      session_id: session.id,
      exercise_id: "01970000-90aa-7000-8000-000000000001",
      set_number: 1,
      weight_kg: 80,
      reps: 5,
      done_at: null,
      created_at: "2026-07-01T18:10:00.000Z",
      updated_at: "2026-07-01T18:10:00.000Z",
      deleted_at: null,
    };
    await v5.table("gym_sessions").add(session);
    await v5.table("gym_sets").add(set);
    v5.close();

    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(12);

    // Nulla si perde, e il backfill normalizza i campi nuovi a null.
    const survivedSession = await current.gym_sessions.get(session.id);
    expect(survivedSession).toEqual({
      ...session,
      program_day_id: null,
      rating_1_10: null,
    });
    const survivedSet = await current.gym_sets.get(set.id);
    expect(survivedSet).toEqual({
      ...set,
      rir_done: null,
      rest_actual_s: null,
      feeling_1_10: null,
    });

    // Le tabelle nuove sono subito usabili, indice compreso.
    await current.body.add({
      id: "01980000-0000-7000-8000-000000000301",
      date: "2026-07-11",
      weight_kg: 82.4,
      note: null,
      created_at: "2026-07-11T08:00:00.000Z",
      updated_at: "2026-07-11T08:00:00.000Z",
      deleted_at: null,
    });
    expect(await current.body.where("date").equals("2026-07-11").count()).toBe(
      1,
    );
    await current.gym_programs.add({
      id: "01980000-0000-7000-8000-000000000201",
      name: "Scheda",
      notes: null,
      is_active: true,
      created_at: "2026-07-11T08:00:00.000Z",
      updated_at: "2026-07-11T08:00:00.000Z",
      deleted_at: null,
    });
    expect(await current.gym_programs.count()).toBe(1);
    // L'indice nuovo program_day_id funziona sulle sessioni nuove.
    await current.gym_sessions.add({
      ...session,
      id: "01980000-0000-7000-8000-000000000103",
      program_day_id: "01980000-0000-7000-8000-000000000202",
      rating_1_10: 9,
    });
    const byDay = await current.gym_sessions
      .where("program_day_id")
      .equals("01980000-0000-7000-8000-000000000202")
      .toArray();
    expect(byDay).toHaveLength(1);

    current.close();
    await Dexie.delete(name);
  });

  it("v7 → v8: la pesata sopravvive e le tabelle abitudini sono subito usabili", async () => {
    const name = "v7-to-v8-habits-survival";
    // Simula un dispositivo run-07: db creato con la v7 reale.
    const v7 = new Dexie(name);
    v7.version(7).stores(SCHEMA_V7);
    await v7.open();
    const pesata = {
      id: "01980000-0000-7000-8000-000000000401",
      date: "2026-07-11",
      weight_kg: 82.4,
      note: null,
      created_at: "2026-07-11T08:00:00.000Z",
      updated_at: "2026-07-11T08:00:00.000Z",
      deleted_at: null,
    };
    await v7.table("body").add(pesata);
    v7.close();

    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(12);
    expect(await current.body.get(pesata.id)).toEqual(pesata);

    // Le tabelle nuove funzionano, indici compresi.
    await current.habits.add({
      id: "01980000-0000-7000-8000-000000000402",
      name: "Lettura",
      icon: "libro",
      kind: "quantity",
      unit: "pagine",
      daily_target: 10,
      weekdays: null,
      sort_order: 0,
      archived_at: null,
      created_at: "2026-07-12T08:00:00.000Z",
      updated_at: "2026-07-12T08:00:00.000Z",
      deleted_at: null,
    });
    await current.habit_logs.add({
      id: "01980000-0000-7000-8000-000000000403",
      habit_id: "01980000-0000-7000-8000-000000000402",
      date: "2026-07-12",
      value: 12,
      created_at: "2026-07-12T09:00:00.000Z",
      updated_at: "2026-07-12T09:00:00.000Z",
      deleted_at: null,
    });
    expect(
      await current.habit_logs
        .where("habit_id")
        .equals("01980000-0000-7000-8000-000000000402")
        .count(),
    ).toBe(1);
    expect(
      await current.habit_logs.where("date").equals("2026-07-12").count(),
    ).toBe(1);

    // E le tabelle planner (v9) sono subito usabili, indici compresi.
    await current.slot_checks.add({
      id: "01980000-0000-7000-8000-000000000404",
      slot_id: "01980000-0000-7000-8000-000000000405",
      iso_week: "2026-W28",
      state: "done",
      checked_at: "2026-07-12T10:00:00.000Z",
      created_at: "2026-07-12T10:00:00.000Z",
      updated_at: "2026-07-12T10:00:00.000Z",
      deleted_at: null,
    });
    expect(
      await current.slot_checks.where("iso_week").equals("2026-W28").count(),
    ).toBe(1);

    // E la tabella focus (v10) pure.
    await current.focus_sessions.add({
      id: "01980000-0000-7000-8000-000000000406",
      date: "2026-07-12",
      minutes: 25,
      created_at: "2026-07-12T11:00:00.000Z",
      updated_at: "2026-07-12T11:00:00.000Z",
      deleted_at: null,
    });
    expect(
      await current.focus_sessions.where("date").equals("2026-07-12").count(),
    ).toBe(1);

    current.close();
    await Dexie.delete(name);
  });

  it("v10 → v11: il registro focus sopravvive e le tabelle dieta sono subito usabili", async () => {
    const name = "v10-to-v11-diet-survival";
    // Simula un dispositivo run-08: db creato con la v10 reale.
    const v10 = new Dexie(name);
    v10.version(10).stores(SCHEMA_V10);
    await v10.open();
    const fase = {
      id: "01980000-0000-7000-8000-000000000501",
      date: "2026-07-12",
      minutes: 25,
      created_at: "2026-07-12T11:00:00.000Z",
      updated_at: "2026-07-12T11:00:00.000Z",
      deleted_at: null,
    };
    await v10.table("focus_sessions").add(fase);
    // Un task pre-run-09: SENZA la chiave recurrence.
    const vecchioTask = {
      id: "01980000-0000-7000-8000-000000000506",
      title: "Riga run-08",
      notes: null,
      date: "2026-07-12",
      time: null,
      priority: null,
      tags: [],
      module_link: null,
      status: "open",
      completed_at: null,
      sort_order: 0,
      subtasks: [],
      created_at: "2026-07-12T08:00:00.000Z",
      updated_at: "2026-07-12T08:00:00.000Z",
      deleted_at: null,
    };
    await v10.table("tasks").add(vecchioTask);
    v10.close();

    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(12);
    expect(await current.focus_sessions.get(fase.id)).toEqual(fase);
    // I backfill run-09 P3 e run-11 normalizzano i campi nuovi a null.
    expect(await current.tasks.get(vecchioTask.id)).toEqual({
      ...vecchioTask,
      recurrence: null,
      estimate_min: null,
    });

    // Le tabelle dieta funzionano, indici compresi.
    await current.foods.add({
      id: "01980000-0000-7000-8000-000000000502",
      name: "Pasta",
      basis: "per100g",
      kcal: 353,
      protein_g: 13.5,
      carbs_g: 70.2,
      fat_g: 1.8,
      default_qty: 80,
      archived_at: null,
      created_at: "2026-07-13T08:00:00.000Z",
      updated_at: "2026-07-13T08:00:00.000Z",
      deleted_at: null,
    });
    await current.meal_logs.add({
      id: "01980000-0000-7000-8000-000000000503",
      meal_id: "01980000-0000-7000-8000-000000000504",
      date: "2026-07-13",
      eaten: true,
      variant_id: null,
      created_at: "2026-07-13T12:00:00.000Z",
      updated_at: "2026-07-13T12:00:00.000Z",
      deleted_at: null,
    });
    expect(
      await current.meal_logs
        .where("meal_id")
        .equals("01980000-0000-7000-8000-000000000504")
        .count(),
    ).toBe(1);
    expect(
      await current.meal_logs.where("date").equals("2026-07-13").count(),
    ).toBe(1);
    await current.diet_extras.add({
      id: "01980000-0000-7000-8000-000000000505",
      date: "2026-07-13",
      food_id: null,
      qty: null,
      name: "Gelato",
      kcal: 320,
      protein_g: null,
      carbs_g: null,
      fat_g: null,
      created_at: "2026-07-13T15:00:00.000Z",
      updated_at: "2026-07-13T15:00:00.000Z",
      deleted_at: null,
    });
    expect(
      await current.diet_extras.where("date").equals("2026-07-13").count(),
    ).toBe(1);

    current.close();
    await Dexie.delete(name);
  });

  it("v11 → v12: task e varianti sopravvivono, campi run-11 riempiti a null", async () => {
    const name = "v11-to-v12-guided-day-survival";
    // Simula un dispositivo run-09/10: db creato con la v11 reale.
    const v11 = new Dexie(name);
    v11.version(11).stores(SCHEMA_V11);
    await v11.open();
    // Un task run-10: SENZA la chiave estimate_min.
    const vecchioTask = {
      id: "01980000-0000-7000-8000-000000000601",
      title: "Riga run-10",
      notes: null,
      date: "2026-07-16",
      time: null,
      priority: null,
      tags: [],
      module_link: null,
      status: "open" as const,
      completed_at: null,
      recurrence: null,
      sort_order: 3,
      subtasks: [],
      created_at: "2026-07-16T08:00:00.000Z",
      updated_at: "2026-07-16T08:00:00.000Z",
      deleted_at: null,
    };
    // Una variante run-09: SENZA la chiave training.
    const vecchiaVariante = {
      id: "01980000-0000-7000-8000-000000000602",
      meal_id: "01980000-0000-7000-8000-000000000603",
      name: "Variante B",
      sort_order: 0,
      created_at: "2026-07-16T08:00:00.000Z",
      updated_at: "2026-07-16T08:00:00.000Z",
      deleted_at: null,
    };
    await v11.table("tasks").add(vecchioTask);
    await v11.table("meal_variants").add(vecchiaVariante);
    v11.close();

    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(12);

    // ZERO perdita: le righe v11 sono intatte, i campi nuovi a null
    // esplicito (così zod, LWW e UI vedono righe complete).
    expect(await current.tasks.get(vecchioTask.id)).toEqual({
      ...vecchioTask,
      estimate_min: null,
    });
    expect(await current.meal_variants.get(vecchiaVariante.id)).toEqual({
      ...vecchiaVariante,
      training: null,
    });

    // I campi nuovi funzionano sulle righe nuove.
    await current.tasks.put({
      ...vecchioTask,
      id: "01980000-0000-7000-8000-000000000604",
      estimate_min: 30,
    });
    expect(
      (await current.tasks.get("01980000-0000-7000-8000-000000000604"))
        ?.estimate_min,
    ).toBe(30);
    await current.meal_variants.put({
      ...vecchiaVariante,
      id: "01980000-0000-7000-8000-000000000605",
      training: true,
    });
    expect(
      (await current.meal_variants.get("01980000-0000-7000-8000-000000000605"))
        ?.training,
    ).toBe(true);

    current.close();
    await Dexie.delete(name);
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

    // Apertura con la classe reale (v1..v8): upgrade additivo.
    const current = new LifeosDb(name);
    await current.open();
    expect(current.verno).toBe(12);
    // I backfill run-09 e run-11 aggiungono i campi nuovi alla riga v1.
    expect(await current.tasks.get(row.id)).toEqual({
      ...row,
      recurrence: null,
      estimate_min: null,
    });
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
