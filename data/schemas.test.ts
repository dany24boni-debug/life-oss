import { describe, expect, it } from "vitest";
import {
  DietExtraCreateSchema,
  EventCreateSchema,
  FocusSessionSchema,
  FoodSchema,
  GymProgramSlotSchema,
  MealItemPatchSchema,
  MealItemSchema,
  MealLogSchema,
  GymSessionSchema,
  GymSetSchema,
  HabitCreateSchema,
  HabitLogSchema,
  HabitSchema,
  HhmmSchema,
  IsoDaySchema,
  IsoWeekSchema,
  PlanSlotPatchSchema,
  RecurrenceSchema,
  PlanSlotSchema,
  ProgramSlotCreateSchema,
  ProgramSlotPatchSchema,
  SettingsSchema,
  SlotCheckSchema,
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

describe("abitudini (run-08)", () => {
  const now = "2026-07-12T08:00:00.000Z";
  const base = {
    id: uuidv7(),
    name: "Acqua",
    icon: "goccia",
    kind: "quantity",
    unit: "ml",
    daily_target: 2000,
    weekdays: null,
    sort_order: 0,
    archived_at: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  it("HabitSchema: domini chiusi su kind, weekdays e obiettivo", () => {
    expect(HabitSchema.safeParse(base).success).toBe(true);
    expect(
      HabitSchema.safeParse({ ...base, kind: "timer" }).success,
    ).toBe(false);
    expect(
      HabitSchema.safeParse({ ...base, weekdays: [0] }).success,
    ).toBe(false);
    expect(
      HabitSchema.safeParse({ ...base, weekdays: [] }).success,
    ).toBe(false);
    expect(
      HabitSchema.safeParse({ ...base, daily_target: 0 }).success,
    ).toBe(false);
  });

  it("HabitCreateSchema richiede nome e specie; kind fuori dal patch", () => {
    expect(
      HabitCreateSchema.safeParse({ name: "Lettura", kind: "counter" }).success,
    ).toBe(true);
    expect(HabitCreateSchema.safeParse({ name: "Lettura" }).success).toBe(
      false,
    );
  });

  it("HabitLogSchema: valore 0..1M, mai negativo", () => {
    const log = {
      id: uuidv7(),
      habit_id: base.id,
      date: "2026-07-12",
      value: 830,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(HabitLogSchema.safeParse(log).success).toBe(true);
    expect(HabitLogSchema.safeParse({ ...log, value: -1 }).success).toBe(false);
    expect(HabitLogSchema.safeParse({ ...log, value: 0 }).success).toBe(true);
  });
});

describe("planner settimanale (run-08 P3)", () => {
  const now = "2026-07-12T08:00:00.000Z";

  it("IsoWeekSchema: regex chiusa 01..53", () => {
    expect(IsoWeekSchema.safeParse("2026-W28").success).toBe(true);
    expect(IsoWeekSchema.safeParse("2026-W01").success).toBe(true);
    expect(IsoWeekSchema.safeParse("2026-W53").success).toBe(true);
    expect(IsoWeekSchema.safeParse("2026-W00").success).toBe(false);
    expect(IsoWeekSchema.safeParse("2026-W54").success).toBe(false);
    expect(IsoWeekSchema.safeParse("2026-28").success).toBe(false);
    expect(IsoWeekSchema.safeParse("2026-W2").success).toBe(false);
  });

  it("PlanSlot: weekday 1..7, orari HH:MM; plan_id fuori dal patch", () => {
    const base = {
      id: uuidv7(),
      plan_id: uuidv7(),
      weekday: 1,
      start_hhmm: "07:00",
      end_hhmm: null,
      title: "Palestra",
      notes: null,
      sort_order: 0,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(PlanSlotSchema.safeParse(base).success).toBe(true);
    expect(PlanSlotSchema.safeParse({ ...base, weekday: 0 }).success).toBe(
      false,
    );
    expect(
      PlanSlotSchema.safeParse({ ...base, start_hhmm: "25:00" }).success,
    ).toBe(false);
    const r = PlanSlotPatchSchema.safeParse({ plan_id: uuidv7() });
    expect(r.success && "plan_id" in r.data).toBe(false);
  });

  it("SlotCheck: stato chiuso done/skipped/null", () => {
    const base = {
      id: uuidv7(),
      slot_id: uuidv7(),
      iso_week: "2026-W28",
      checked_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(SlotCheckSchema.safeParse({ ...base, state: "done" }).success).toBe(
      true,
    );
    expect(SlotCheckSchema.safeParse({ ...base, state: null }).success).toBe(
      true,
    );
    expect(
      SlotCheckSchema.safeParse({ ...base, state: "missed" }).success,
    ).toBe(false);
  });
});

describe("focus (run-08 P5)", () => {
  it("FocusSession: minuti interi 1..600", () => {
    const now = "2026-07-12T08:00:00.000Z";
    const base = {
      id: uuidv7(),
      date: "2026-07-12",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    expect(FocusSessionSchema.safeParse({ ...base, minutes: 25 }).success).toBe(
      true,
    );
    expect(FocusSessionSchema.safeParse({ ...base, minutes: 0 }).success).toBe(
      false,
    );
    expect(
      FocusSessionSchema.safeParse({ ...base, minutes: 25.5 }).success,
    ).toBe(false);
  });
});

describe("dieta (run-09 P1)", () => {
  const now = "2026-07-12T08:00:00.000Z";
  const audit = { created_at: now, updated_at: now, deleted_at: null };

  it("Food: kcal intere, macro a un decimale, basis chiusa", () => {
    const base = {
      id: uuidv7(),
      name: "Pasta",
      basis: "per100g",
      kcal: 353,
      protein_g: 13.5,
      carbs_g: 70.2,
      fat_g: 1.8,
      default_qty: 80,
      archived_at: null,
      ...audit,
    };
    expect(FoodSchema.safeParse(base).success).toBe(true);
    expect(FoodSchema.safeParse({ ...base, kcal: 353.4 }).success).toBe(false);
    expect(
      FoodSchema.safeParse({ ...base, protein_g: 13.55 }).success,
    ).toBe(false); // due decimali: rifiutato
    expect(
      FoodSchema.safeParse({ ...base, basis: "per_kg" }).success,
    ).toBe(false);
    expect(FoodSchema.safeParse({ ...base, default_qty: null }).success).toBe(
      true,
    );
  });

  it("MealItem: qty positiva a un decimale; variant_id nullable", () => {
    const base = {
      id: uuidv7(),
      meal_id: uuidv7(),
      variant_id: null,
      food_id: uuidv7(),
      qty: 62.5,
      sort_order: 0,
      ...audit,
    };
    expect(MealItemSchema.safeParse(base).success).toBe(true);
    expect(MealItemSchema.safeParse({ ...base, qty: 0 }).success).toBe(false);
    expect(MealItemSchema.safeParse({ ...base, qty: 62.55 }).success).toBe(
      false,
    );
    // meal_id e variant_id fuori dal patch: righe che non migrano.
    const patch = MealItemPatchSchema.safeParse({
      meal_id: uuidv7(),
      variant_id: uuidv7(),
      qty: 100,
    });
    expect(patch.success).toBe(true);
    if (patch.success) {
      expect(patch.data).toEqual({ qty: 100 });
    }
  });

  it("MealLog: eaten booleano e variante nullable sulla riga derivata", () => {
    const base = {
      id: uuidv7(),
      meal_id: uuidv7(),
      date: "2026-07-13",
      eaten: false,
      variant_id: null,
      ...audit,
    };
    expect(MealLogSchema.safeParse(base).success).toBe(true);
    expect(MealLogSchema.safeParse({ ...base, eaten: 1 }).success).toBe(false);
  });

  it("DietExtraCreate: aut-aut alimento+qty O nome+kcal", () => {
    expect(
      DietExtraCreateSchema.safeParse({
        date: "2026-07-13",
        food_id: uuidv7(),
        qty: 125,
      }).success,
    ).toBe(true);
    expect(
      DietExtraCreateSchema.safeParse({
        date: "2026-07-13",
        name: "Gelato",
        kcal: 320,
      }).success,
    ).toBe(true);
    expect(
      DietExtraCreateSchema.safeParse({ date: "2026-07-13", name: "Solo" })
        .success,
    ).toBe(false);
    expect(
      DietExtraCreateSchema.safeParse({
        date: "2026-07-13",
        food_id: uuidv7(),
      }).success,
    ).toBe(false);
  });
});

describe("ricorrenze dei task (run-09 P3)", () => {
  const now = "2026-07-12T08:00:00.000Z";

  it("weekly senza giorni è rifiutata; daily non li richiede", () => {
    expect(RecurrenceSchema.safeParse({ freq: "daily" }).success).toBe(true);
    expect(
      RecurrenceSchema.safeParse({ freq: "weekly", weekdays: [1, 4] }).success,
    ).toBe(true);
    expect(RecurrenceSchema.safeParse({ freq: "weekly" }).success).toBe(false);
    expect(
      RecurrenceSchema.safeParse({ freq: "weekly", weekdays: [] }).success,
    ).toBe(false);
    expect(
      RecurrenceSchema.safeParse({ freq: "weekly", weekdays: [8] }).success,
    ).toBe(false);
  });

  it("una riga task PRE run-09 (senza la chiave) passa il parse con null", () => {
    const oldRow = {
      id: uuidv7(),
      title: "Riga vecchia",
      notes: null,
      date: null,
      time: null,
      priority: null,
      tags: [],
      module_link: null,
      status: "open",
      completed_at: null,
      sort_order: 0,
      subtasks: [],
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    const parsed = TaskSchema.safeParse(oldRow);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.recurrence).toBeNull();
  });
});
