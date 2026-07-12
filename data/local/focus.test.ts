import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import { LocalFocusRepo } from "./focus";
import { LocalStatsRepo } from "./stats";

let counter = 0;
let db: LifeosDb;
let repo: LocalFocusRepo;

beforeEach(() => {
  db = new LifeosDb(`test-focus-${++counter}`);
  repo = new LocalFocusRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

describe("LocalFocusRepo — registro append-only", () => {
  it("due fasi lo stesso giorno sono DUE righe; minutesByDay le somma", async () => {
    await must(repo.add({ date: "2026-07-12", minutes: 25 }));
    await must(repo.add({ date: "2026-07-12", minutes: 26 }));
    await must(repo.add({ date: "2026-07-11", minutes: 50 }));
    expect(await db.focus_sessions.count()).toBe(3);

    expect(await repo.minutesByDay("2026-07-10", "2026-07-12")).toEqual([
      { date: "2026-07-11", minutes: 50 },
      { date: "2026-07-12", minutes: 51 },
    ]);
    expect(
      (await repo.listRange("2026-07-12", "2026-07-12")).map((r) => r.minutes),
    ).toEqual([25, 26]);
  });

  it("domini onesti: minuti 1..600, data ISO", async () => {
    const zero = await repo.add({ date: "2026-07-12", minutes: 0 });
    expect(!zero.ok && zero.error.code).toBe("validation");
    const troppi = await repo.add({ date: "2026-07-12", minutes: 601 });
    expect(!troppi.ok && troppi.error.code).toBe("validation");
    const badDate = await repo.add({ date: "12/07/2026", minutes: 25 });
    expect(!badDate.ok && badDate.error.code).toBe("validation");
  });

  it("una fase di focus fa contare il giorno nella streak globale", async () => {
    const stats = new LocalStatsRepo(db);
    await must(repo.add({ date: "2026-07-12", minutes: 25 }));
    expect(
      await stats.activityDays("2026-07-12", "2026-07-12", "UTC"),
    ).toEqual(["2026-07-12"]);
    const s = await stats.streak({ today: "2026-07-12", timeZone: "UTC" });
    expect(s.todayCounts).toBe(true);
  });
});
