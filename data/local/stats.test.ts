import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { createLocalRepos } from "./index";
import type { Repos } from "../ports";

let counter = 0;
let db: LifeosDb;
let repos: Repos;

beforeEach(() => {
  db = new LifeosDb(`test-stats-${++counter}`);
  repos = createLocalRepos(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalStatsRepo", () => {
  it("tasksSummary conta totale e fatti del giorno, tombstone escluse", async () => {
    const a = await must(repos.tasks.create({ title: "a", date: "2026-07-10" }));
    await must(repos.tasks.create({ title: "b", date: "2026-07-10" }));
    const c = await must(repos.tasks.create({ title: "c", date: "2026-07-10" }));
    await must(repos.tasks.create({ title: "altrove", date: "2026-07-11" }));
    await must(repos.tasks.complete(a.id));
    await must(repos.tasks.softDelete(c.id));

    expect(await repos.stats.tasksSummary("2026-07-10")).toEqual({
      total: 2,
      done: 1,
    });
  });

  it("overdueCount conta solo aperti nel passato", async () => {
    await must(repos.tasks.create({ title: "ieri", date: "2026-07-09" }));
    const done = await must(
      repos.tasks.create({ title: "ieri fatto", date: "2026-07-09" }),
    );
    await must(repos.tasks.complete(done.id));
    await must(repos.tasks.create({ title: "oggi", date: "2026-07-10" }));

    expect(await repos.stats.overdueCount("2026-07-10")).toBe(1);
  });

  it("completionByDay raggruppa e ordina per giorno", async () => {
    const a = await must(repos.tasks.create({ title: "a", date: "2026-07-08" }));
    await must(repos.tasks.create({ title: "b", date: "2026-07-08" }));
    await must(repos.tasks.create({ title: "c", date: "2026-07-09" }));
    await must(repos.tasks.complete(a.id));

    expect(await repos.stats.completionByDay("2026-07-07", "2026-07-09")).toEqual([
      { date: "2026-07-08", total: 2, done: 1 },
      { date: "2026-07-09", total: 1, done: 0 },
    ]);
  });

  it("gymVolumeInRange somma peso x reps dei set vivi nel range", async () => {
    const squat = await must(
      repos.gym.createExercise({ name: "Squat", muscle_group: "gambe" }),
    );
    const inRange = await must(repos.gym.createSession({ date: "2026-07-08" }));
    const outRange = await must(repos.gym.createSession({ date: "2026-06-01" }));
    await must(
      repos.gym.addSet({
        session_id: inRange.id,
        exercise_id: squat.id,
        weight_kg: 100,
        reps: 5,
      }),
    );
    await must(
      repos.gym.addSet({
        session_id: inRange.id,
        exercise_id: squat.id,
        weight_kg: null, // corpo libero: volume 0
        reps: 10,
      }),
    );
    await must(
      repos.gym.addSet({
        session_id: outRange.id,
        exercise_id: squat.id,
        weight_kg: 80,
        reps: 5,
      }),
    );

    expect(
      await repos.stats.gymVolumeInRange("2026-07-06", "2026-07-12"),
    ).toEqual({ sessions: 1, totalVolumeKg: 500 });
  });

  it("range vuoto: zero onesti, nessun mock", async () => {
    expect(
      await repos.stats.gymVolumeInRange("2026-07-06", "2026-07-12"),
    ).toEqual({ sessions: 0, totalVolumeKg: 0 });
    expect(await repos.stats.tasksSummary("2026-07-10")).toEqual({
      total: 0,
      done: 0,
    });
  });
});

describe("LocalStatsRepo — streak e giorni attivi (run-03)", () => {
  /** Task fatto con completed_at controllato, scritto raw sulla tabella. */
  async function seedDone(completedAt: string) {
    const { uuidv7 } = await import("../ids");
    await db.tasks.add({
      id: uuidv7(),
      title: "fatto",
      notes: null,
      date: null,
      recurrence: null,
      estimate_min: null,
      time: null,
      priority: null,
      tags: [],
      module_link: null,
      status: "done",
      completed_at: completedAt,
      sort_order: 0,
      subtasks: [],
      created_at: completedAt,
      updated_at: completedAt,
      deleted_at: null,
    });
  }

  it("fixture manuale: catena di 3 con ponte protetto e sessione gym", async () => {
    // Attivi: 8 (task), 9 (gym), 11 (task). Il 10 è protetto.
    await seedDone("2026-07-08T10:00:00.000Z");
    await must(repos.gym.createSession({ date: "2026-07-09" }));
    await seedDone("2026-07-11T06:00:00.000Z");
    await must(repos.settings.update({ protected_days: ["2026-07-10"] }));

    const s = await repos.stats.streak({
      today: "2026-07-11",
      timeZone: "UTC",
    });
    expect(s).toEqual({ current: 3, best: 3, todayCounts: true });
  });

  it("la timezone iniettata decide il giorno del completamento", async () => {
    // 22:30 UTC del 9 = 00:30 dell'10 a Roma.
    await seedDone("2026-07-09T22:30:00.000Z");

    const rome = await repos.stats.streak({
      today: "2026-07-10",
      timeZone: "Europe/Rome",
    });
    expect(rome.todayCounts).toBe(true);
    expect(rome.current).toBe(1);

    const utc = await repos.stats.streak({
      today: "2026-07-10",
      timeZone: "UTC",
    });
    expect(utc.todayCounts).toBe(false); // per UTC è attività di ieri
    expect(utc.current).toBe(1); // catena in sospeso che arriva a ieri
  });

  it("i giorni protetti arrivano dalle Settings e fanno solo da ponte", async () => {
    await seedDone("2026-07-07T10:00:00.000Z");
    await must(
      repos.settings.update({ protected_days: ["2026-07-08", "2026-07-09"] }),
    );
    const s = await repos.stats.streak({
      today: "2026-07-10",
      timeZone: "UTC",
    });
    expect(s).toEqual({ current: 1, best: 1, todayCounts: false });
  });

  it("tombstone escluse: un task fatto poi eliminato non tiene viva la streak", async () => {
    const t = await must(repos.tasks.create({ title: "x", date: "2026-07-10" }));
    await must(repos.tasks.complete(t.id));
    await must(repos.tasks.softDelete(t.id));
    const s = await repos.stats.streak({
      today: "2026-07-10",
      timeZone: "UTC",
    });
    expect(s.todayCounts).toBe(false);
    expect(s.current).toBe(0);
  });

  it("activityDays: range inclusivo, dedupe e ordine", async () => {
    await seedDone("2026-07-08T10:00:00.000Z");
    await seedDone("2026-07-08T18:00:00.000Z"); // stesso giorno: una voce
    await seedDone("2026-07-05T10:00:00.000Z"); // fuori range
    await must(repos.gym.createSession({ date: "2026-07-06" }));

    expect(
      await repos.stats.activityDays("2026-07-06", "2026-07-08", "UTC"),
    ).toEqual(["2026-07-06", "2026-07-08"]);
  });

  it("una sessione palestra registrata dal flusso nuovo rende attivo il giorno (streak)", async () => {
    // Il flusso del modulo Gym (run-04 prompt 10): sessione + set loggati.
    const session = await must(
      repos.gym.createSession({
        date: "2026-07-10",
        started_at: "2026-07-10T18:00:00.000Z",
      }),
    );
    const ex = await must(
      repos.gym.createExercise({ name: "Panca piana", muscle_group: "petto" }),
    );
    await must(
      repos.gym.addSet({
        session_id: session.id,
        exercise_id: ex.id,
        weight_kg: 60,
        reps: 8,
      }),
    );

    const streak = await repos.stats.streak({
      today: "2026-07-10",
      timeZone: "UTC",
    });
    expect(streak.todayCounts).toBe(true);
    expect(streak.current).toBe(1);
    expect(
      await repos.stats.activityDays("2026-07-10", "2026-07-10", "UTC"),
    ).toEqual(["2026-07-10"]);
  });
});

describe("LocalStatsRepo — abitudini nella streak globale (run-08)", () => {
  it("un'abitudine COMPLETATA fa contare il giorno; una a metà no", async () => {
    const lettura = await must(
      repos.habits.create({
        name: "Lettura",
        kind: "quantity",
        unit: "pagine",
        daily_target: 10,
      }),
    );
    await must(repos.habits.logDay(lettura.id, "2026-07-10", 10)); // fatta
    await must(repos.habits.logDay(lettura.id, "2026-07-11", 3)); // a metà

    expect(
      await repos.stats.activityDays("2026-07-09", "2026-07-12", "UTC"),
    ).toEqual(["2026-07-10"]);

    const s = await repos.stats.streak({ today: "2026-07-10", timeZone: "UTC" });
    expect(s.todayCounts).toBe(true);
  });

  it("counter senza obiettivo: basta un valore > 0; abitudine eliminata non conta", async () => {
    const habit = await must(
      repos.habits.create({ name: "Flessioni", kind: "counter" }),
    );
    await must(repos.habits.incrementDay(habit.id, "2026-07-10", 1));
    expect(
      await repos.stats.activityDays("2026-07-10", "2026-07-10", "UTC"),
    ).toEqual(["2026-07-10"]);

    await must(repos.habits.softDelete(habit.id));
    expect(
      await repos.stats.activityDays("2026-07-10", "2026-07-10", "UTC"),
    ).toEqual([]);
  });
});
