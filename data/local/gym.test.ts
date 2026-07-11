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

describe("LocalGymRepo — programmi (run-07)", () => {
  async function makeProgram(name = "Scheda") {
    return must(repo.createProgram({ name }));
  }

  async function makeDayWithSlots(programId: string, dayName = "Torso A") {
    const day = await must(
      repo.createProgramDay({ program_id: programId, name: dayName }),
    );
    const ex = await must(
      repo.createExercise({ name: "Panca piana", muscle_group: "petto" }),
    );
    const slot = await must(
      repo.createProgramSlot({
        day_id: day.id,
        exercise_id: ex.id,
        section: "FORZA",
        variant: "Bilanciere",
        target_sets: 4,
        target_reps: "3–5",
        target_rir: "1",
        rest_seconds: 270,
      }),
    );
    return { day, slot, exercise: ex };
  }

  it("al più un programma attivo: attivarne uno spegne gli altri", async () => {
    const a = await must(repo.createProgram({ name: "A", is_active: true }));
    const b = await must(repo.createProgram({ name: "B", is_active: true }));
    expect((await repo.activeProgram())?.id).toBe(b.id);
    expect((await repo.getProgramById(a.id))?.is_active).toBe(false);

    const upd = await must(repo.updateProgram(a.id, { is_active: true }));
    expect(upd.is_active).toBe(true);
    expect((await repo.getProgramById(b.id))?.is_active).toBe(false);
    expect((await repo.activeProgram())?.id).toBe(a.id);
  });

  it("giorni e slot: CRUD, sort_order in coda, liste ordinate", async () => {
    const program = await makeProgram();
    const { day, slot } = await makeDayWithSlots(program.id);
    expect(day.sort_order).toBe(0);
    expect(slot.section).toBe("FORZA");
    expect(slot.target_rir).toBe("1");

    const day2 = await must(
      repo.createProgramDay({ program_id: program.id, name: "Gambe" }),
    );
    expect(day2.sort_order).toBe(1);
    expect(
      (await repo.listProgramDays(program.id)).map((d) => d.name),
    ).toEqual(["Torso A", "Gambe"]);

    const upd = await must(
      repo.updateProgramSlot(slot.id, { target_rir: "2/1/0", bodyweight: true }),
    );
    expect(upd.target_rir).toBe("2/1/0");
    expect(upd.bodyweight).toBe(true);

    await must(repo.reorderProgramDays(program.id, [day2.id, day.id]));
    expect(
      (await repo.listProgramDays(program.id)).map((d) => d.name),
    ).toEqual(["Gambe", "Torso A"]);
  });

  it("createProgramDay su programma inesistente: not_found", async () => {
    const r = await repo.createProgramDay({
      program_id: "00000000-0000-7000-8000-000000000000",
      name: "X",
    });
    expect(!r.ok && r.error.code).toBe("not_found");
  });

  it("elimina programma = cascade su giorni e slot; restore = undo completo", async () => {
    const program = await makeProgram();
    const { day, slot } = await makeDayWithSlots(program.id);
    // Uno slot era già stato eliminato PRIMA, singolarmente.
    const dead = await must(repo.duplicateProgramSlot(slot.id));
    await must(repo.softDeleteProgramSlot(dead.id));

    await must(repo.softDeleteProgram(program.id));
    expect(await repo.getProgramById(program.id)).toBeNull();
    expect(await repo.getProgramDayById(day.id)).toBeNull();
    expect(await repo.getProgramSlotById(slot.id)).toBeNull();

    const restored = await must(repo.restoreProgram(program.id));
    expect(restored.deleted_at).toBeNull();
    expect(await repo.getProgramDayById(day.id)).not.toBeNull();
    expect(await repo.getProgramSlotById(slot.id)).not.toBeNull();
    // Ma lo slot eliminato prima del cascade RESTA eliminato.
    expect(await repo.getProgramSlotById(dead.id)).toBeNull();
  });

  it("duplica: programma profondo, giorno con slot, slot subito sotto", async () => {
    const program = await makeProgram();
    const { day, slot } = await makeDayWithSlots(program.id);

    const dayCopy = await must(repo.duplicateProgramDay(day.id));
    expect(dayCopy.name).toBe("Torso A (copia)");
    expect(dayCopy.sort_order).toBe(1);
    expect(await repo.listProgramSlots(dayCopy.id)).toHaveLength(1);

    const slotCopy = await must(repo.duplicateProgramSlot(slot.id));
    const ordered = await repo.listProgramSlots(day.id);
    expect(ordered.map((s) => s.id)).toEqual([slot.id, slotCopy.id]);

    const programCopy = await must(repo.duplicateProgram(program.id));
    expect(programCopy.name).toBe("Scheda (copia)");
    expect(programCopy.is_active).toBe(false);
    const copiedDays = await repo.listProgramDays(programCopy.id);
    expect(copiedDays).toHaveLength(2);
    expect(await repo.listProgramSlots(copiedDays[0].id)).toHaveLength(2);
  });

  it("startSessionFromDay lega la seduta al giorno; nextUpDay ruota e ricomincia", async () => {
    const program = await must(
      repo.createProgram({ name: "Scheda", is_active: true }),
    );
    const torso = await must(
      repo.createProgramDay({ program_id: program.id, name: "Torso A" }),
    );
    const gambe = await must(
      repo.createProgramDay({ program_id: program.id, name: "Gambe" }),
    );

    // Senza storia: il primo giorno.
    expect((await repo.nextUpDay())?.id).toBe(torso.id);

    const s1 = await must(
      repo.startSessionFromDay(torso.id, "2026-07-07", "2026-07-07T18:00:00.000Z"),
    );
    expect(s1.program_day_id).toBe(torso.id);
    expect(s1.started_at).toBe("2026-07-07T18:00:00.000Z");
    expect((await repo.nextUpDay())?.id).toBe(gambe.id);

    await must(
      repo.startSessionFromDay(gambe.id, "2026-07-09", "2026-07-09T18:00:00.000Z"),
    );
    // Dopo l'ultimo giorno si ricomincia dal primo.
    expect((await repo.nextUpDay())?.id).toBe(torso.id);

    // Le sessioni libere non muovono la rotazione.
    await must(repo.createSession({ date: "2026-07-10" }));
    expect((await repo.nextUpDay())?.id).toBe(torso.id);

    // La query per giorno di programma (run-07 P3) vede solo le sue.
    const s2 = await must(
      repo.startSessionFromDay(torso.id, "2026-07-11", "2026-07-11T18:00:00.000Z"),
    );
    const ofTorso = await repo.listSessionsByProgramDay(torso.id);
    expect(ofTorso.map((s) => s.id)).toEqual([s2.id, s1.id]); // recenti prima
    expect(await repo.listSessionsByProgramDay(gambe.id)).toHaveLength(1);

    // Senza programma attivo: nessun next-up.
    await must(repo.updateProgram(program.id, { is_active: false }));
    expect(await repo.nextUpDay()).toBeNull();
  });

  it("startSessionFromDay su giorno inesistente: not_found", async () => {
    const r = await repo.startSessionFromDay(
      "00000000-0000-7000-8000-000000000000",
      "2026-07-10",
    );
    expect(!r.ok && r.error.code).toBe("not_found");
  });

  it("sessioni e set portano i campi del foglio (voto, RIR, feeling, recupero)", async () => {
    const { slot, exercise } = await makeDayWithSlots(
      (await makeProgram()).id,
    );
    const session = await must(
      repo.startSessionFromDay(slot.day_id, "2026-07-10"),
    );
    const set = await must(
      repo.addSet({
        session_id: session.id,
        exercise_id: exercise.id,
        weight_kg: 62.5,
        reps: 4,
        rir_done: 1,
        rest_actual_s: 250,
        feeling_1_10: 8,
      }),
    );
    expect(set.rir_done).toBe(1);
    expect(set.rest_actual_s).toBe(250);
    expect(set.feeling_1_10).toBe(8);

    const patched = await must(repo.updateSet(set.id, { feeling_1_10: null }));
    expect(patched.feeling_1_10).toBeNull();
    expect(patched.rir_done).toBe(1); // il patch non tocca il resto

    const rated = await must(
      repo.updateSession(session.id, { rating_1_10: 9 }),
    );
    expect(rated.rating_1_10).toBe(9);

    const invalid = await repo.updateSession(session.id, {
      rating_1_10: 11 as never,
    });
    expect(!invalid.ok && invalid.error.code).toBe("validation");
    const invalidRir = await repo.addSet({
      session_id: session.id,
      exercise_id: exercise.id,
      reps: 5,
      rir_done: 6 as never,
    });
    expect(!invalidRir.ok && invalidRir.error.code).toBe("validation");
  });

  it("purgeTombstones copre anche le tabelle dei programmi", async () => {
    const program = await makeProgram();
    await makeDayWithSlots(program.id);
    await must(repo.softDeleteProgram(program.id));
    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    // programma + giorno + slot.
    expect(purged.ok && purged.data).toBe(3);
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
