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

describe("SyncEngine — round-trip programmi (run-07)", () => {
  it("programma + giorno + slot creati su A arrivano su B identici", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const program = must(
      await a.repos.gym.createProgram({ name: "Scheda", is_active: true }),
    );
    const day = must(
      await a.repos.gym.createProgramDay({
        program_id: program.id,
        name: "Torso A",
        subtitle: "Petto + Schiena + Spalle + Core",
        weekday: 2,
      }),
    );
    const ex = must(
      await a.repos.gym.createExercise({
        name: "Panca piana",
        muscle_group: "petto",
      }),
    );
    const slot = must(
      await a.repos.gym.createProgramSlot({
        day_id: day.id,
        exercise_id: ex.id,
        section: "FORZA",
        variant: "Bilanciere",
        target_sets: 4,
        target_reps: "3–5",
        target_rir: "2/1/0",
        rest_seconds: 270,
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(await b.db.gym_programs.get(program.id)).toEqual(
      await a.db.gym_programs.get(program.id),
    );
    expect(await b.db.gym_program_days.get(day.id)).toEqual(day);
    expect(await b.db.gym_program_slots.get(slot.id)).toEqual(slot);
    expect(remote.rowsOf("lo_gym_program_slots")).toHaveLength(1);

    // LWW: B ritocca la prescrizione DOPO → vince al round-trip.
    must(
      await b.repos.gym.updateProgramSlot(slot.id, { target_rir: "1–2" }),
    );
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.gym.getProgramSlotById(slot.id))?.target_rir).toBe(
      "1–2",
    );

    // A elimina il programma (cascade): le tombstone viaggiano tutte.
    must(await a.repos.gym.softDeleteProgram(program.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.gym.getProgramById(program.id)).toBeNull();
    expect(await b.repos.gym.getProgramDayById(day.id)).toBeNull();
    expect(await b.repos.gym.getProgramSlotById(slot.id)).toBeNull();
  });

  it("sessione col giorno/voto e set con RIR/recupero/feeling: round-trip", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const program = must(await a.repos.gym.createProgram({ name: "S" }));
    const day = must(
      await a.repos.gym.createProgramDay({
        program_id: program.id,
        name: "Torso A",
      }),
    );
    const ex = must(
      await a.repos.gym.createExercise({
        name: "Dip alle parallele",
        muscle_group: "petto",
      }),
    );
    const session = must(
      await a.repos.gym.startSessionFromDay(
        day.id,
        "2026-07-10",
        "2026-07-10T18:00:00.000Z",
      ),
    );
    must(await a.repos.gym.updateSession(session.id, { rating_1_10: 8 }));
    const set = must(
      await a.repos.gym.addSet({
        session_id: session.id,
        exercise_id: ex.id,
        weight_kg: null, // corpo libero: legale e sincronizzabile
        reps: 10,
        rir_done: 1,
        rest_actual_s: 150,
        feeling_1_10: 7,
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();

    const sessionOnB = await b.db.gym_sessions.get(session.id);
    expect(sessionOnB?.program_day_id).toBe(day.id);
    expect(sessionOnB?.rating_1_10).toBe(8);
    const setOnB = await b.db.gym_sets.get(set.id);
    expect(setOnB).toEqual(set);
    expect(setOnB?.weight_kg).toBeNull();
    expect(setOnB?.rir_done).toBe(1);
  });

  it("una riga sessione di forma PRE run-07 (senza campi nuovi) passa il pull", async () => {
    const remote = new FakeRemote();
    // Un client non aggiornato pusha una sessione SENZA le chiavi nuove
    // (è ciò che arriva anche da un backup vecchio): il parse del pull
    // deve materializzare i default, mai scartare la riga.
    await remote.pushUpsert("lo_gym_sessions", [
      {
        id: "01980000-0000-7000-8000-0000000000aa",
        date: "2026-07-01",
        plan_id: null,
        started_at: null,
        finished_at: null,
        notes: null,
        created_at: "2026-07-01T18:00:00.000Z",
        updated_at: "2026-07-01T18:00:00.000Z",
        deleted_at: null,
      },
    ]);
    const b = makeDevice(remote);
    await b.engine.syncNow();
    const row = await b.db.gym_sessions.get(
      "01980000-0000-7000-8000-0000000000aa",
    );
    expect(row).not.toBeUndefined();
    expect(row?.program_day_id).toBeNull();
    expect(row?.rating_1_10).toBeNull();
  });
});

describe("SyncEngine — round-trip lo_body + profilo (run-07 P4)", () => {
  it("la pesata del giorno CONVERGE tra dispositivi (id derivato)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    must(await a.repos.body.upsertDay("2026-07-11", { weight_kg: 82.6 }));
    await new Promise((r) => setTimeout(r, 5));
    must(
      await b.repos.body.upsertDay("2026-07-11", {
        weight_kg: 82.4,
        note: "mattina",
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();

    expect(remote.rowsOf("lo_body")).toHaveLength(1);
    const suA = await a.repos.body.getByDay("2026-07-11");
    const suB = await b.repos.body.getByDay("2026-07-11");
    expect(suA).toEqual(suB);
    expect(suA?.weight_kg).toBe(82.4); // vince la scrittura più recente
  });

  it("i campi profilo di Settings viaggiano (lo_settings alterata)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    must(
      await a.repos.settings.update({
        height_cm: 180,
        sex: "m",
        birth_year: 1996,
        activity_level: 3,
      }),
    );
    await a.engine.syncNow();
    await b.engine.syncNow();

    const onB = await b.repos.settings.get();
    expect(onB.height_cm).toBe(180);
    expect(onB.sex).toBe("m");
    expect(onB.birth_year).toBe(1996);
    expect(onB.activity_level).toBe(3);
  });
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

  it("round-trip lo_spese: importo decimale identico su B, LWW e tombstone", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const spesa = must(
      await a.repos.spese.create({
        amount: 12.5,
        category: "cibo",
        date: "2026-07-10",
        note: "Pranzo",
      }),
    );
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.db.spese.get(spesa.id)).toEqual(spesa);
    expect(remote.rowsOf("lo_spese")).toHaveLength(1);

    // B corregge l'importo DOPO: vince al round-trip.
    must(await b.repos.spese.update(spesa.id, { amount: 13.9 }));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.spese.getById(spesa.id))?.amount).toBe(13.9);

    // A elimina: la tombstone arriva su B.
    must(await a.repos.spese.softDelete(spesa.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.spese.listMonth("2026-07")).toHaveLength(0);
  });

  it("round-trip lo_sera: la riga del giorno CONVERGE tra dispositivi (id derivato)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    // Entrambi scrivono lo stesso giorno PRIMA di sincronizzare: con id
    // derivato dalla data è la stessa PK — il sync fonde con LWW invece
    // di duplicare.
    must(await a.repos.sera.upsertDay("2026-07-10", { energy_1_5: 3 }));
    // Il clock di B parte dopo: la sua versione è la più recente.
    await new Promise((r) => setTimeout(r, 5));
    must(
      await b.repos.sera.upsertDay("2026-07-10", {
        energy_1_5: 4,
        journal: "Scritto da B",
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();

    expect(remote.rowsOf("lo_sera")).toHaveLength(1);
    const suA = await a.repos.sera.getByDay("2026-07-10");
    const suB = await b.repos.sera.getByDay("2026-07-10");
    expect(suA).toEqual(suB);
    expect(suA?.journal).toBe("Scritto da B");
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

describe("SyncEngine — round-trip abitudini (run-08)", () => {
  it("abitudine + log creati su A arrivano su B identici; LWW sul valore", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const habit = must(
      await a.repos.habits.create({
        name: "Lettura",
        kind: "quantity",
        unit: "pagine",
        daily_target: 10,
        weekdays: [1, 2, 3, 4, 5],
      }),
    );
    const log = must(await a.repos.habits.logDay(habit.id, "2026-07-10", 12));

    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(await b.db.habits.get(habit.id)).toEqual(habit);
    expect(await b.db.habit_logs.get(log.id)).toEqual(log);
    expect(remote.rowsOf("lo_habits")).toHaveLength(1);

    // B corregge il valore DOPO: vince al round-trip.
    must(await b.repos.habits.logDay(habit.id, "2026-07-10", 20));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.habits.getLog(habit.id, "2026-07-10"))?.value).toBe(
      20,
    );
  });

  it("il log del giorno CONVERGE tra dispositivi (id derivato da abitudine+data)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    // La stessa abitudine esiste su entrambi (seminata: id fisso).
    const { seedWaterHabit, WATER_HABIT_ID } = await import("../habits");
    await seedWaterHabit(a.db);
    await seedWaterHabit(b.db);

    must(await a.repos.habits.incrementDay(WATER_HABIT_ID, "2026-07-12", 500));
    await new Promise((r) => setTimeout(r, 5));
    must(await b.repos.habits.incrementDay(WATER_HABIT_ID, "2026-07-12", 330));

    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();

    // Una sola riga remota; vince la scrittura più recente (LWW, i
    // valori non si sommano tra dispositivi — è il contratto row-mirror).
    expect(remote.rowsOf("lo_habit_logs")).toHaveLength(1);
    const suA = await a.repos.habits.getLog(WATER_HABIT_ID, "2026-07-12");
    const suB = await b.repos.habits.getLog(WATER_HABIT_ID, "2026-07-12");
    expect(suA).toEqual(suB);
    expect(suA?.value).toBe(330);
  });

  it("il cascade di tombstone (abitudine + log) viaggia; l'archivio pure", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const habit = must(
      await a.repos.habits.create({ name: "Stretching", kind: "boolean" }),
    );
    must(await a.repos.habits.logDay(habit.id, "2026-07-10", 1));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // Archivio su B: viaggia come campo.
    must(await b.repos.habits.archive(habit.id));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect((await a.repos.habits.getById(habit.id))?.archived_at).not.toBeNull();

    // Cancellazione su A: abitudine e log spariscono su B.
    must(await a.repos.habits.softDelete(habit.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.habits.getById(habit.id)).toBeNull();
    expect(await b.repos.habits.getLog(habit.id, "2026-07-10")).toBeNull();
  });
});

describe("SyncEngine — round-trip planner (run-08 P3)", () => {
  it("piano + slot + check arrivano su B; il check della settimana CONVERGE", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const plan = must(
      await a.repos.planner.createPlan({
        name: "Settimana lavoro",
        is_active: true,
      }),
    );
    const slot = must(
      await a.repos.planner.createSlot({
        plan_id: plan.id,
        weekday: 1,
        start_hhmm: "07:00",
        end_hhmm: "08:30",
        title: "Palestra",
      }),
    );
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(await b.db.week_plans.get(plan.id)).toEqual(plan);
    expect(await b.db.plan_slots.get(slot.id)).toEqual(slot);

    // Entrambi spuntano la stessa settimana PRIMA di sincronizzare:
    // stessa PK derivata, il sync fonde con LWW invece di duplicare.
    must(await a.repos.planner.setCheck(slot.id, "2026-W28", "done"));
    await new Promise((r) => setTimeout(r, 5));
    must(await b.repos.planner.setCheck(slot.id, "2026-W28", "skipped"));

    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();

    expect(remote.rowsOf("lo_slot_checks")).toHaveLength(1);
    const suA = await a.repos.planner.getCheck(slot.id, "2026-W28");
    const suB = await b.repos.planner.getCheck(slot.id, "2026-W28");
    expect(suA).toEqual(suB);
    expect(suA?.state).toBe("skipped"); // vince la scrittura più recente
  });

  it("de-spuntare viaggia (state null sulla stessa riga); il cascade pure", async () => {
    const remote = new FakeRemote();
    const a = makeDevice(remote);
    const b = makeDevice(remote);

    const plan = must(await a.repos.planner.createPlan({ name: "P" }));
    const slot = must(
      await a.repos.planner.createSlot({
        plan_id: plan.id,
        weekday: 3,
        start_hhmm: "18:00",
        title: "Spesa",
      }),
    );
    must(await a.repos.planner.setCheck(slot.id, "2026-W28", "done"));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect((await b.repos.planner.getCheck(slot.id, "2026-W28"))?.state).toBe(
      "done",
    );

    // B de-spunta: su A lo stato torna null (mai una riga fantasma).
    must(await b.repos.planner.setCheck(slot.id, "2026-W28", null));
    await b.engine.syncNow();
    await a.engine.syncNow();
    const onA = await a.repos.planner.getCheck(slot.id, "2026-W28");
    expect(onA).not.toBeNull();
    expect(onA?.state).toBeNull();

    // A elimina il piano: tombstone a cascata fino ai check, su B.
    must(await a.repos.planner.softDeletePlan(plan.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.planner.getPlanById(plan.id)).toBeNull();
    expect(await b.repos.planner.listSlots(plan.id)).toHaveLength(0);
    expect(await b.repos.planner.getCheck(slot.id, "2026-W28")).toBeNull();
  });
});
