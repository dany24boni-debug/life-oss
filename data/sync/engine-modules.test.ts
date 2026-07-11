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
