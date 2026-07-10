import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "./db";
import { GYM_SEED, SEED_INSTANT, seedGymExercises } from "./gym-seed";
import { GymExerciseSchema } from "./schemas";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeDb(): LifeosDb {
  const db = new LifeosDb(`seed-test-${++counter}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("catalogo seminato", () => {
  it("~80 esercizi validi, id unici e deterministici, timestamp costanti", () => {
    expect(GYM_SEED.length).toBeGreaterThanOrEqual(75);
    const ids = new Set(GYM_SEED.map((e) => e.id));
    expect(ids.size).toBe(GYM_SEED.length);
    for (const e of GYM_SEED) {
      const parsed = GymExerciseSchema.safeParse(e);
      expect(parsed.success).toBe(true);
      expect(e.is_custom).toBe(false);
      expect(e.created_at).toBe(SEED_INSTANT);
      expect(e.updated_at).toBe(SEED_INSTANT);
    }
    // Ogni gruppo muscolare è rappresentato.
    const groups = new Set(GYM_SEED.map((e) => e.muscle_group));
    expect([...groups].sort()).toEqual([
      "addominali",
      "altro",
      "braccia",
      "cardio",
      "gambe",
      "petto",
      "schiena",
      "spalle",
    ]);
  });

  it("semina idempotente: la seconda passata non inserisce nulla", async () => {
    const db = makeDb();
    expect(await seedGymExercises(db)).toBe(GYM_SEED.length);
    expect(await seedGymExercises(db)).toBe(0);
    expect(await db.gym_exercises.count()).toBe(GYM_SEED.length);
  });

  it("non risuscita né sovrascrive: modifiche e tombstone restano", async () => {
    const db = makeDb();
    await seedGymExercises(db);
    const primo = GYM_SEED[0];
    // L'utente rinomina un esercizio e ne elimina un altro.
    await db.gym_exercises.put({
      ...primo,
      name: "Il mio nome",
      updated_at: "2026-07-10T10:00:00.000Z",
    });
    const secondo = GYM_SEED[1];
    await db.gym_exercises.put({
      ...secondo,
      deleted_at: "2026-07-10T10:00:00.000Z",
      updated_at: "2026-07-10T10:00:00.000Z",
    });

    expect(await seedGymExercises(db)).toBe(0);
    expect((await db.gym_exercises.get(primo.id))?.name).toBe("Il mio nome");
    expect((await db.gym_exercises.get(secondo.id))?.deleted_at).not.toBeNull();
  });
});
