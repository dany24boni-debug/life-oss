import { describe, expect, it } from "vitest";
import {
  AddGymSessionSchema,
  GymSessionIdSchema,
  MuscleGroupsArraySchema,
  MuscleGroupSchema,
  MUSCLE_GROUPS,
  UpdateGymSessionSchema,
} from "./gym";

// ============================================================
// MuscleGroupSchema — the closed enum
// ============================================================

describe("MuscleGroupSchema", () => {
  it("accepts every value in MUSCLE_GROUPS", () => {
    for (const g of MUSCLE_GROUPS) {
      expect(MuscleGroupSchema.safeParse(g).success).toBe(true);
    }
  });

  it("rejects unknown muscle groups", () => {
    expect(MuscleGroupSchema.safeParse("polpacci").success).toBe(false);
    expect(MuscleGroupSchema.safeParse("").success).toBe(false);
    expect(MuscleGroupSchema.safeParse("PETTO").success).toBe(false); // case-sensitive
  });

  it("rejects non-strings", () => {
    expect(MuscleGroupSchema.safeParse(42).success).toBe(false);
    expect(MuscleGroupSchema.safeParse(null).success).toBe(false);
    expect(MuscleGroupSchema.safeParse(undefined).success).toBe(false);
  });
});

// ============================================================
// MuscleGroupsArraySchema — the preprocessing layer
// ============================================================

describe("MuscleGroupsArraySchema", () => {
  it("accepts a single-value string (degenerate chip submit)", () => {
    const r = MuscleGroupsArraySchema.safeParse("petto");
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto"]);
  });

  it("accepts a multi-value array (normal chip submit)", () => {
    const r = MuscleGroupsArraySchema.safeParse(["petto", "spalle", "braccia"]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto", "spalle", "braccia"]);
  });

  it("dedupes duplicate entries (preserves first occurrence)", () => {
    const r = MuscleGroupsArraySchema.safeParse([
      "petto",
      "spalle",
      "petto",
      "braccia",
      "spalle",
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto", "spalle", "braccia"]);
  });

  it("trims surrounding whitespace before checking enum", () => {
    const r = MuscleGroupsArraySchema.safeParse(["  petto  ", "spalle"]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto", "spalle"]);
  });

  it("drops empty / whitespace-only entries", () => {
    const r = MuscleGroupsArraySchema.safeParse(["petto", "", "  ", "spalle"]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto", "spalle"]);
  });

  it("rejects an empty array (min 1)", () => {
    const r = MuscleGroupsArraySchema.safeParse([]);
    expect(r.success).toBe(false);
  });

  it("rejects a missing / undefined value (resolves to [])", () => {
    const r = MuscleGroupsArraySchema.safeParse(undefined);
    expect(r.success).toBe(false);
  });

  it("rejects an empty string (resolves to [])", () => {
    const r = MuscleGroupsArraySchema.safeParse("");
    expect(r.success).toBe(false);
  });

  it("rejects an array containing an unknown group", () => {
    const r = MuscleGroupsArraySchema.safeParse(["petto", "polpacci"]);
    expect(r.success).toBe(false);
  });

  it("accepts the full 7-element max", () => {
    const r = MuscleGroupsArraySchema.safeParse([...MUSCLE_GROUPS]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.length).toBe(7);
  });

  it("rejects more than 7 distinct entries (impossible after dedupe but defensive)", () => {
    // Same group repeated would dedupe to 1. To trip the max we'd
    // need 8 distinct, which can't exist in MUSCLE_GROUPS. The enum
    // check fires first. Still: assert the schema fails for an
    // unknown 8th entry that survives the enum.
    const r = MuscleGroupsArraySchema.safeParse([
      ...MUSCLE_GROUPS,
      "extra",
    ]);
    expect(r.success).toBe(false);
  });

  it("drops non-string entries silently before enum check", () => {
    const r = MuscleGroupsArraySchema.safeParse([
      "petto",
      42,
      null,
      "spalle",
    ]);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual(["petto", "spalle"]);
  });
});

// ============================================================
// AddGymSessionSchema — the full server-action input
// ============================================================

describe("AddGymSessionSchema", () => {
  it("happy path: well-formed FormData object", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["petto", "spalle"],
      duration_minutes: "75", // coerced from string (FormData semantics)
      notes: "panca + spinte",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toEqual({
        session_date: "2026-05-14",
        muscle_groups: ["petto", "spalle"],
        duration_minutes: 75,
        notes: "panca + spinte",
      });
    }
  });

  it("accepts empty notes as null (trimmedOptional)", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "30",
      notes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBeNull();
  });

  it("accepts missing notes (omitted from FormData)", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "30",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a malformed date", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "14-05-2026",
      muscle_groups: ["cardio"],
      duration_minutes: "30",
    });
    expect(r.success).toBe(false);
  });

  it("rejects calendar-impossible dates (z.iso.date semantic check)", () => {
    // ECC mid-sprint U1 MEDIUM M2: DateYmdSchema now uses
    // z.iso.date() which validates the calendar, not just the
    // regex shape. February 30 / month 13 / day 99 are caught
    // at the schema layer instead of failing at the DB.
    const cases = ["2026-02-30", "2026-13-01", "2026-04-31"];
    for (const session_date of cases) {
      const r = AddGymSessionSchema.safeParse({
        session_date,
        muscle_groups: ["cardio"],
        duration_minutes: "30",
      });
      expect(r.success, `expected ${session_date} to be rejected`).toBe(false);
    }
  });

  it("rejects duration_minutes below 5", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "4",
    });
    expect(r.success).toBe(false);
  });

  it("rejects duration_minutes above 300", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "301",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-numeric duration_minutes", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "lots",
    });
    expect(r.success).toBe(false);
  });

  it("rejects a session with empty muscle_groups", () => {
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: [],
      duration_minutes: "60",
    });
    expect(r.success).toBe(false);
  });

  it("caps notes at 280 chars via trim helper", () => {
    const longNote = "a".repeat(500);
    const r = AddGymSessionSchema.safeParse({
      session_date: "2026-05-14",
      muscle_groups: ["cardio"],
      duration_minutes: "30",
      notes: longNote,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes?.length).toBe(280);
  });
});

// ============================================================
// UpdateGymSessionSchema + GymSessionIdSchema
// ============================================================

describe("UpdateGymSessionSchema", () => {
  it("happy path with valid UUID + all fields", () => {
    const r = UpdateGymSessionSchema.safeParse({
      id: "00000000-0000-0000-0000-000000000001",
      session_date: "2026-05-14",
      muscle_groups: ["gambe"],
      duration_minutes: "90",
      notes: "squat focus",
    });
    expect(r.success).toBe(true);
  });

  it("rejects malformed UUID", () => {
    const r = UpdateGymSessionSchema.safeParse({
      id: "not-a-uuid",
      session_date: "2026-05-14",
      muscle_groups: ["gambe"],
      duration_minutes: "90",
    });
    expect(r.success).toBe(false);
  });
});

describe("GymSessionIdSchema", () => {
  it("accepts valid UUID", () => {
    expect(
      GymSessionIdSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
      }).success,
    ).toBe(true);
  });

  it("rejects missing id", () => {
    expect(GymSessionIdSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty string id", () => {
    expect(GymSessionIdSchema.safeParse({ id: "" }).success).toBe(false);
  });
});
