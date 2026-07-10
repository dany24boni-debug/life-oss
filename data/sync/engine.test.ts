import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { createLocalRepos } from "../local";
import type { Clock } from "../local/util";
import type { Repos } from "../ports";
import type { Result } from "../result";
import { FakeRemote } from "./fake-remote";
import {
  SyncEngine,
  type FirstSyncSummary,
  type SyncState,
} from "./engine";
import { META_LAST_ERROR, META_LINKED_USER, getMeta } from "./meta";

/**
 * Il banco di prova del sync engine (prompt 08): due "dispositivi" = due
 * Dexie isolati + due engine sullo stesso FakeRemote (stessa semantica del
 * server 0019: guardia LWW, server_updated_at monotono). Nessuna rete.
 */

let counter = 0;
const dbs: LifeosDb[] = [];

type Device = {
  db: LifeosDb;
  repos: Repos;
  engine: SyncEngine;
  states: SyncState[];
  summaries: FirstSyncSummary[];
};

function makeDevice(opts: {
  remote: FakeRemote;
  userId?: string;
  clock?: Clock;
  isOnline?: () => boolean;
}): Device {
  const db = new LifeosDb(`engine-test-${++counter}`);
  dbs.push(db);
  const repos = createLocalRepos(db, opts.clock);
  const states: SyncState[] = [];
  const summaries: FirstSyncSummary[] = [];
  const engine = new SyncEngine({
    db,
    remote: opts.remote,
    userId: opts.userId ?? "utente-1",
    onState: (s) => states.push(s),
    onFirstSync: (s) => summaries.push(s),
    isOnline: opts.isOnline,
  });
  return { db, repos, engine, states, summaries };
}

/** Clock deterministico: un istante nuovo (in avanti) a ogni chiamata. */
function tickingClock(startMs: number, stepMs = 1000): Clock {
  let n = 0;
  return () => new Date(startMs + stepMs * n++).toISOString();
}

const T0 = Date.parse("2026-07-10T08:00:00.000Z");

function must<T>(r: Result<T>): T {
  if (!r.ok) throw new Error(`mutazione fallita: ${r.error.message}`);
  return r.data;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("SyncEngine — convergenza", () => {
  it("push -> pull: due dispositivi convergono su task ed eventi", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    const b = makeDevice({ remote });

    const t1 = must(
      await a.repos.tasks.create({ title: "Spesa", date: "2026-07-10" }),
    );
    const t2 = must(await a.repos.tasks.create({ title: "Studio" }));
    const e1 = must(
      await a.repos.events.create({
        title: "Cena con Marco",
        date: "2026-07-11",
        start_time: "20:30",
      }),
    );

    await a.engine.syncNow();
    await b.engine.syncNow();

    expect(await b.db.tasks.get(t1.id)).toEqual(t1);
    expect(await b.db.tasks.get(t2.id)).toEqual(t2);
    expect(await b.db.events.get(e1.id)).toEqual(e1);
    expect(await b.repos.tasks.listByDay("2026-07-10")).toHaveLength(1);
  });

  it("le impostazioni (riga id 'local') viaggiano tra dispositivi", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote, clock: tickingClock(T0) });
    const b = makeDevice({ remote, clock: tickingClock(T0 + 60_000) });

    must(await a.repos.settings.update({ theme: "light" }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect((await b.repos.settings.get()).theme).toBe("light");
  });

  it("dopo la convergenza un ciclo in più non scrive niente (eco inerte)", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    const b = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Unica" }));

    await a.engine.syncNow();
    await b.engine.syncNow();
    const writtenDopoConvergenza = remote.totalWritten;

    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(remote.totalWritten).toBe(writtenDopoConvergenza);
  });
});

describe("SyncEngine — LWW", () => {
  it("la modifica più nuova vince: remoto batte locale più vecchio", async () => {
    const remote = new FakeRemote();
    // Il clock di B resta indietro rispetto a quello di A.
    const a = makeDevice({ remote, clock: tickingClock(T0 + 3_600_000) });
    const b = makeDevice({ remote, clock: tickingClock(T0) });

    const task = must(await a.repos.tasks.create({ title: "Base" }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // B modifica (clock vecchio), A modifica (clock nuovo), A pubblica.
    must(await b.repos.tasks.update(task.id, { title: "Vecchia di B" }));
    must(await a.repos.tasks.update(task.id, { title: "Nuova di A" }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    expect((await b.db.tasks.get(task.id))?.title).toBe("Nuova di A");
    // Il rimbalzo di B non deve retrocedere il server.
    await a.engine.syncNow();
    expect((await a.db.tasks.get(task.id))?.title).toBe("Nuova di A");
  });

  it("la modifica più nuova vince: locale batte remoto più vecchio", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote, clock: tickingClock(T0) });
    const b = makeDevice({ remote, clock: tickingClock(T0 + 3_600_000) });

    const task = must(await a.repos.tasks.create({ title: "Base" }));
    await a.engine.syncNow();
    await b.engine.syncNow();

    // A modifica col clock vecchio e pubblica per prima; B ha la versione
    // più nuova in locale e NON deve farsela sovrascrivere dal pull.
    must(await a.repos.tasks.update(task.id, { title: "Perdente di A" }));
    must(await b.repos.tasks.update(task.id, { title: "Vincente di B" }));
    await a.engine.syncNow();
    await b.engine.syncNow();
    await a.engine.syncNow();

    expect((await b.db.tasks.get(task.id))?.title).toBe("Vincente di B");
    expect((await a.db.tasks.get(task.id))?.title).toBe("Vincente di B");
  });

  it("una riga remota malformata viene scartata senza rompere il ciclo", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    // Riga corrotta già "sul server" (es. scritta da un client difettoso).
    await remote.pushUpsert("lo_tasks", [
      {
        id: "non-un-uuid",
        title: 42,
        updated_at: "2026-07-10T08:00:00.000Z",
        deleted_at: null,
      } as never,
    ]);
    const sana = must(await a.repos.tasks.create({ title: "Sana" }));

    await a.engine.syncNow();

    expect(a.states.at(-1)?.status).toBe("idle");
    expect(await a.db.tasks.get("non-un-uuid")).toBeUndefined();
    expect(await a.db.tasks.get(sana.id)).toBeDefined();
  });
});

describe("SyncEngine — tombstone", () => {
  it("un delete su A sparisce su B, e un delete su B sparisce su A", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote, clock: tickingClock(T0) });
    const b = makeDevice({ remote, clock: tickingClock(T0 + 1) });

    const t = must(await a.repos.tasks.create({ title: "Da cancellare" }));
    const e = must(
      await a.repos.events.create({ title: "Evento", date: "2026-07-12" }),
    );
    await a.engine.syncNow();
    await b.engine.syncNow();

    must(await a.repos.tasks.softDelete(t.id));
    await a.engine.syncNow();
    await b.engine.syncNow();
    expect(await b.repos.tasks.getById(t.id)).toBeNull();
    expect((await b.db.tasks.get(t.id))?.deleted_at).not.toBeNull();

    must(await b.repos.events.softDelete(e.id));
    await b.engine.syncNow();
    await a.engine.syncNow();
    expect(await a.repos.events.getById(e.id)).toBeNull();
    expect((await a.db.events.get(e.id))?.deleted_at).not.toBeNull();
  });
});

describe("SyncEngine — cursori", () => {
  it("dopo un sync si ripushano solo le righe nuove, anche riavviando l'engine", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Prima" }));
    await a.engine.syncNow();
    const chiamateDopoPrimo = remote.pushCalls.filter(
      (c) => c.table === "lo_tasks",
    );
    expect(chiamateDopoPrimo).toHaveLength(1);
    expect(chiamateDopoPrimo[0].rows).toBe(1);

    // "Riavvio dell'app": engine NUOVO sullo stesso db (cursori in sync_meta).
    const riavviato = new SyncEngine({
      db: a.db,
      remote,
      userId: "utente-1",
    });
    must(await a.repos.tasks.create({ title: "Seconda" }));
    await riavviato.syncNow();

    const chiamate = remote.pushCalls.filter((c) => c.table === "lo_tasks");
    expect(chiamate).toHaveLength(2);
    expect(chiamate[1].rows).toBe(1); // solo la riga nuova, mai le vecchie
  });

  it("interruzione a metà ciclo: al retry non si ripushano le tabelle già riuscite", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    // Dispositivo già collegato (primo sync riuscito col task).
    must(await a.repos.tasks.create({ title: "Task ok" }));
    await a.engine.syncNow();

    // Poi nasce un evento, ma il suo push fallisce a metà ciclo.
    must(
      await a.repos.events.create({ title: "Evento ko", date: "2026-07-13" }),
    );
    remote.failPushFor = "lo_events";
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("error");
    expect(await getMeta(a.db, META_LAST_ERROR)).not.toBeNull();

    remote.failPushFor = null;
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("idle");
    expect(await getMeta(a.db, META_LAST_ERROR)).toBeNull();

    // lo_tasks: una sola chiamata con righe in tutta la storia — il ciclo
    // fallito e il retry non lo hanno mai ripushato (cursore fermo).
    const pushTasks = remote.pushCalls.filter((c) => c.table === "lo_tasks");
    expect(pushTasks).toHaveLength(1);
    expect(remote.rowsOf("lo_events")).toHaveLength(1);
  });

  it("adozione interrotta: si ripete da capo al retry, senza doppioni", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Task ok" }));
    must(
      await a.repos.events.create({ title: "Evento ko", date: "2026-07-13" }),
    );

    // Il PRIMO sync (adozione) muore sul push di lo_events: il dispositivo
    // non risulta collegato e il retry rifà l'adozione intera — i task
    // ripushati sono no-op per la guardia LWW del server.
    remote.failPushFor = "lo_events";
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("error");
    expect(await getMeta(a.db, META_LINKED_USER)).toBeNull();
    expect(a.summaries).toHaveLength(0);

    remote.failPushFor = null;
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("idle");
    expect(await getMeta(a.db, META_LINKED_USER)).toBe("utente-1");
    expect(a.summaries).toHaveLength(1);
    // Niente doppioni: il riepilogo conta le righe scritte davvero.
    expect(a.summaries[0].byTable.tasks).toBe(1);
    expect(a.summaries[0].byTable.events).toBe(1);
    expect(remote.rowsOf("lo_tasks")).toHaveLength(1);
    expect(remote.rowsOf("lo_events")).toHaveLength(1);
  });
});

describe("SyncEngine — stati", () => {
  it("offline: nessuna chiamata remota, poi si riprende", async () => {
    const remote = new FakeRemote();
    let online = false;
    const a = makeDevice({ remote, isOnline: () => online });
    must(await a.repos.tasks.create({ title: "In attesa" }));

    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("offline");
    expect(remote.pullCalls).toBe(0);
    expect(remote.pushCalls).toHaveLength(0);

    online = true;
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("idle");
    expect(remote.rowsOf("lo_tasks")).toHaveLength(1);
  });

  it("errore remoto: stato error con messaggio, poi retry pulito", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Riprovami" }));

    remote.failWith = new Error("api giù");
    await a.engine.syncNow();
    const inErrore = a.states.at(-1);
    expect(inErrore?.status).toBe("error");
    expect(inErrore?.lastError).toMatch(/sincronizzare/);
    // Il ciclo passa comunque da "syncing" prima di fallire.
    expect(a.states.some((s) => s.status === "syncing")).toBe(true);

    remote.failWith = null;
    await a.engine.syncNow();
    expect(a.states.at(-1)?.status).toBe("idle");
    expect(a.states.at(-1)?.lastError).toBeNull();
    expect(remote.rowsOf("lo_tasks")).toHaveLength(1);
  });
});

describe("SyncEngine — adozione e merge (B3.2)", () => {
  it("adozione: i dati ospite salgono al primo sync, con riepilogo", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Ospite 1" }));
    must(await a.repos.tasks.create({ title: "Ospite 2" }));
    must(await a.repos.tasks.create({ title: "Ospite 3" }));
    must(await a.repos.events.create({ title: "Festa", date: "2026-07-20" }));

    await a.engine.syncNow();

    expect(await getMeta(a.db, META_LINKED_USER)).toBe("utente-1");
    expect(a.summaries).toHaveLength(1);
    expect(a.summaries[0].byTable.tasks).toBe(3);
    expect(a.summaries[0].byTable.events).toBe(1);
    expect(a.summaries[0].total).toBe(4);
    expect(remote.rowsOf("lo_tasks")).toHaveLength(3);
  });

  it("merge sul secondo dispositivo: unione per UUID + LWW, riepilogo giusto", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote, clock: tickingClock(T0) });
    must(await a.repos.tasks.create({ title: "Dal primo" }));
    must(await a.repos.tasks.create({ title: "Sempre dal primo" }));
    await a.engine.syncNow();

    const b = makeDevice({ remote, clock: tickingClock(T0 + 60_000) });
    must(await b.repos.tasks.create({ title: "Dal secondo" }));
    await b.engine.syncNow();

    // B ha l'unione; il riepilogo conta 2 pull + 1 push.
    expect((await b.db.tasks.toArray()).length).toBe(3);
    expect(b.summaries).toHaveLength(1);
    expect(b.summaries[0].byTable.tasks).toBe(3);

    await a.engine.syncNow();
    expect((await a.db.tasks.toArray()).length).toBe(3);
  });

  it("il riepilogo scatta una volta sola per account", async () => {
    const remote = new FakeRemote();
    const a = makeDevice({ remote });
    must(await a.repos.tasks.create({ title: "Unica" }));
    await a.engine.syncNow();
    await a.engine.syncNow();
    expect(a.summaries).toHaveLength(1);

    // Anche con un engine nuovo sullo stesso db (riavvio): già collegato.
    let extra = 0;
    const riavviato = new SyncEngine({
      db: a.db,
      remote,
      userId: "utente-1",
      onFirstSync: () => {
        extra += 1;
      },
    });
    await riavviato.syncNow();
    expect(extra).toBe(0);
  });
});
