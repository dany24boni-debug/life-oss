import { describe, expect, it } from "vitest";
import {
  EventCreateSchema,
  HhmmSchema,
  IsoDaySchema,
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
});
