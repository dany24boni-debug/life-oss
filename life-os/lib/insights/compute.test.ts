import { describe, it, expect } from "vitest";
import {
  computeWeeklyRhythm,
  computeSleepCorrelation,
  computeStreakRecordApproach,
  computeTargetTrajectories,
  computeRecentPRs,
  computeModuleHeat,
} from "./compute";

describe("computeWeeklyRhythm", () => {
  it("returns null on too-little data", () => {
    expect(
      computeWeeklyRhythm({
        tasks: [
          { date: "2026-05-01", completed: true },
          { date: "2026-05-02", completed: false },
        ],
      }),
    ).toBeNull();
  });

  it("returns null on flat completion across days", () => {
    const tasks: { date: string; completed: boolean }[] = [];
    // 14 days, all 100% completion → flat → no insight
    for (let i = 1; i <= 14; i++) {
      const date = `2026-04-${String(i).padStart(2, "0")}`;
      tasks.push({ date, completed: true });
      tasks.push({ date, completed: true });
    }
    expect(computeWeeklyRhythm({ tasks })).toBeNull();
  });

  it("flags the best vs worst weekday when delta ≥ 15%", () => {
    // Monday (2026-04-06) → 100% completion. Friday → 0%.
    // 3 weeks of this pattern (April: Mon 6/13/20, Fri 10/17/24 — all valid).
    const tasks: { date: string; completed: boolean }[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let week = 0; week < 3; week++) {
      const monDay = 6 + week * 7;
      const friDay = 10 + week * 7;
      tasks.push({ date: `2026-04-${pad(monDay)}`, completed: true });
      tasks.push({ date: `2026-04-${pad(monDay)}`, completed: true });
      tasks.push({ date: `2026-04-${pad(friDay)}`, completed: false });
      tasks.push({ date: `2026-04-${pad(friDay)}`, completed: false });
      // Tue, Wed, Thu — moderate completion
      for (let d = monDay + 1; d <= monDay + 3; d++) {
        tasks.push({ date: `2026-04-${pad(d)}`, completed: true });
        tasks.push({ date: `2026-04-${pad(d)}`, completed: false });
      }
    }
    const out = computeWeeklyRhythm({ tasks });
    expect(out).not.toBeNull();
    expect(out!.kind).toBe("weekly_rhythm");
    expect(out!.headline).toMatch(/Lunedì/);
  });
});

describe("computeSleepCorrelation", () => {
  const baseDay = (i: number, hours: number | null, rate: number) => ({
    date: `2026-04-${String(i).padStart(2, "0")}`,
    sleepHours: hours,
    completionRate: rate,
    total: 5,
  });

  it("returns null with too few datapoints", () => {
    expect(
      computeSleepCorrelation({
        days: [baseDay(1, 8, 0.9), baseDay(2, 6, 0.4)],
      }),
    ).toBeNull();
  });

  it("flags positive correlation when 7h+ nights have higher completion", () => {
    const days = [
      baseDay(1, 8, 0.9),
      baseDay(2, 8, 0.95),
      baseDay(3, 7.5, 0.85),
      baseDay(4, 7, 0.8),
      baseDay(5, 6, 0.4),
      baseDay(6, 5.5, 0.3),
      baseDay(7, 6.5, 0.5),
      baseDay(8, 8, 0.85),
    ];
    const out = computeSleepCorrelation({ days });
    expect(out).not.toBeNull();
    expect(out!.tone).toBe("good");
    expect(out!.headline).toMatch(/7h/);
  });

  it("returns null when sleep doesn't matter (delta < 8%)", () => {
    const days = [
      baseDay(1, 8, 0.7),
      baseDay(2, 8, 0.72),
      baseDay(3, 7.5, 0.71),
      baseDay(4, 6, 0.69),
      baseDay(5, 5.5, 0.68),
      baseDay(6, 6.5, 0.7),
      baseDay(7, 7, 0.71),
      baseDay(8, 8, 0.72),
    ];
    expect(computeSleepCorrelation({ days })).toBeNull();
  });
});

describe("computeStreakRecordApproach", () => {
  it("returns null when best is too small to brag about", () => {
    expect(computeStreakRecordApproach({ current: 1, best: 2 })).toBeNull();
  });

  it("celebrates new record when current > best", () => {
    const out = computeStreakRecordApproach({ current: 12, best: 10 });
    expect(out).not.toBeNull();
    expect(out!.tone).toBe("good");
    expect(out!.headline).toMatch(/Nuovo record/);
  });

  it("flags tied record when current == best", () => {
    const out = computeStreakRecordApproach({ current: 10, best: 10 });
    expect(out).not.toBeNull();
    expect(out!.tone).toBe("energy");
  });

  it("flags 1-2 days from record", () => {
    const out = computeStreakRecordApproach({ current: 9, best: 10 });
    expect(out).not.toBeNull();
    expect(out!.headline).toMatch(/1 giorno/);
  });

  it("returns null when current is far from best", () => {
    expect(computeStreakRecordApproach({ current: 3, best: 18 })).toBeNull();
  });
});

describe("computeTargetTrajectories", () => {
  it("emits nothing on empty input or too-early in month", () => {
    expect(
      computeTargetTrajectories({ targets: [], dayOfMonth: 15, daysInMonth: 30 }),
    ).toEqual([]);
    expect(
      computeTargetTrajectories({
        targets: [{ module: "x", metric: "y", current: 0, target: 100 }],
        dayOfMonth: 3,
        daysInMonth: 30,
      }),
    ).toEqual([]);
  });

  it("flags under-pace (warn) when ratio is 0.6-0.9", () => {
    const out = computeTargetTrajectories({
      targets: [{ module: "chameleon_os", metric: "revenue_eur", current: 200, target: 700 }],
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    // expected at day 15 = 350, current = 200 → ratio 0.57 → "rischio di mancarlo"
    expect(out.length).toBe(1);
    expect(out[0].tone).toBe("bad");
  });

  it("flags above-pace (good)", () => {
    const out = computeTargetTrajectories({
      targets: [{ module: "gym", metric: "sessions", current: 9, target: 12 }],
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    // expected at day 15 = 6, current = 9 → ratio 1.5 → "stai sopra al passo"
    expect(out.length).toBe(1);
    expect(out[0].tone).toBe("good");
  });

  it("emits nothing when on-pace (ratio 0.9-1.2)", () => {
    const out = computeTargetTrajectories({
      targets: [{ module: "gym", metric: "sessions", current: 6, target: 12 }],
      dayOfMonth: 15,
      daysInMonth: 30,
    });
    expect(out).toEqual([]);
  });
});

describe("computeRecentPRs", () => {
  it("returns empty on no workouts", () => {
    expect(computeRecentPRs({ workouts: [] })).toEqual([]);
  });

  it("flags a PR when the most-recent best is in the last 7 days", () => {
    const out = computeRecentPRs({
      workouts: [
        // most recent first
        { exercise: "Panca", date: "2026-05-08", est1rm: 100 },
        { exercise: "Panca", date: "2026-04-01", est1rm: 90 },
        { exercise: "Squat", date: "2026-05-07", est1rm: 130 },
        { exercise: "Squat", date: "2026-04-10", est1rm: 130 }, // tie
      ],
    });
    expect(out.length).toBe(2);
    expect(out.map((o) => o.headline).join(" ")).toMatch(/Panca/);
    expect(out.map((o) => o.headline).join(" ")).toMatch(/Squat/);
  });

  it("doesn't flag a PR if the recent best is below the all-time best", () => {
    const out = computeRecentPRs({
      workouts: [
        { exercise: "Panca", date: "2026-05-08", est1rm: 90 },
        { exercise: "Panca", date: "2026-01-01", est1rm: 120 },
      ],
    });
    expect(out).toEqual([]);
  });
});

describe("computeModuleHeat", () => {
  it("returns null with too few events", () => {
    expect(
      computeModuleHeat({
        events: [
          { module: "gym", occurredAt: "2026-05-08T10:00:00Z" },
          { module: "gym", occurredAt: "2026-05-08T11:00:00Z" },
        ],
        weekStart: "2026-05-05",
      }),
    ).toBeNull();
  });

  it("flags the hottest module when ≥3 events and ≥5 total", () => {
    const events = [
      { module: "gym", occurredAt: "2026-05-08T10:00:00Z" },
      { module: "gym", occurredAt: "2026-05-08T11:00:00Z" },
      { module: "gym", occurredAt: "2026-05-08T12:00:00Z" },
      { module: "health", occurredAt: "2026-05-08T13:00:00Z" },
      { module: "finance", occurredAt: "2026-05-08T14:00:00Z" },
    ];
    const out = computeModuleHeat({ events, weekStart: "2026-05-05" });
    expect(out).not.toBeNull();
    expect(out!.headline).toMatch(/Gym/);
  });

  it("ignores events before weekStart", () => {
    const events = [
      { module: "gym", occurredAt: "2026-04-01T10:00:00Z" },
      { module: "gym", occurredAt: "2026-04-01T11:00:00Z" },
    ];
    expect(computeModuleHeat({ events, weekStart: "2026-05-05" })).toBeNull();
  });
});
