import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { WATER_HABIT_ID, seedWaterHabit } from "../habits";
import type { Result } from "../result";
import { LocalHabitsRepo, habitLogId } from "./habits";
import { LocalBodyRepo } from "./body";
import { LocalSettingsRepo } from "./settings";

let counter = 0;
let db: LifeosDb;
let repo: LocalHabitsRepo;

beforeEach(() => {
  db = new LifeosDb(`test-habits-${++counter}`);
  repo = new LocalHabitsRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalHabitsRepo — CRUD e normalizzazioni", () => {
  it("create: default (icona, coda della board) e normalizzazione per specie", async () => {
    const lettura = await must(
      repo.create({
        name: "Lettura",
        kind: "quantity",
        unit: "pagine",
        daily_target: 10,
      }),
    );
    expect(lettura.icon).toBe("spunta");
    expect(lettura.sort_order).toBe(0);

    // boolean: unit e daily_target sempre null, qualsiasi input.
    const camminata = await must(
      repo.create({
        name: "Camminata",
        kind: "boolean",
        unit: "km",
        daily_target: 5,
      }),
    );
    expect(camminata.unit).toBeNull();
    expect(camminata.daily_target).toBeNull();
    expect(camminata.sort_order).toBe(1); // in coda

    // counter: unit null (è solo delle quantity), target resta.
    const flessioni = await must(
      repo.create({
        name: "Flessioni",
        kind: "counter",
        unit: "x",
        daily_target: 30,
      }),
    );
    expect(flessioni.unit).toBeNull();
    expect(flessioni.daily_target).toBe(30);
  });

  it("weekdays: dedupe + sort; tutti e 7 = null (tutti i giorni)", async () => {
    const h = await must(
      repo.create({ name: "Solo feriali", kind: "boolean", weekdays: [5, 1, 3, 1] }),
    );
    expect(h.weekdays).toEqual([1, 3, 5]);
    const tutti = await must(
      repo.update(h.id, { weekdays: [7, 6, 5, 4, 3, 2, 1] }),
    );
    expect(tutti.weekdays).toBeNull();
  });

  it("update: kind non è patchabile (fuori dagli editable), il resto sì", async () => {
    const h = await must(repo.create({ name: "Acqua fredda", kind: "counter" }));
    const next = await must(
      repo.update(h.id, { name: "Doccia fredda", daily_target: 1 }),
    );
    expect(next.name).toBe("Doccia fredda");
    expect(next.kind).toBe("counter");
    // kind ignorato dallo strip zod anche se passato.
    const sneaky = await must(
      repo.update(h.id, { kind: "quantity" } as never),
    );
    expect(sneaky.kind).toBe("counter");
  });

  it("archive/unarchive: sparisce dalla lista di default, resta con includeArchived", async () => {
    const h = await must(repo.create({ name: "Meditazione", kind: "boolean" }));
    await must(repo.archive(h.id));
    expect((await repo.listAll()).map((x) => x.name)).toEqual([]);
    expect(
      (await repo.listAll({ includeArchived: true })).map((x) => x.name),
    ).toEqual(["Meditazione"]);
    await must(repo.unarchive(h.id));
    expect((await repo.listAll()).map((x) => x.name)).toEqual(["Meditazione"]);
  });

  it("reorder: sort_order = indice; id ignoti saltati senza errore", async () => {
    const a = await must(repo.create({ name: "A", kind: "boolean" }));
    const b = await must(repo.create({ name: "B", kind: "boolean" }));
    const c = await must(repo.create({ name: "C", kind: "boolean" }));
    await must(repo.reorder([c.id, "01980000-0000-7000-8000-00000000dead", a.id, b.id]));
    expect((await repo.listAll()).map((x) => x.name)).toEqual(["C", "A", "B"]);
  });
});

describe("LocalHabitsRepo — log per-giorno (id derivato)", () => {
  it("logDay crea e aggiorna la STESSA riga del giorno", async () => {
    const h = await must(repo.create({ name: "Lettura", kind: "quantity", unit: "pagine" }));
    const created = await must(repo.logDay(h.id, "2026-07-12", 5));
    expect(created.id).toBe(await habitLogId(h.id, "2026-07-12"));
    const updated = await must(repo.logDay(h.id, "2026-07-12", 12));
    expect(updated.id).toBe(created.id);
    expect(updated.value).toBe(12);
    expect(await db.habit_logs.count()).toBe(1);
  });

  it("incrementDay: somma, clampa a >= 0, crea la riga se manca", async () => {
    const h = await must(repo.create({ name: "Acqua", kind: "quantity", unit: "ml" }));
    await must(repo.incrementDay(h.id, "2026-07-12", 330));
    await must(repo.incrementDay(h.id, "2026-07-12", 500));
    expect((await repo.getLog(h.id, "2026-07-12"))?.value).toBe(830);
    // Decremento oltre lo zero: si ferma a zero, mai negativo.
    await must(repo.incrementDay(h.id, "2026-07-12", -2000));
    expect((await repo.getLog(h.id, "2026-07-12"))?.value).toBe(0);
  });

  it("loggare su abitudine eliminata = not_found; valore fuori dominio = clamp al tetto", async () => {
    const h = await must(repo.create({ name: "X", kind: "counter" }));
    await must(repo.softDelete(h.id));
    const r = await repo.logDay(h.id, "2026-07-12", 1);
    expect(!r.ok && r.error.code).toBe("not_found");

    const viva = await must(repo.create({ name: "Y", kind: "counter" }));
    const capped = await must(repo.incrementDay(viva.id, "2026-07-12", 2_000_000));
    expect(capped.value).toBe(1_000_000);
  });

  it("cascade: eliminare l'abitudine tombstona i log; l'undo revive SOLO quel cascade", async () => {
    const h = await must(repo.create({ name: "Lettura", kind: "counter" }));
    await must(repo.logDay(h.id, "2026-07-10", 1));
    await must(repo.logDay(h.id, "2026-07-11", 1));
    // Un giorno azzerato e "eliminato" a mano prima (upsert non ha
    // softDelete per-log; simulo una tombstone pre-esistente dal sync).
    const preId = await habitLogId(h.id, "2026-07-09");
    await db.habit_logs.add({
      id: preId,
      habit_id: h.id,
      date: "2026-07-09",
      value: 1,
      created_at: "2026-07-09T20:00:00.000Z",
      updated_at: "2026-07-09T21:00:00.000Z",
      deleted_at: "2026-07-09T21:00:00.000Z",
    });

    await must(repo.softDelete(h.id));
    expect(await repo.getById(h.id)).toBeNull();
    expect(await repo.listLogsByDay("2026-07-10")).toHaveLength(0);

    const restored = await must(repo.restore(h.id));
    expect(restored.name).toBe("Lettura");
    expect(await repo.getLog(h.id, "2026-07-10")).not.toBeNull();
    expect(await repo.getLog(h.id, "2026-07-11")).not.toBeNull();
    // La tombstone precedente NON era del cascade: resta morta.
    expect(await repo.getLog(h.id, "2026-07-09")).toBeNull();
  });
});

describe("LocalHabitsRepo — dayBoard", () => {
  it("solo abitudini previste quel giorno, col done calcolato", async () => {
    // 2026-07-12 è una domenica (weekday 7).
    const tutti = await must(
      repo.create({ name: "Acqua fredda", kind: "boolean" }),
    );
    await must(
      repo.create({ name: "Solo feriali", kind: "boolean", weekdays: [1, 2, 3, 4, 5] }),
    );
    await must(repo.logDay(tutti.id, "2026-07-12", 1));

    const board = await repo.dayBoard("2026-07-12");
    expect(board.map((e) => e.habit.name)).toEqual(["Acqua fredda"]);
    expect(board[0].done).toBe(true);
    expect(board[0].target).toBe(1); // boolean: obiettivo sempre 1

    const lunedi = await repo.dayBoard("2026-07-13");
    expect(lunedi.map((e) => e.habit.name)).toEqual([
      "Acqua fredda",
      "Solo feriali",
    ]);
    expect(lunedi[0].done).toBe(false);
  });

  it("archiviate fuori dalla board; obiettivo dell'acqua derivato dal peso", async () => {
    await seedWaterHabit(db);
    const body = new LocalBodyRepo(db);
    await must(body.upsertDay("2026-07-10", { weight_kg: 80 }));

    const board = await repo.dayBoard("2026-07-12");
    const acqua = board.find((e) => e.habit.id === WATER_HABIT_ID);
    expect(acqua?.target).toBe(2800); // 80 kg × 35 ml
    expect(acqua?.done).toBe(false);

    await must(repo.incrementDay(WATER_HABIT_ID, "2026-07-12", 2800));
    const dopo = await repo.dayBoard("2026-07-12");
    expect(dopo.find((e) => e.habit.id === WATER_HABIT_ID)?.done).toBe(true);

    // Override manuale: vince sul derivato.
    await must(repo.update(WATER_HABIT_ID, { daily_target: 3000 }));
    const conOverride = await repo.dayBoard("2026-07-12");
    expect(
      conOverride.find((e) => e.habit.id === WATER_HABIT_ID)?.target,
    ).toBe(3000);

    await must(repo.archive(WATER_HABIT_ID));
    expect(await repo.dayBoard("2026-07-12")).toHaveLength(0);
  });
});

describe("LocalHabitsRepo — streak per-abitudine", () => {
  it("giorni consecutivi completati; oggi in sospeso non rompe", async () => {
    const h = await must(
      repo.create({ name: "Lettura", kind: "quantity", unit: "pagine", daily_target: 10 }),
    );
    await must(repo.logDay(h.id, "2026-07-10", 10));
    await must(repo.logDay(h.id, "2026-07-11", 15));
    // Oggi sotto obiettivo: non conta, ma non spezza.
    await must(repo.logDay(h.id, "2026-07-12", 3));
    const s = await repo.habitStreak(h.id, { today: "2026-07-12" });
    expect(s).toEqual({ current: 2, best: 2, todayCounts: false });
  });

  it("i giorni NON previsti fanno ponte (schedule feriale)", async () => {
    // Prevista solo lun-ven: il weekend non spezza.
    const h = await must(
      repo.create({ name: "Palestra casa", kind: "boolean", weekdays: [1, 2, 3, 4, 5] }),
    );
    await must(repo.logDay(h.id, "2026-07-09", 1)); // giovedì
    await must(repo.logDay(h.id, "2026-07-10", 1)); // venerdì
    // Sabato 11 e domenica 12: non previsti.
    await must(repo.logDay(h.id, "2026-07-13", 1)); // lunedì
    const s = await repo.habitStreak(h.id, { today: "2026-07-13" });
    expect(s).toEqual({ current: 3, best: 3, todayCounts: true });
  });

  it("i giorni protetti (Impostazioni) fanno ponte anche per-abitudine", async () => {
    const settings = new LocalSettingsRepo(db);
    await must(settings.update({ protected_days: ["2026-07-11"] }));
    const h = await must(repo.create({ name: "Acqua fredda", kind: "boolean" }));
    await must(repo.logDay(h.id, "2026-07-10", 1));
    await must(repo.logDay(h.id, "2026-07-12", 1));
    const s = await repo.habitStreak(h.id, { today: "2026-07-12" });
    expect(s).toEqual({ current: 2, best: 2, todayCounts: true });
  });

  it("un buco vero spezza; best ricorda la catena migliore", async () => {
    const h = await must(repo.create({ name: "X", kind: "boolean" }));
    await must(repo.logDay(h.id, "2026-07-05", 1));
    await must(repo.logDay(h.id, "2026-07-06", 1));
    await must(repo.logDay(h.id, "2026-07-07", 1));
    // 8 e 9 buchi non protetti.
    await must(repo.logDay(h.id, "2026-07-10", 1));
    const s = await repo.habitStreak(h.id, { today: "2026-07-10" });
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });

  it("DST: la catena attraversa il cambio d'ora di primavera (Europe/Rome) senza saltare", async () => {
    // 2026-03-29 è la notte del +1h in Europa: i giorni civili restano
    // esattamente consecutivi (aritmetica su stringhe a mezzogiorno UTC).
    const h = await must(repo.create({ name: "X", kind: "boolean" }));
    await must(repo.logDay(h.id, "2026-03-28", 1));
    await must(repo.logDay(h.id, "2026-03-29", 1));
    await must(repo.logDay(h.id, "2026-03-30", 1));
    const primavera = await repo.habitStreak(h.id, { today: "2026-03-30" });
    expect(primavera).toEqual({ current: 3, best: 3, todayCounts: true });

    // E il cambio d'autunno (−1h, 2026-10-25).
    await must(repo.logDay(h.id, "2026-10-24", 1));
    await must(repo.logDay(h.id, "2026-10-25", 1));
    await must(repo.logDay(h.id, "2026-10-26", 1));
    const autunno = await repo.habitStreak(h.id, { today: "2026-10-26" });
    expect(autunno.current).toBe(3);
  });

  it("valuta il done contro l'obiettivo effettivo corrente (acqua derivata)", async () => {
    await seedWaterHabit(db);
    const body = new LocalBodyRepo(db);
    await must(body.upsertDay("2026-07-10", { weight_kg: 80 })); // target 2800
    await must(repo.logDay(WATER_HABIT_ID, "2026-07-11", 2800));
    await must(repo.logDay(WATER_HABIT_ID, "2026-07-12", 2000)); // sotto
    const s = await repo.habitStreak(WATER_HABIT_ID, { today: "2026-07-12" });
    expect(s.current).toBe(1);
    expect(s.todayCounts).toBe(false);
  });

  it("abitudine inesistente o eliminata: streak a zero, mai un throw", async () => {
    expect(
      await repo.habitStreak("01980000-0000-7000-8000-00000000dead", {
        today: "2026-07-12",
      }),
    ).toEqual({ current: 0, best: 0, todayCounts: false });
  });
});

describe("LocalHabitsRepo — purge", () => {
  it("purgeTombstones copre abitudini E log", async () => {
    const h = await must(repo.create({ name: "X", kind: "boolean" }));
    await must(repo.logDay(h.id, "2026-07-12", 1));
    await must(repo.softDelete(h.id));
    const purged = await repo.purgeTombstones("2100-01-01T00:00:00.000Z");
    expect(purged.ok && purged.data).toBe(2);
    expect(await db.habits.count()).toBe(0);
    expect(await db.habit_logs.count()).toBe(0);
  });
});
