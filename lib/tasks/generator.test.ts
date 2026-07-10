import { beforeEach, describe, it, expect } from "vitest";
import {
  generateTasksFor,
  isDayKept,
  applyAdaptiveLoad,
  applyInPresenceLoad,
  todayInTimezone,
  yesterdayInTimezone,
  STREAK_THRESHOLD,
} from "./generator";
import { __resetRegistryForTests } from "@/lib/modules/registry";

// Shared-branch variant: nessun private module è registrato — la
// cartella `app/business/_private/` non esiste su questo branch.
// I test che la owner-branch variante registrava sono rimossi
// qui perché senza i register.ts non ci sono task contributions
// di quei moduli.
//
// `beforeEach` resetta comunque il registry per evitare contamination
// fra test (es. se un test usa registerModule per fixture).
beforeEach(() => {
  __resetRegistryForTests();
});

describe("generateTasksFor", () => {
  it("Esami pushes 3 study blocks regardless of active modules", () => {
    const out = generateTasksFor("Esami", []);
    const study = out.filter((t) => t.module === "studio");
    expect(study.length).toBe(3);
    expect(out.filter((t) => t.weight === "HEAVY").length).toBeGreaterThanOrEqual(2);
  });

  it("Esami includes optional gym/health/finance only when active", () => {
    const without = generateTasksFor("Esami", []);
    const withGym = generateTasksFor("Esami", ["gym"]);
    expect(withGym.length).toBe(without.length + 1);
    expect(withGym.some((t) => t.module === "gym")).toBe(true);
  });

  it("Manutenzione produces one task per active default module", () => {
    const out = generateTasksFor("Manutenzione", ["gym", "health", "finance"]);
    const slugs = new Set(out.map((t) => t.module));
    expect(slugs.has("gym")).toBe(true);
    expect(slugs.has("health")).toBe(true);
    expect(slugs.has("finance")).toBe(true);
  });

  it("Recupero is bounded and never exceeds 4 LIGHT items", () => {
    const out = generateTasksFor("Recupero", ["chameleon_os", "health", "gym", "finance", "studio"]);
    expect(out.length).toBeLessThanOrEqual(4);
    expect(out.every((t) => t.weight === "LIGHT")).toBe(true);
  });

  it("Vacanza yields no tasks (no private modules on shared branch)", () => {
    // The owner branch could register a private module
    // contributing 1 LIGHT task in Vacanza. On the shared branch
    // no private module is registered, so Vacanza generates 0
    // tasks regardless of activeModules content.
    expect(generateTasksFor("Vacanza", []).length).toBe(0);
    expect(generateTasksFor("Vacanza", ["chameleon_os"]).length).toBe(0);
  });
});

describe("isDayKept", () => {
  it("treats a day with no LIGHT tasks as kept (frozen)", () => {
    expect(isDayKept([])).toBe(true);
    expect(isDayKept([{ weight: "HEAVY", completed: false }])).toBe(true);
  });

  it("requires the streak threshold of LIGHT completion", () => {
    const fourOfFive = [
      { weight: "LIGHT" as const, completed: true },
      { weight: "LIGHT" as const, completed: true },
      { weight: "LIGHT" as const, completed: true },
      { weight: "LIGHT" as const, completed: true },
      { weight: "LIGHT" as const, completed: false },
    ];
    expect(isDayKept(fourOfFive)).toBe(0.8 >= STREAK_THRESHOLD);
  });

  it("breaks below threshold", () => {
    const halfLight = [
      { weight: "LIGHT" as const, completed: true },
      { weight: "LIGHT" as const, completed: false },
    ];
    expect(isDayKept(halfLight)).toBe(false);
  });
});

describe("applyAdaptiveLoad", () => {
  const tasks = [
    { module: "chameleon_os", title: "deep", weight: "HEAVY" as const },
    { module: "gym", title: "session", weight: "MEDIUM" as const },
    { module: "studio", title: "listings", weight: "MEDIUM" as const },
    { module: "health", title: "stack", weight: "LIGHT" as const },
    { module: "finance", title: "log", weight: "LIGHT" as const },
  ];

  it("is a no-op below the threshold (4 underDays)", () => {
    expect(applyAdaptiveLoad(tasks, 4)).toEqual(tasks);
  });

  it("trims HEAVY to ≤1 and halves MEDIUM at 5+ underDays", () => {
    const out = applyAdaptiveLoad(tasks, 5);
    expect(out.filter((t) => t.weight === "HEAVY").length).toBeLessThanOrEqual(1);
    expect(out.filter((t) => t.weight === "MEDIUM").length).toBeLessThanOrEqual(1);
    expect(out.filter((t) => t.weight === "LIGHT").length).toBe(2);
  });

  it("preserves all LIGHT tasks (the chain)", () => {
    const out = applyAdaptiveLoad(tasks, 7);
    expect(out.filter((t) => t.weight === "LIGHT").length).toBe(2);
  });
});

describe("timezone helpers", () => {
  it("todayInTimezone returns YYYY-MM-DD", () => {
    const today = todayInTimezone("Europe/Rome");
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("yesterdayInTimezone is exactly one day before today (most days)", () => {
    const today = todayInTimezone("Europe/Rome");
    const yesterday = yesterdayInTimezone("Europe/Rome");
    expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(today).getTime() - new Date(yesterday).getTime()).toBeGreaterThan(0);
  });
});

describe("applyInPresenceLoad", () => {
  const tasks = [
    { module: "studio", title: "Deep block (2h)", weight: "HEAVY" as const },
    { module: "chameleon_os", title: "Sviluppo (deep block)", weight: "HEAVY" as const },
    { module: "gym", title: "Sessione gym (1h)", weight: "MEDIUM" as const },
    { module: "studio", title: "Listings (45 min)", weight: "MEDIUM" as const },
    { module: "chameleon_os", title: "Operational (1h)", weight: "MEDIUM" as const },
    { module: "health", title: "Daily stack", weight: "LIGHT" as const },
    { module: "finance", title: "Tracciare spese", weight: "LIGHT" as const },
  ];

  it("returns tasks unchanged when not in-presence", () => {
    const out = applyInPresenceLoad(tasks, false);
    expect(out).toEqual(tasks);
  });

  it("keeps at most 1 HEAVY when in-presence", () => {
    const out = applyInPresenceLoad(tasks, true);
    expect(out.filter((t) => t.weight === "HEAVY").length).toBe(1);
  });

  it("halves the MEDIUM count (rounding up) when in-presence", () => {
    const out = applyInPresenceLoad(tasks, true);
    // 3 mediums → ceil(3/2) = 2 kept
    expect(out.filter((t) => t.weight === "MEDIUM").length).toBe(2);
  });

  it("preserves all LIGHT tasks (the chain)", () => {
    const out = applyInPresenceLoad(tasks, true);
    expect(out.filter((t) => t.weight === "LIGHT").length).toBe(2);
  });

  it("keeps the FIRST HEAVY (deterministic — preserves input order)", () => {
    const out = applyInPresenceLoad(tasks, true);
    const heavies = out.filter((t) => t.weight === "HEAVY");
    expect(heavies[0].title).toBe("Deep block (2h)");
  });

  it("handles a task list with no HEAVY/MEDIUM gracefully", () => {
    const lightOnly = [
      { module: "health", title: "Acqua", weight: "LIGHT" as const },
    ];
    expect(applyInPresenceLoad(lightOnly, true)).toEqual(lightOnly);
  });

  it("returns empty array when input is empty", () => {
    expect(applyInPresenceLoad([], true)).toEqual([]);
    expect(applyInPresenceLoad([], false)).toEqual([]);
  });
});
