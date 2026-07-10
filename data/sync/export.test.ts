import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { createLocalRepos } from "../local";
import type { Clock } from "../local/util";
import type { Result } from "../result";
import { EXPORT_FORMAT, EXPORT_VERSION, exportAll, importAll } from "./export";

let counter = 0;
const dbs: LifeosDb[] = [];

function makeDb(): LifeosDb {
  const db = new LifeosDb(`export-test-${++counter}`);
  dbs.push(db);
  return db;
}

function tickingClock(startMs: number): Clock {
  let n = 0;
  return () => new Date(startMs + 1000 * n++).toISOString();
}

const T0 = Date.parse("2026-07-10T09:00:00.000Z");

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

/** Dataset con tutti i casi delicati: tombstone, settings, orari, set gym. */
async function seed(db: LifeosDb) {
  const repos = createLocalRepos(db, tickingClock(T0));
  const task = must(
    await repos.tasks.create({
      title: "Compiti",
      date: "2026-07-10",
      time: "18:30",
      subtasks: [{ title: "Esercizio 1" }],
    }),
  );
  const cancellato = must(await repos.tasks.create({ title: "Cancellami" }));
  must(await repos.tasks.softDelete(cancellato.id));
  must(
    await repos.events.create({
      title: "Cena",
      date: "2026-07-11",
      start_time: "20:30",
    }),
  );
  must(await repos.settings.update({ theme: "light" }));
  const ex = must(
    await repos.gym.createExercise({ name: "Panca piana", muscle_group: "petto" }),
  );
  const session = must(await repos.gym.createSession({ date: "2026-07-10" }));
  must(
    await repos.gym.addSet({
      session_id: session.id,
      exercise_id: ex.id,
      weight_kg: 60,
      reps: 8,
    }),
  );
  return { repos, task };
}

async function snapshot(db: LifeosDb) {
  const tables: Record<string, unknown[]> = {};
  for (const t of db.tables) {
    if (t.name === "sync_meta") continue;
    tables[t.name] = (await t.toArray()).sort((x, y) =>
      String((x as { id: string }).id).localeCompare((y as { id: string }).id),
    );
  }
  return tables;
}

describe("export/import JSON", () => {
  it("round-trip senza perdite: export -> dispositivo vergine -> import", async () => {
    const sorgente = makeDb();
    await seed(sorgente);
    const envelope = await exportAll(sorgente);

    expect(envelope.format).toBe(EXPORT_FORMAT);
    expect(envelope.version).toBe(EXPORT_VERSION);
    // L'export è fedele: anche la tombstone viaggia.
    expect(
      envelope.tables.tasks.filter(
        (t) => (t as { deleted_at: string | null }).deleted_at !== null,
      ),
    ).toHaveLength(1);

    // Il file passa da JSON (come farebbe su disco).
    const file = JSON.parse(JSON.stringify(envelope));

    const destinazione = makeDb();
    const result = await importAll(destinazione, file);
    expect(result.ok).toBe(true);

    expect(await snapshot(destinazione)).toEqual(await snapshot(sorgente));
  });

  it("reimportare il proprio export è un no-op (LWW a parità)", async () => {
    const db = makeDb();
    await seed(db);
    const envelope = await exportAll(db);

    const result = await importAll(db, JSON.parse(JSON.stringify(envelope)));
    expect(result.ok && result.data.applied).toBe(0);
    expect(result.ok && result.data.skipped).toBeGreaterThan(0);
  });

  it("un backup più vecchio non regredisce le righe più nuove", async () => {
    const db = makeDb();
    const { repos, task } = await seed(db);
    const vecchio = await exportAll(db);

    must(await repos.tasks.update(task.id, { title: "Titolo più nuovo" }));
    const result = await importAll(db, JSON.parse(JSON.stringify(vecchio)));
    expect(result.ok).toBe(true);

    expect((await db.tasks.get(task.id))?.title).toBe("Titolo più nuovo");
  });

  it("rifiuta formati sconosciuti e versioni future, con messaggio utile", async () => {
    const db = makeDb();
    const nonSuo = await importAll(db, { qualcosa: "altro" });
    expect(!nonSuo.ok && nonSuo.error.code).toBe("validation");

    const futuro = await importAll(db, {
      format: EXPORT_FORMAT,
      version: 2,
      exported_at: "2026-07-10T09:00:00.000Z",
      tables: {},
    });
    expect(!futuro.ok && futuro.error.code).toBe("validation");
    expect(!futuro.ok && futuro.error.message).toMatch(/versione/);
  });

  it("le righe non valide nel file vengono ignorate e contate", async () => {
    const db = makeDb();
    await seed(db);
    const envelope = await exportAll(db);
    const file = JSON.parse(JSON.stringify(envelope)) as {
      tables: { tasks: unknown[] };
    };
    file.tables.tasks.push({ id: "rotta", title: 42 });

    const fresco = makeDb();
    const result = await importAll(fresco, file);
    expect(result.ok && result.data.invalid).toBe(1);
    expect(await fresco.tasks.get("rotta")).toBeUndefined();
    // Le righe sane del file sono entrate comunque.
    expect((await fresco.tasks.toArray()).length).toBe(2);
  });
});
