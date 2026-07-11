import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "./db";
import { GYM_SEED } from "./gym-seed";
import {
  TORSO_A_SEED,
  convertPlansToPrograms,
  nextDayInRotation,
  seedTorsoA,
  torsoAReferencesSeededExercises,
  v1DayIdForPlan,
} from "./gym-programs";
import { LocalGymRepo } from "./local/gym";
import {
  GymProgramDaySchema,
  GymProgramSchema,
  GymProgramSlotSchema,
} from "./schemas";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeDb(): LifeosDb {
  const db = new LifeosDb(`gym-programs-test-${++counter}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

const NOW = () => "2026-07-11T10:00:00.000Z";

describe("nextDayInRotation — rotazione last-done", () => {
  const days = [{ id: "a" }, { id: "b" }, { id: "c" }];

  it("senza storia: il primo giorno", () => {
    expect(nextDayInRotation(days, null)?.id).toBe("a");
  });

  it("dopo un giorno: il successivo; dopo l'ultimo: si ricomincia", () => {
    expect(nextDayInRotation(days, "a")?.id).toBe("b");
    expect(nextDayInRotation(days, "b")?.id).toBe("c");
    expect(nextDayInRotation(days, "c")?.id).toBe("a");
  });

  it("giorno rimosso dal programma: si riparte dal primo", () => {
    expect(nextDayInRotation(days, "sparito")?.id).toBe("a");
  });

  it("senza giorni: null", () => {
    expect(nextDayInRotation([], null)).toBeNull();
  });
});

describe("convertPlansToPrograms — piani v1 → programma", () => {
  it("un giorno per piano, target portati (reps int → testo, clamp 1..10)", async () => {
    const db = makeDb();
    const repo = new LocalGymRepo(db);
    const ex = await repo.createExercise({
      name: "Squat",
      muscle_group: "gambe",
    });
    if (!ex.ok) throw new Error("setup");
    const plan = await repo.createPlan({
      name: "Gambe",
      entries: [
        { exercise_id: ex.data.id, target_sets: 4, target_reps: 8, note: "pausa 2s" },
        { exercise_id: ex.data.id, target_sets: 15, target_reps: null, note: null },
      ],
    });
    if (!plan.ok) throw new Error("setup");

    const converted = await convertPlansToPrograms(db, NOW);
    expect(converted).toBe(1);

    const programs = (await db.gym_programs.toArray()).filter(
      (p) => p.deleted_at === null,
    );
    expect(programs).toHaveLength(1);
    expect(programs[0].name).toBe("I miei piani");
    // Nessun altro attivo → il convertito diventa l'attivo.
    expect(programs[0].is_active).toBe(true);

    const days = await db.gym_program_days.toArray();
    expect(days).toHaveLength(1);
    expect(days[0].name).toBe("Gambe");
    expect(days[0].id).toBe(await v1DayIdForPlan(plan.data.id));

    const slots = (await db.gym_program_slots.toArray()).sort(
      (a, b) => a.sort_order - b.sort_order,
    );
    expect(slots).toHaveLength(2);
    expect(slots[0].target_sets).toBe(4);
    expect(slots[0].target_reps).toBe("8");
    expect(slots[0].notes).toBe("pausa 2s");
    expect(slots[0].section).toBeNull();
    expect(slots[1].target_sets).toBe(10); // clampato dal 15 del v1
    expect(slots[1].target_reps).toBeNull();

    // Il piano v1 resta intatto: niente si perde.
    expect(await repo.getPlanById(plan.data.id)).not.toBeNull();
  });

  it("idempotente, e DETERMINISTICA: due device producono le stesse righe", async () => {
    const a = makeDb();
    const b = makeDb();
    const repoA = new LocalGymRepo(a);
    // Il piano "sincronizzato" esiste identico su entrambi i device.
    const ex = await repoA.createExercise({
      name: "Panca",
      muscle_group: "petto",
    });
    if (!ex.ok) throw new Error("setup");
    const plan = await repoA.createPlan({
      name: "Push",
      entries: [
        { exercise_id: ex.data.id, target_sets: 3, target_reps: 10, note: null },
      ],
    });
    if (!plan.ok) throw new Error("setup");
    await b.gym_plans.add((await a.gym_plans.get(plan.data.id))!);

    expect(await convertPlansToPrograms(a, NOW)).toBe(1);
    expect(await convertPlansToPrograms(a, NOW)).toBe(0); // idempotente
    expect(await convertPlansToPrograms(b, NOW)).toBe(1);

    // Giorni e slot IDENTICI byte per byte: il sync li fonde, mai doppioni.
    expect(await a.gym_program_days.toArray()).toEqual(
      await b.gym_program_days.toArray(),
    );
    expect(await a.gym_program_slots.toArray()).toEqual(
      await b.gym_program_slots.toArray(),
    );
    expect((await a.gym_programs.toArray()).map((p) => p.id)).toEqual(
      (await b.gym_programs.toArray()).map((p) => p.id),
    );
  });

  it("non risuscita il contenitore eliminato e non ri-attiva sopra un attivo", async () => {
    const db = makeDb();
    const repo = new LocalGymRepo(db);
    const ex = await repo.createExercise({ name: "X", muscle_group: "altro" });
    if (!ex.ok) throw new Error("setup");
    await repo.createPlan({
      name: "Vecchio",
      entries: [
        { exercise_id: ex.data.id, target_sets: 3, target_reps: 10, note: null },
      ],
    });

    // L'utente ha già un SUO programma attivo.
    const mine = await repo.createProgram({ name: "Mio", is_active: true });
    if (!mine.ok) throw new Error("setup");

    expect(await convertPlansToPrograms(db, NOW)).toBe(1);
    const active = (await db.gym_programs.toArray()).filter(
      (p) => p.deleted_at === null && p.is_active,
    );
    expect(active.map((p) => p.id)).toEqual([mine.data.id]);

    // Contenitore eliminato → la conversione futura non lo riporta in vita.
    const db2 = makeDb();
    const repo2 = new LocalGymRepo(db2);
    const ex2 = await repo2.createExercise({ name: "Y", muscle_group: "altro" });
    if (!ex2.ok) throw new Error("setup");
    await repo2.createPlan({
      name: "Piano",
      entries: [
        { exercise_id: ex2.data.id, target_sets: 3, target_reps: 8, note: null },
      ],
    });
    await convertPlansToPrograms(db2, NOW);
    const container = (await db2.gym_programs.toArray())[0];
    await db2.gym_programs.put({
      ...container,
      deleted_at: "2026-07-11T11:00:00.000Z",
      updated_at: "2026-07-11T11:00:00.000Z",
    });
    await repo2.createPlan({
      name: "Piano nuovo",
      entries: [],
    });
    expect(await convertPlansToPrograms(db2, NOW)).toBe(0);
    expect((await db2.gym_programs.get(container.id))?.deleted_at).not.toBeNull();
  });
});

describe("TORSO_A_SEED — il giorno reale del foglio", () => {
  it("golden: id deterministici col prefisso riservato 90ab", () => {
    // Pinnati byte per byte (pattern gym-seed): se cambiano, la semina
    // duplica su ogni dispositivo — non aggiornare MAI questi literal.
    expect(TORSO_A_SEED.program.id).toBe(
      "01970000-90ab-7000-8000-000000000001",
    );
    expect(TORSO_A_SEED.day.id).toBe("01970000-90ab-7000-8000-000000000002");
    expect(TORSO_A_SEED.slots[0].id).toBe(
      "01970000-90ab-7000-8000-000000000010",
    );
  });

  it("rispecchia la trascrizione del foglio (sezioni, RIR testuali, recuperi)", () => {
    expect(GymProgramSchema.safeParse(TORSO_A_SEED.program).success).toBe(true);
    expect(GymProgramDaySchema.safeParse(TORSO_A_SEED.day).success).toBe(true);
    expect(TORSO_A_SEED.day.name).toBe("Torso A");
    expect(TORSO_A_SEED.day.subtitle).toBe("Petto + Schiena + Spalle + Core");
    expect(TORSO_A_SEED.day.weekday).toBe(2); // martedì

    expect(TORSO_A_SEED.slots).toHaveLength(7);
    for (const slot of TORSO_A_SEED.slots) {
      expect(GymProgramSlotSchema.safeParse(slot).success).toBe(true);
    }
    expect(TORSO_A_SEED.slots.map((s) => s.section)).toEqual([
      "FORZA", "FORZA", "FORZA",
      "IPERTROFIA", "IPERTROFIA", "IPERTROFIA",
      "CORE",
    ]);
    // Riga 1: Panca Piana 4×3–5 | rec 270s | RIR 1.
    expect(TORSO_A_SEED.slots[0].target_sets).toBe(4);
    expect(TORSO_A_SEED.slots[0].target_reps).toBe("3–5");
    expect(TORSO_A_SEED.slots[0].target_rir).toBe("1");
    expect(TORSO_A_SEED.slots[0].rest_seconds).toBe(270);
    // Riga 6: Laterali — RIR discendente per-set, come sul foglio.
    expect(TORSO_A_SEED.slots[5].target_rir).toBe("2/1/0");
    // Riga 7: Ab Wheel a corpo libero (niente colonna carico).
    expect(TORSO_A_SEED.slots[6].bodyweight).toBe(true);
    expect(TORSO_A_SEED.slots.slice(0, 6).every((s) => !s.bodyweight)).toBe(
      true,
    );
    // Ogni slot punta a un esercizio del catalogo seminato.
    expect(torsoAReferencesSeededExercises()).toBe(true);
    const nameOf = new Map(GYM_SEED.map((e) => [e.id, e.name]));
    expect(nameOf.get(TORSO_A_SEED.slots[0].exercise_id)).toBe(
      "Panca piana con bilanciere",
    );
    expect(nameOf.get(TORSO_A_SEED.slots[6].exercise_id)).toBe("Ab wheel");
  });

  it("seedTorsoA: idempotente, attiva solo se nessun attivo, non risuscita", async () => {
    const db = makeDb();
    expect(await seedTorsoA(db, NOW)).toBe(9); // 1 programma + 1 giorno + 7 slot
    expect(await seedTorsoA(db, NOW)).toBe(0); // "già presente"
    expect(await db.gym_exercises.count()).toBe(GYM_SEED.length); // catalogo assicurato
    expect((await db.gym_programs.get(TORSO_A_SEED.program.id))?.is_active).toBe(
      true,
    );

    // L'utente elimina uno slot: la ri-semina non lo riporta in vita.
    const doomed = TORSO_A_SEED.slots[0].id;
    const row = (await db.gym_program_slots.get(doomed))!;
    await db.gym_program_slots.put({
      ...row,
      deleted_at: "2026-07-12T09:00:00.000Z",
      updated_at: "2026-07-12T09:00:00.000Z",
    });
    expect(await seedTorsoA(db, NOW)).toBe(0);
    expect((await db.gym_program_slots.get(doomed))?.deleted_at).not.toBeNull();
  });
});
