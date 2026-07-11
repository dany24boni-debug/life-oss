import { describe, expect, it } from "vitest";
import {
  EventCreateSchema,
  GymProgramSlotSchema,
  GymSessionSchema,
  GymSetSchema,
  HhmmSchema,
  IsoDaySchema,
  ProgramSlotCreateSchema,
  ProgramSlotPatchSchema,
  SettingsSchema,
  TaskCreateSchema,
  TaskPatchSchema,
  TaskSchema,
} from "./schemas";
import { uuidv7 } from "./ids";

describe("primitive", () => {
  it("IsoDaySchema accetta YYYY-MM-DD e rifiuta altri formati", () => {
    expect(IsoDaySchema.safeParse("2026-07-10").success).toBe(true);
    expect(IsoDaySchema.safeParse("10/07/2026").success).toBe(false);
    expect(IsoDaySchema.safeParse("2026-7-1").success).toBe(false);
    expect(IsoDaySchema.safeParse("2026-13-01").success).toBe(false);
  });

  it("HhmmSchema accetta 24h HH:MM e rifiuta il resto", () => {
    expect(HhmmSchema.safeParse("00:00").success).toBe(true);
    expect(HhmmSchema.safeParse("23:59").success).toBe(true);
    expect(HhmmSchema.safeParse("24:00").success).toBe(false);
    expect(HhmmSchema.safeParse("7:30").success).toBe(false);
    expect(HhmmSchema.safeParse("18.30").success).toBe(false);
  });
});

describe("Task", () => {
  it("accetta una riga completa valida", () => {
    const now = new Date().toISOString();
    const row = {
      id: uuidv7(),
      title: "Comprare il latte",
      notes: null,
      date: "2026-07-10",
      time: "18:30",
      priority: 2 as const,
      tags: ["spesa"],
      module_link: null,
      status: "open" as const,
      completed_at: null,
      sort_order: 0,
      subtasks: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(TaskSchema.safeParse(row).success).toBe(true);
  });

  it("create: richiede solo il titolo, trim incluso", () => {
    const parsed = TaskCreateSchema.safeParse({ title: "  Studiare  " });
    expect(parsed.success && parsed.data.title).toBe("Studiare");
    expect(TaskCreateSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(TaskCreateSchema.safeParse({}).success).toBe(false);
  });

  it("create: rifiuta priorità fuori da 1..3 e orari non validi", () => {
    expect(
      TaskCreateSchema.safeParse({ title: "x", priority: 4 }).success,
    ).toBe(false);
    expect(
      TaskCreateSchema.safeParse({ title: "x", time: "25:00" }).success,
    ).toBe(false);
  });

  it("patch: oggetto vuoto è valido (nessuna modifica)", () => {
    expect(TaskPatchSchema.safeParse({}).success).toBe(true);
  });
});

describe("Programmi gym (run-07)", () => {
  const now = "2026-07-11T10:00:00.000Z";
  const baseSlot = {
    id: uuidv7(),
    day_id: uuidv7(),
    exercise_id: uuidv7(),
    section: "FORZA",
    variant: null,
    target_sets: 4,
    rest_seconds: 270,
    bodyweight: false,
    notes: null,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  it("le prescrizioni sono TESTO come sul foglio: '3–5', '1–2', '2/1/0'", () => {
    for (const rir of ["1", "1–2", "2/1/0"]) {
      expect(
        GymProgramSlotSchema.safeParse({
          ...baseSlot,
          target_reps: "3–5",
          target_rir: rir,
        }).success,
      ).toBe(true);
    }
    // Vuoto no; troppo lungo no; null (non registrato) sì.
    expect(
      GymProgramSlotSchema.safeParse({
        ...baseSlot,
        target_reps: "  ",
        target_rir: null,
      }).success,
    ).toBe(false);
    expect(
      GymProgramSlotSchema.safeParse({
        ...baseSlot,
        target_reps: null,
        target_rir: "x".repeat(21),
      }).success,
    ).toBe(false);
    expect(
      GymProgramSlotSchema.safeParse({
        ...baseSlot,
        target_reps: null,
        target_rir: null,
      }).success,
    ).toBe(true);
  });

  it("target_sets nel dominio del foglio (1..10)", () => {
    const create = { day_id: baseSlot.day_id, exercise_id: baseSlot.exercise_id };
    expect(
      ProgramSlotCreateSchema.safeParse({ ...create, target_sets: 0 }).success,
    ).toBe(false);
    expect(
      ProgramSlotCreateSchema.safeParse({ ...create, target_sets: 11 }).success,
    ).toBe(false);
    expect(
      ProgramSlotCreateSchema.safeParse({ ...create, target_sets: 10 }).success,
    ).toBe(true);
  });

  it("patch slot: oggetto vuoto valido; day_id non patchabile", () => {
    expect(ProgramSlotPatchSchema.safeParse({}).success).toBe(true);
    const r = ProgramSlotPatchSchema.safeParse({ day_id: uuidv7() });
    // Chiave sconosciuta al patch: viene semplicemente strippata.
    expect(r.success && "day_id" in r.data).toBe(false);
  });

  it("righe sessione/set di forma PRE run-07 passano il parse coi default", () => {
    // È il contratto che tiene importabili i backup vecchi e leggibili i
    // push dei client non aggiornati: chiavi assenti → null, mai scarto.
    const session = GymSessionSchema.safeParse({
      id: uuidv7(),
      date: "2026-07-01",
      plan_id: null,
      started_at: null,
      finished_at: null,
      notes: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    expect(session.success && session.data.program_day_id).toBeNull();
    expect(session.success && session.data.rating_1_10).toBeNull();

    const set = GymSetSchema.safeParse({
      id: uuidv7(),
      session_id: uuidv7(),
      exercise_id: uuidv7(),
      set_number: 1,
      weight_kg: null,
      reps: 12,
      done_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    expect(set.success && set.data.rir_done).toBeNull();
    expect(set.success && set.data.rest_actual_s).toBeNull();
    expect(set.success && set.data.feeling_1_10).toBeNull();
  });

  it("domini del foglio: RIR fatto 0..5, feeling e voto 1..10", () => {
    const base = {
      id: uuidv7(),
      session_id: uuidv7(),
      exercise_id: uuidv7(),
      set_number: 1,
      weight_kg: 60,
      reps: 8,
      done_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(
      GymSetSchema.safeParse({ ...base, rir_done: 5, feeling_1_10: 10 })
        .success,
    ).toBe(true);
    expect(GymSetSchema.safeParse({ ...base, rir_done: 6 }).success).toBe(
      false,
    );
    expect(
      GymSetSchema.safeParse({ ...base, feeling_1_10: 0 }).success,
    ).toBe(false);
  });
});

describe("Eventi e Settings", () => {
  it("evento: titolo e data obbligatori", () => {
    expect(
      EventCreateSchema.safeParse({ title: "Cena", date: "2026-07-12" })
        .success,
    ).toBe(true);
    expect(EventCreateSchema.safeParse({ title: "Cena" }).success).toBe(false);
  });

  it("settings: id fisso 'local' e tema chiuso", () => {
    const now = new Date().toISOString();
    const base = {
      display_name: null,
      protected_days: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(
      SettingsSchema.safeParse({ ...base, id: "local", theme: "dark" }).success,
    ).toBe(true);
    expect(
      SettingsSchema.safeParse({ ...base, id: "other", theme: "dark" })
        .success,
    ).toBe(false);
    expect(
      SettingsSchema.safeParse({ ...base, id: "local", theme: "sepia" })
        .success,
    ).toBe(false);
  });

  it("settings pre run-07 (senza profilo): parse coi default, mai scarto", () => {
    const now = new Date().toISOString();
    const parsed = SettingsSchema.safeParse({
      id: "local",
      display_name: null,
      theme: "dark",
      protected_days: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
    });
    expect(parsed.success && parsed.data.height_cm).toBeNull();
    expect(parsed.success && parsed.data.sex).toBeNull();
    expect(parsed.success && parsed.data.birth_year).toBeNull();
    expect(parsed.success && parsed.data.activity_level).toBeNull();
    // I domini del profilo restano chiusi.
    expect(
      SettingsSchema.safeParse({
        id: "local",
        display_name: null,
        theme: "dark",
        protected_days: [],
        height_cm: 90,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }).success,
    ).toBe(false);
  });
});
