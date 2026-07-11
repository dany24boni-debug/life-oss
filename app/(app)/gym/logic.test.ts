import { describe, expect, it } from "vitest";
import type { GymSet } from "@/data/schemas";
import {
  computePRs,
  exerciseTrend,
  formatKg,
  formatRestS,
  newRecords,
  restRemainingS,
  sessionDurationMin,
  sparklinePath,
  stepReps,
  stepWeight,
  totalVolumeKg,
} from "./logic";

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

describe("volume e PR", () => {
  it("il volume somma peso × reps; corpo libero pesa 0", () => {
    const sets = [
      set({ weight_kg: 60, reps: 8 }),
      set({ weight_kg: 80, reps: 5 }),
      set({ weight_kg: null, reps: 12 }),
    ];
    expect(totalVolumeKg(sets)).toBe(60 * 8 + 80 * 5);
  });

  it("computePRs: peso, reps, volume di sessione, 1RM Brzycki", () => {
    const prs = computePRs([
      set({ weight_kg: 60, reps: 8, session_id: "s1" }),
      set({ weight_kg: 80, reps: 3, session_id: "s1" }),
      set({ weight_kg: 70, reps: 10, session_id: "s2" }),
      set({ weight_kg: null, reps: 15, session_id: "s2" }),
    ]);
    expect(prs.maxWeightKg).toBe(80);
    expect(prs.maxReps).toBe(15);
    // s1: 60*8+80*3 = 720; s2: 70*10 = 700.
    expect(prs.maxSessionVolumeKg).toBe(720);
    // Brzycki 70×10: 70 * 36/27 ≈ 93.3 — batte 80×3 (~84.7) e 60×8 (~74.5).
    expect(prs.best1RmKg).toBeCloseTo(70 * (36 / 27), 5);
  });

  it("senza set: tutti i PR sono null", () => {
    expect(computePRs([])).toEqual({
      maxWeightKg: null,
      maxReps: null,
      maxSessionVolumeKg: null,
      best1RmKg: null,
    });
  });

  it("sessione TUTTA a corpo libero: volume 0, PR di peso/1RM null, MAI NaN", () => {
    // Il contratto run-07: i set senza peso sono prima classe (bodyweight)
    // e la matematica li salta senza mai produrre NaN.
    const sets = [
      set({ weight_kg: null, reps: 10, session_id: "s1" }),
      set({ weight_kg: null, reps: 8, session_id: "s1" }),
    ];
    expect(totalVolumeKg(sets)).toBe(0);
    expect(Number.isNaN(totalVolumeKg(sets))).toBe(false);
    const prs = computePRs(sets);
    expect(prs).toEqual({
      maxWeightKg: null,
      maxReps: 10,
      maxSessionVolumeKg: null, // un volume 0 non è un PR
      best1RmKg: null,
    });
    for (const v of Object.values(prs)) {
      expect(v === null || Number.isFinite(v)).toBe(true);
    }
  });

  it("newRecords su storie a corpo libero: solo reps, niente NaN", () => {
    const prior = [set({ weight_kg: null, reps: 8, session_id: "vecchia" })];
    const current = [set({ weight_kg: null, reps: 10, session_id: "nuova" })];
    const records = newRecords(current, prior);
    expect(records).toEqual([
      {
        exercise_id: "01980000-0000-7000-8000-0000000000ee",
        kind: "ripetizioni",
        value: 10,
      },
    ]);
    for (const r of records) expect(Number.isFinite(r.value)).toBe(true);
  });
});

describe("newRecords — record battuti nella sessione", () => {
  const EX = "01980000-0000-7000-8000-0000000000ee";
  it("batte il passato → record; la prima sessione non è mai record", () => {
    const prior = [
      set({ weight_kg: 80, reps: 5, session_id: "vecchia" }),
      set({ weight_kg: 70, reps: 10, session_id: "vecchia" }),
    ];
    const current = [
      set({ weight_kg: 85, reps: 3, session_id: "nuova" }),
      set({ weight_kg: 70, reps: 8, session_id: "nuova" }),
    ];
    const records = newRecords(current, prior);
    expect(records).toContainEqual({ exercise_id: EX, kind: "peso", value: 85 });
    // Reps 8 < 10 e volume 815 < 1100: niente altri record.
    expect(records).toHaveLength(1);

    expect(newRecords(current, [])).toHaveLength(0); // nessun passato
  });

  it("eguagliare non basta: serve batterlo strettamente", () => {
    const prior = [set({ weight_kg: 80, reps: 5, session_id: "vecchia" })];
    const current = [set({ weight_kg: 80, reps: 5, session_id: "nuova" })];
    expect(newRecords(current, prior)).toHaveLength(0);
  });
});

describe("timer di recupero — matematica wake-safe", () => {
  it("il rimanente deriva dagli istanti, non da un contatore", () => {
    const start = Date.parse("2026-07-10T10:00:00.000Z");
    expect(restRemainingS(start, 90, start)).toBe(90);
    expect(restRemainingS(start, 90, start + 30_000)).toBe(60);
    // Schermo spento per 2 minuti: al risveglio il tempo è passato davvero.
    expect(restRemainingS(start, 90, start + 120_000)).toBe(0);
  });

  it("formato m:ss", () => {
    expect(formatRestS(92)).toBe("1:32");
    expect(formatRestS(5)).toBe("0:05");
    expect(formatRestS(0)).toBe("0:00");
  });
});

describe("durata e formati", () => {
  it("durata in minuti tra inizio e fine; null senza estremi", () => {
    expect(
      sessionDurationMin(
        "2026-07-10T10:00:00.000Z",
        "2026-07-10T11:12:00.000Z",
      ),
    ).toBe(72);
    expect(sessionDurationMin(null, "2026-07-10T11:00:00.000Z")).toBeNull();
    expect(sessionDurationMin("2026-07-10T10:00:00.000Z", null)).toBeNull();
  });

  it("kg in formato italiano (B4)", () => {
    expect(formatKg(1250)).toBe("1.250 kg");
    expect(formatKg(62.5)).toBe("62,5 kg");
  });
});

describe("trend e sparkline", () => {
  it("miglior carico per giorno, ordinato", () => {
    const days = new Map([
      ["s1", "2026-07-01"],
      ["s2", "2026-07-08"],
    ]);
    const trend = exerciseTrend(
      [
        set({ session_id: "s2", weight_kg: 70 }),
        set({ session_id: "s1", weight_kg: 60 }),
        set({ session_id: "s1", weight_kg: 65 }),
        set({ session_id: "s1", weight_kg: null, reps: 12 }),
      ],
      days,
    );
    expect(trend).toEqual([
      { day: "2026-07-01", topWeightKg: 65 },
      { day: "2026-07-08", topWeightKg: 70 },
    ]);
  });

  it("sparklinePath: scala tra min e max; piatto = linea a metà", () => {
    const path = sparklinePath(
      [
        { day: "a", topWeightKg: 60 },
        { day: "b", topWeightKg: 80 },
      ],
      100,
      40,
    );
    expect(path).toBe("2,38 98,2");
    expect(
      sparklinePath([{ day: "a", topWeightKg: 60 }], 100, 40),
    ).toBe("50,20");
    expect(sparklinePath([], 100, 40)).toBe("");
  });
});

describe("stepper", () => {
  it("peso: ±2.5 kg, mai negativo, corpo libero parte da 0", () => {
    expect(stepWeight(60, 1)).toBe(62.5);
    expect(stepWeight(60, -1)).toBe(57.5);
    expect(stepWeight(null, 1)).toBe(2.5);
    expect(stepWeight(1, -1)).toBe(0);
  });

  it("reps: ±1, mai sotto 1", () => {
    expect(stepReps(8, 1)).toBe(9);
    expect(stepReps(1, -1)).toBe(1);
  });
});
