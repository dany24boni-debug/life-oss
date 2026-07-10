import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalGymRepo } from "./gym";

let counter = 0;
let db: LifeosDb;
let repo: LocalGymRepo;

beforeEach(() => {
  db = new LifeosDb(`test-gym-${++counter}`);
  repo = new LocalGymRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalGymRepo — esercizi", () => {
  it("CRUD con filtro per gruppo muscolare", async () => {
    const panca = await must(
      repo.createExercise({ name: "Panca piana", muscle_group: "petto" }),
    );
    await must(repo.createExercise({ name: "Squat", muscle_group: "gambe" }));

    expect((await repo.listExercises()).length).toBe(2);
    const petto = await repo.listExercises({ group: "petto" });
    expect(petto.map((e) => e.id)).toEqual([panca.id]);

    const upd = await repo.updateExercise(panca.id, {
      default_rest_seconds: 120,
    });
    expect(upd.ok && upd.data.default_rest_seconds).toBe(120);

    await repo.softDeleteExercise(panca.id);
    expect(await repo.getExerciseById(panca.id)).toBeNull();
    expect(await db.gym_exercises.get(panca.id)).toBeDefined(); // tombstone
  });

  it("rifiuta gruppi muscolari fuori vocabolario", async () => {
    const r = await repo.createExercise({
      name: "X",
      muscle_group: "collo" as never,
    });
    expect(!r.ok && r.error.code).toBe("validation");
  });
});

describe("LocalGymRepo — piani", () => {
  it("CRUD con entries ordinate", async () => {
    const squat = await must(
      repo.createExercise({ name: "Squat", muscle_group: "gambe" }),
    );
    const plan = await must(
      repo.createPlan({
        name: "Giorno A",
        entries: [
          {
            exercise_id: squat.id,
            target_sets: 4,
            target_reps: 8,
            note: null,
          },
        ],
      }),
    );
    expect(plan.entries).toHaveLength(1);
    const upd = await repo.updatePlan(plan.id, { name: "Giorno A — gambe" });
    expect(upd.ok && upd.data.name).toBe("Giorno A — gambe");
    await repo.softDeletePlan(plan.id);
    expect(await repo.listPlans()).toEqual([]);
  });
});

describe("LocalGymRepo — sessioni e set", () => {
  it("sessione con set: numerazione automatica per esercizio", async () => {
    const squat = await must(
      repo.createExercise({ name: "Squat", muscle_group: "gambe" }),
    );
    const session = await must(repo.createSession({ date: "2026-07-10" }));

    const s1 = await must(
      repo.addSet({
        session_id: session.id,
        exercise_id: squat.id,
        weight_kg: 100,
        reps: 8,
      }),
    );
    const s2 = await must(
      repo.addSet({
        session_id: session.id,
        exercise_id: squat.id,
        weight_kg: 105,
        reps: 6,
      }),
    );
    expect(s1.set_number).toBe(1);
    expect(s2.set_number).toBe(2);

    const bySession = await repo.listSetsBySession(session.id);
    expect(bySession.map((s) => s.id)).toEqual([s1.id, s2.id]);
  });

  it("addSet su sessione inesistente: not_found", async () => {
    const r = await repo.addSet({
      session_id: "00000000-0000-7000-8000-000000000000",
      exercise_id: "00000000-0000-7000-8000-000000000001",
      reps: 5,
    });
    expect(!r.ok && r.error.code).toBe("not_found");
  });

  it("listSetsByExercise attraversa le sessioni, più recenti prima", async () => {
    const squat = await must(
      repo.createExercise({ name: "Squat", muscle_group: "gambe" }),
    );
    const s1 = await must(repo.createSession({ date: "2026-07-01" }));
    const s2 = await must(repo.createSession({ date: "2026-07-08" }));
    const old = await must(
      repo.addSet({
        session_id: s1.id,
        exercise_id: squat.id,
        weight_kg: 90,
        reps: 8,
      }),
    );
    const recent = await must(
      repo.addSet({
        session_id: s2.id,
        exercise_id: squat.id,
        weight_kg: 100,
        reps: 8,
      }),
    );

    const history = await repo.listSetsByExercise(squat.id);
    expect(history.map((s) => s.id)).toEqual([recent.id, old.id]);
    const limited = await repo.listSetsByExercise(squat.id, { limit: 1 });
    expect(limited.map((s) => s.id)).toEqual([recent.id]);
  });

  it("softDeleteSession mette tombstone anche ai set", async () => {
    const squat = await must(
      repo.createExercise({ name: "Squat", muscle_group: "gambe" }),
    );
    const session = await must(repo.createSession({ date: "2026-07-10" }));
    const set = await must(
      repo.addSet({ session_id: session.id, exercise_id: squat.id, reps: 10 }),
    );

    const r = await repo.softDeleteSession(session.id);
    expect(r.ok).toBe(true);
    expect(await repo.getSessionById(session.id)).toBeNull();
    expect(await repo.listSetsBySession(session.id)).toEqual([]);
    // Fisicamente entrambe le righe esistono ancora (tombstone).
    expect(await db.gym_sessions.get(session.id)).toBeDefined();
    expect((await db.gym_sets.get(set.id))?.deleted_at).not.toBeNull();
  });

  it("listSessionsRange e listSessionsByDay filtrano correttamente", async () => {
    const a = await must(repo.createSession({ date: "2026-07-06" }));
    const b = await must(repo.createSession({ date: "2026-07-08" }));
    await must(repo.createSession({ date: "2026-06-01" }));

    const range = await repo.listSessionsRange("2026-07-06", "2026-07-12");
    expect(range.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(
      (await repo.listSessionsByDay("2026-07-08")).map((s) => s.id),
    ).toEqual([b.id]);
  });

  it("purgeTombstones somma su tutte le tabelle gym", async () => {
    const ex = await must(
      repo.createExercise({ name: "Curl", muscle_group: "braccia" }),
    );
    const session = await must(repo.createSession({ date: "2026-07-10" }));
    await must(
      repo.addSet({ session_id: session.id, exercise_id: ex.id, reps: 10 }),
    );
    await repo.softDeleteExercise(ex.id);
    await repo.softDeleteSession(session.id); // + il suo set

    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    expect(purged.ok && purged.data).toBe(3);
  });
});
