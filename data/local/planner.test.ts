import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalPlannerRepo, slotCheckId } from "./planner";

let counter = 0;
let db: LifeosDb;
let repo: LocalPlannerRepo;

beforeEach(() => {
  db = new LifeosDb(`test-planner-${++counter}`);
  repo = new LocalPlannerRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalPlannerRepo — piani", () => {
  it("al più un piano attivo: attivarne uno spegne gli altri", async () => {
    const lavoro = await must(
      repo.createPlan({ name: "Settimana lavoro", is_active: true }),
    );
    const ferie = await must(repo.createPlan({ name: "Settimana ferie" }));
    expect((await repo.activePlan())?.id).toBe(lavoro.id);

    await must(repo.updatePlan(ferie.id, { is_active: true }));
    expect((await repo.activePlan())?.id).toBe(ferie.id);
    expect((await repo.getPlanById(lavoro.id))?.is_active).toBe(false);
    // Lista: l'attivo per primo.
    expect((await repo.listPlans()).map((p) => p.name)).toEqual([
      "Settimana ferie",
      "Settimana lavoro",
    ]);
  });

  it("duplicate: copia gli slot, mai attiva, la storia resta all'originale", async () => {
    const plan = await must(
      repo.createPlan({ name: "Settimana lavoro", is_active: true }),
    );
    const s = await must(
      repo.createSlot({
        plan_id: plan.id,
        weekday: 1,
        start_hhmm: "07:00",
        title: "Palestra",
      }),
    );
    await must(repo.setCheck(s.id, "2026-W27", "done"));

    const copy = await must(repo.duplicatePlan(plan.id));
    expect(copy.name).toBe("Settimana lavoro (copia)");
    expect(copy.is_active).toBe(false);
    const copySlots = await repo.listSlots(copy.id);
    expect(copySlots).toHaveLength(1);
    expect(copySlots[0].title).toBe("Palestra");
    expect(copySlots[0].id).not.toBe(s.id);
    // Nessun check sul clone.
    expect(await repo.getCheck(copySlots[0].id, "2026-W27")).toBeNull();
  });

  it("cascade: eliminare il piano tombstona slot e check; l'undo li revive", async () => {
    const plan = await must(repo.createPlan({ name: "Settimana lavoro" }));
    const s = await must(
      repo.createSlot({
        plan_id: plan.id,
        weekday: 1,
        start_hhmm: "07:00",
        title: "Palestra",
      }),
    );
    await must(repo.setCheck(s.id, "2026-W27", "done"));

    await must(repo.softDeletePlan(plan.id));
    expect(await repo.getPlanById(plan.id)).toBeNull();
    expect(await repo.listSlots(plan.id)).toHaveLength(0);
    expect(await repo.getCheck(s.id, "2026-W27")).toBeNull();

    await must(repo.restorePlan(plan.id));
    expect(await repo.getPlanById(plan.id)).not.toBeNull();
    expect(await repo.listSlots(plan.id)).toHaveLength(1);
    expect((await repo.getCheck(s.id, "2026-W27"))?.state).toBe("done");
  });
});

describe("LocalPlannerRepo — slot", () => {
  it("lista ordinata per giorno, poi orario, poi sort_order; reorder = indice", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const b = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "09:00", title: "B" }),
    );
    const a = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "A" }),
    );
    const c = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 2, start_hhmm: "07:00", title: "C" }),
    );
    expect((await repo.listSlots(plan.id)).map((s) => s.title)).toEqual([
      "A",
      "B",
      "C",
    ]);

    // Due slot alla stessa ora: decide il riordino manuale.
    const a2 = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "A2" }),
    );
    await must(repo.reorderSlots(plan.id, [a2.id, a.id, b.id, c.id]));
    expect((await repo.listSlots(plan.id)).map((s) => s.title)).toEqual([
      "A2",
      "A",
      "B",
      "C",
    ]);
  });

  it("copySlotToWeekdays: copie negli altri giorni, mai nel proprio", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const s = await must(
      repo.createSlot({
        plan_id: plan.id,
        weekday: 1,
        start_hhmm: "07:00",
        title: "Palestra",
        notes: "Torso A",
      }),
    );
    const copies = await must(repo.copySlotToWeekdays(s.id, [1, 3, 5, 3]));
    expect(copies.map((c) => c.weekday)).toEqual([3, 5]);
    expect(copies[0].title).toBe("Palestra");
    expect(copies[0].notes).toBe("Torso A");
    expect(await repo.listSlots(plan.id)).toHaveLength(3);
  });

  it("cascade slot: i suoi check muoiono e rivivono col restore", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const s = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "X" }),
    );
    await must(repo.setCheck(s.id, "2026-W27", "skipped"));
    await must(repo.softDeleteSlot(s.id));
    expect(await repo.listSlots(plan.id)).toHaveLength(0);
    expect(await repo.getCheck(s.id, "2026-W27")).toBeNull();
    await must(repo.restoreSlot(s.id));
    expect((await repo.getCheck(s.id, "2026-W27"))?.state).toBe("skipped");
  });
});

describe("LocalPlannerRepo — check per settimana (id derivato)", () => {
  it("setCheck crea e aggiorna la STESSA riga (slot, settimana)", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const s = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "X" }),
    );
    const done = await must(repo.setCheck(s.id, "2026-W28", "done"));
    expect(done.id).toBe(await slotCheckId(s.id, "2026-W28"));
    expect(done.checked_at).not.toBeNull();

    const skipped = await must(repo.setCheck(s.id, "2026-W28", "skipped"));
    expect(skipped.id).toBe(done.id);
    expect(await db.slot_checks.count()).toBe(1);

    // De-spuntare: la riga resta con state null (l'annullamento viaggia).
    const cleared = await must(repo.setCheck(s.id, "2026-W28", null));
    expect(cleared.state).toBeNull();
    expect(cleared.checked_at).toBeNull();
    expect(await db.slot_checks.count()).toBe(1);

    // Settimane diverse = righe diverse: la storia è append-only.
    await must(repo.setCheck(s.id, "2026-W29", "done"));
    expect(await db.slot_checks.count()).toBe(2);
  });

  it("settimana malformata o slot morto: errori onesti", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const s = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "X" }),
    );
    const bad = await repo.setCheck(s.id, "2026-28", "done");
    expect(!bad.ok && bad.error.code).toBe("validation");
    await must(repo.softDeleteSlot(s.id));
    const dead = await repo.setCheck(s.id, "2026-W28", "done");
    expect(!dead.ok && dead.error.code).toBe("not_found");
  });
});

describe("LocalPlannerRepo — weekBoard e weekStats", () => {
  it("board della settimana: date giuste, slot con lo stato", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    const s1 = await must(
      repo.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "Palestra" }),
    );
    await must(
      repo.createSlot({ plan_id: plan.id, weekday: 7, start_hhmm: "10:00", title: "Chiamata" }),
    );
    await must(repo.setCheck(s1.id, "2026-W28", "done"));

    const board = await repo.weekBoard(plan.id, "2026-W28");
    expect(board[0].date).toBe("2026-07-06");
    expect(board[0].slots[0].state).toBe("done");
    expect(board[6].slots[0].slot.title).toBe("Chiamata");
    expect(board[6].slots[0].state).toBeNull();
  });

  it("weekStats via repo: la classifica dei saltati arriva alla UI", async () => {
    const plan = await must(repo.createPlan({ name: "P" }));
    // Slot retrodatati: esistono da prima delle settimane osservate.
    const early = new LocalPlannerRepo(db, () => "2026-06-01T08:00:00.000Z");
    const s1 = await must(
      early.createSlot({ plan_id: plan.id, weekday: 1, start_hhmm: "07:00", title: "Palestra" }),
    );
    const s2 = await must(
      early.createSlot({ plan_id: plan.id, weekday: 5, start_hhmm: "18:00", title: "Pulizie" }),
    );
    await must(repo.setCheck(s1.id, "2026-W26", "done"));
    await must(repo.setCheck(s1.id, "2026-W27", "done"));
    await must(repo.setCheck(s2.id, "2026-W26", "skipped"));
    // s2 mai toccato in W27: salto silenzioso.

    const stats = await repo.weekStats(plan.id, 3, "2026-W28");
    expect(stats.weeks.map((w) => w.isoWeek)).toEqual([
      "2026-W26",
      "2026-W27",
      "2026-W28",
    ]);
    expect(stats.weeks[0]).toMatchObject({ total: 2, done: 1, skipped: 1 });
    expect(stats.mostSkipped).toHaveLength(1);
    expect(stats.mostSkipped[0].slot.title).toBe("Pulizie");
    expect(stats.mostSkipped[0].missed).toBe(2);
  });
});
