import { describe, expect, it } from "vitest";
import { GYM_SEED } from "@/data/gym-seed";
import {
  buildImportPlan,
  deriveId,
  normalizeExerciseName,
  type LegacySessionRow,
  type LegacyWorkoutRow,
} from "./importer";

const legacySession: LegacySessionRow = {
  id: "aaaa1111-0000-4000-8000-000000000001",
  session_date: "2026-05-02",
  muscle_groups: ["petto", "spalle"],
  duration_minutes: 55,
  notes: "Buona spinta",
  created_at: "2026-05-02T18:00:00+00:00",
};

const workoutPanca: LegacyWorkoutRow = {
  id: "bbbb2222-0000-4000-8000-000000000001",
  date: "2026-04-10",
  exercise: "Panca  Piana con bilanciere",
  sets: 3,
  reps: 8,
  weight_kg: 60,
  notes: null,
  created_at: "2026-04-10T17:00:00+00:00",
};

const workoutStrano: LegacyWorkoutRow = {
  id: "bbbb2222-0000-4000-8000-000000000002",
  date: "2026-04-10",
  exercise: "Macchina misteriosa",
  sets: 2,
  reps: 12,
  weight_kg: 35,
  notes: null,
  created_at: "2026-04-10T17:10:00+00:00",
};

describe("deriveId — UUID deterministico", () => {
  it("stessa chiave, stesso id; chiavi diverse, id diversi; formato uuid", async () => {
    const a1 = await deriveId("prova:1");
    const a2 = await deriveId("prova:1");
    const b = await deriveId("prova:2");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("golden: output esatto per una chiave nota (contratto di idempotenza)", async () => {
    // Valore FISSATO byte per byte. `deriveId` è un alias della deriveUuidV8
    // unica (data/ids.ts): lo stesso valore è fissato nel golden test di
    // data/ids.test.ts. Se questo assert fallisce, l'idempotenza di TUTTI e
    // quattro gli importer (gym, calendar, spese, esami) è rotta.
    expect(
      await deriveId(
        "lifeos-import:gym_sessions:aaaa1111-0000-4000-8000-000000000001",
      ),
    ).toBe("91a203fa-12a1-8068-90be-8ea08215136a");
  });
});

describe("normalizeExerciseName", () => {
  it("minuscole, accenti via, spazi compattati", () => {
    expect(normalizeExerciseName("  Panca  PIÀNA ")).toBe("panca piana");
    expect(normalizeExerciseName("Curl a martello")).toBe("curl a martello");
  });
});

describe("buildImportPlan", () => {
  it("gym_sessions → sessione semplice: gruppi e durata nelle note, zero set", async () => {
    const plan = await buildImportPlan({
      legacySessions: [legacySession],
      legacyWorkouts: [],
    });
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sets).toHaveLength(0);
    expect(plan.exercises).toHaveLength(0);
    const s = plan.sessions[0];
    expect(s.date).toBe("2026-05-02");
    expect(s.notes).toBe("petto, spalle · 55 min\nBuona spinta");
    // Timestamp deterministici dal created_at legacy, in forma Z.
    expect(s.created_at).toBe("2026-05-02T18:00:00.000Z");
    expect(s.updated_at).toBe(s.created_at);
  });

  it("gym_workouts → una sessione per giorno, righe espanse in N set", async () => {
    const plan = await buildImportPlan({
      legacySessions: [],
      legacyWorkouts: [workoutPanca, workoutStrano],
    });
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0].date).toBe("2026-04-10");
    // 3 set di panca + 2 della macchina sconosciuta.
    expect(plan.sets).toHaveLength(5);

    // La panca matcha il catalogo seminato (nome normalizzato).
    const panca = GYM_SEED.find(
      (e) => e.name === "Panca piana con bilanciere",
    )!;
    const setPanca = plan.sets.filter((s) => s.exercise_id === panca.id);
    expect(setPanca).toHaveLength(3);
    expect(setPanca.map((s) => s.set_number)).toEqual([1, 2, 3]);
    expect(setPanca[0].weight_kg).toBe(60);
    expect(setPanca[0].reps).toBe(8);

    // La macchina sconosciuta diventa UN custom (gruppo "altro").
    expect(plan.exercises).toHaveLength(1);
    expect(plan.exercises[0].is_custom).toBe(true);
    expect(plan.exercises[0].muscle_group).toBe("altro");
    const setCustom = plan.sets.filter(
      (s) => s.exercise_id === plan.exercises[0].id,
    );
    expect(setCustom).toHaveLength(2);
  });

  it("è deterministico: due esecuzioni producono righe identiche", async () => {
    const input = {
      legacySessions: [legacySession],
      legacyWorkouts: [workoutPanca, workoutStrano],
    };
    const a = await buildImportPlan(input);
    const b = await buildImportPlan(input);
    expect(a).toEqual(b);
  });

  it("lo stesso esercizio ripetuto nel giorno continua la numerazione", async () => {
    const secondaPanca: LegacyWorkoutRow = {
      ...workoutPanca,
      id: "bbbb2222-0000-4000-8000-000000000003",
      sets: 2,
      reps: 6,
      weight_kg: 70,
    };
    const plan = await buildImportPlan({
      legacySessions: [],
      legacyWorkouts: [workoutPanca, secondaPanca],
    });
    const panca = GYM_SEED.find(
      (e) => e.name === "Panca piana con bilanciere",
    )!;
    const nums = plan.sets
      .filter((s) => s.exercise_id === panca.id)
      .map((s) => s.set_number);
    expect(nums).toEqual([1, 2, 3, 4, 5]);
  });

  it("valori fuori scala vengono domati (sets cap 20, pesi nulli → corpo libero)", async () => {
    const plan = await buildImportPlan({
      legacySessions: [],
      legacyWorkouts: [
        { ...workoutPanca, sets: 500, weight_kg: 0 },
      ],
    });
    expect(plan.sets).toHaveLength(20);
    expect(plan.sets[0].weight_kg).toBeNull();
  });
});
