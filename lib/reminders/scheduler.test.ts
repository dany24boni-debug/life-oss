import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInAppScheduler,
  type DeliveryKind,
  type SchedulerReminder,
} from "./scheduler";

type FakeReminder = SchedulerReminder & { fired: boolean };

/** Mini-repo in memoria con la stessa semantica del port. */
function makeRepo(fireAts: string[]) {
  const rows: FakeReminder[] = fireAts.map((fire_at, i) => ({
    id: `r${i + 1}`,
    fire_at,
    fired: false,
  }));
  return {
    rows,
    listPending: (nowIso: string) =>
      Promise.resolve(rows.filter((r) => !r.fired && r.fire_at <= nowIso)),
    markFired: (id: string) => {
      const row = rows.find((r) => r.id === id);
      if (!row || row.fired) return Promise.resolve({ ok: false });
      row.fired = true;
      return Promise.resolve({ ok: true });
    },
  };
}

function makeDelivered() {
  const calls: Array<{ ids: string[]; kind: DeliveryKind }> = [];
  return {
    calls,
    deliver: (rs: SchedulerReminder[], kind: DeliveryKind) => {
      calls.push({ ids: rs.map((r) => r.id), kind });
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-10T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createInAppScheduler", () => {
  it("uno scaduto fresco scatta UNA volta come live, mai due", async () => {
    const repo = makeRepo(["2026-07-10T09:59:30.000Z"]);
    const out = makeDelivered();
    const s = createInAppScheduler({ ...repo, deliver: out.deliver });

    await s.tick();
    expect(out.calls).toEqual([{ ids: ["r1"], kind: "live" }]);

    await s.tick(); // secondo passaggio: già fired, niente
    expect(out.calls).toHaveLength(1);
  });

  it("gli scaduti vecchi (mentre eri via) vanno in catchup, non in toast", async () => {
    const repo = makeRepo([
      "2026-07-10T08:00:00.000Z", // 2 ore fa
      "2026-07-10T09:59:45.000Z", // 15 secondi fa
    ]);
    const out = makeDelivered();
    const s = createInAppScheduler({ ...repo, deliver: out.deliver });

    await s.tick();
    expect(out.calls).toEqual([
      { ids: ["r2"], kind: "live" },
      { ids: ["r1"], kind: "catchup" },
    ]);
  });

  it("il futuro non scatta; scatta quando arriva il suo momento via interval", async () => {
    const repo = makeRepo(["2026-07-10T10:01:00.000Z"]);
    const out = makeDelivered();
    const s = createInAppScheduler({ ...repo, deliver: out.deliver });

    s.start();
    await vi.advanceTimersByTimeAsync(30_000); // 10:00:30 — ancora niente
    expect(out.calls).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(60_000); // 10:01:30 — scaduto da 30s
    expect(out.calls).toEqual([{ ids: ["r1"], kind: "live" }]);
    s.stop();
  });

  it("stop ferma l'interval; start è idempotente", async () => {
    const repo = makeRepo([]);
    const out = makeDelivered();
    const listSpy = vi.fn(repo.listPending);
    const s = createInAppScheduler({
      listPending: listSpy,
      markFired: repo.markFired,
      deliver: out.deliver,
    });

    s.start();
    s.start(); // idempotente: un solo interval
    await vi.advanceTimersByTimeAsync(90_000);
    const afterRun = listSpy.mock.calls.length;
    expect(afterRun).toBeGreaterThanOrEqual(3); // tick immediato + ~3 interval

    s.stop();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(listSpy.mock.calls.length).toBe(afterRun);
  });

  it("markFired ko (gestito altrove) esclude la consegna", async () => {
    const repo = makeRepo(["2026-07-10T09:59:50.000Z"]);
    const out = makeDelivered();
    const s = createInAppScheduler({
      listPending: repo.listPending,
      markFired: () => Promise.resolve({ ok: false }),
      deliver: out.deliver,
    });
    await s.tick();
    expect(out.calls).toHaveLength(0);
  });

  it("la soglia live/catchup è iniettabile", async () => {
    const repo = makeRepo(["2026-07-10T09:58:00.000Z"]); // 2 minuti fa
    const out = makeDelivered();
    const s = createInAppScheduler({
      ...repo,
      deliver: out.deliver,
      catchupAfterMs: 5 * 60_000, // entro 5 minuti è ancora "live"
    });
    await s.tick();
    expect(out.calls).toEqual([{ ids: ["r1"], kind: "live" }]);
  });
});
