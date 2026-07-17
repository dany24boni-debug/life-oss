import { describe, expect, it } from "vitest";
import type { GymSet } from "@/data/schemas";
import { weightPrCheck, weightPrSetIds } from "./pr";

const AUDIT = {
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  deleted_at: null,
};

let n = 0;
function set(over: Partial<GymSet>): GymSet {
  n += 1;
  return {
    id: `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    session_id: "01980000-0000-7000-8000-0000000000aa",
    exercise_id: "01980000-0000-7000-8000-0000000000ee",
    set_number: 1,
    weight_kg: 60,
    reps: 8,
    rir_done: null,
    rest_actual_s: null,
    feeling_1_10: null,
    done_at: null,
    ...AUDIT,
    ...over,
  };
}

describe("il momento PR (run-12)", () => {
  it("weightPrCheck: batte strettamente il massimo storico", () => {
    const prior = [
      set({ weight_kg: 80, reps: 5 }),
      set({ weight_kg: 75, reps: 8 }),
    ];
    expect(weightPrCheck(82.5, prior)).toEqual({
      isPr: true,
      previousKg: 80,
    });
    expect(weightPrCheck(80, prior)).toEqual({ isPr: false, previousKg: 80 });
    expect(weightPrCheck(60, prior)).toEqual({ isPr: false, previousKg: 80 });
  });

  it("weightPrCheck: senza passato (o passato a corpo libero) mai PR", () => {
    expect(weightPrCheck(100, [])).toEqual({ isPr: false, previousKg: null });
    expect(weightPrCheck(100, [set({ weight_kg: null, reps: 12 })])).toEqual({
      isPr: false,
      previousKg: null,
    });
    expect(weightPrCheck(null, [set({ weight_kg: 80 })])).toEqual({
      isPr: false,
      previousKg: 80,
    });
  });

  it("weightPrSetIds: marca i set che ERANO record quando furono fatti", () => {
    const a = set({ weight_kg: 60, done_at: "2026-06-01T10:00:00.000Z" });
    const b = set({ weight_kg: 70, done_at: "2026-06-08T10:00:00.000Z" });
    const c = set({ weight_kg: 70, done_at: "2026-06-15T10:00:00.000Z" });
    const d = set({
      weight_kg: null,
      reps: 12,
      done_at: "2026-06-20T10:00:00.000Z",
    });
    const e = set({ weight_kg: 72.5, done_at: "2026-06-22T10:00:00.000Z" });
    // Input mescolato: l'ordine lo rimette la funzione (done_at, poi id).
    const ids = weightPrSetIds([e, c, a, d, b]);
    // Il primo set non è mai PR; il pareggio (c) no; il corpo libero no.
    expect(ids).toEqual(new Set([b.id, e.id]));
  });

  it("weightPrSetIds: done_at null (import legacy) va in testa, tiebreak per id", () => {
    const legacy = set({ weight_kg: 100, done_at: null });
    const dopo = set({ weight_kg: 90, done_at: "2026-06-01T10:00:00.000Z" });
    const record = set({
      weight_kg: 102.5,
      done_at: "2026-06-08T10:00:00.000Z",
    });
    expect(weightPrSetIds([dopo, record, legacy])).toEqual(
      new Set([record.id]),
    );
  });
});
