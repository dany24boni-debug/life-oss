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
