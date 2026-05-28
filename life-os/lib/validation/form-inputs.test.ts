import { describe, it, expect } from "vitest";
import {
  AddExamSchema,
  ExamIdSchema,
  UpdateExamProgressSchema,
  SaveDiaryEntrySchema,
  EveningCheckinSchema,
  ToggleCarryoverSchema,
  UuidSchema,
  DateYmdSchema,
  parseFormData,
  MAX_DIARY_CHARS,
} from "./form-inputs";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

describe("UuidSchema", () => {
  it("accepts canonical 36-char dashed UUID", () => {
    expect(UuidSchema.parse(VALID_UUID)).toBe(VALID_UUID);
  });

  it("rejects malformed UUIDs", () => {
    expect(UuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(UuidSchema.safeParse("00000000-0000-0000-0000").success).toBe(false);
    expect(UuidSchema.safeParse("").success).toBe(false);
  });
});

describe("DateYmdSchema", () => {
  it("accepts ISO YYYY-MM-DD", () => {
    expect(DateYmdSchema.parse("2026-05-12")).toBe("2026-05-12");
  });

  it("rejects other date formats", () => {
    expect(DateYmdSchema.safeParse("12/05/2026").success).toBe(false);
    expect(DateYmdSchema.safeParse("2026-5-12").success).toBe(false);
    expect(DateYmdSchema.safeParse("2026-05-12T00:00:00Z").success).toBe(false);
  });
});

describe("AddExamSchema", () => {
  it("accepts a complete valid input", () => {
    const r = AddExamSchema.parse({
      title: "Storia moderna",
      exam_date: "2026-06-15",
      total_chapters: "12",
      notes: "libro consigliato",
    });
    expect(r.title).toBe("Storia moderna");
    expect(r.exam_date).toBe("2026-06-15");
    expect(r.total_chapters).toBe(12);
    expect(r.notes).toBe("libro consigliato");
  });

  it("trims title and collapses empty notes to null", () => {
    const r = AddExamSchema.parse({
      title: "   Marketing  ",
      exam_date: "2026-06-20",
      total_chapters: "0",
      notes: "   ",
    });
    expect(r.title).toBe("Marketing");
    expect(r.notes).toBeNull();
  });

  it("defaults total_chapters to 0 when missing", () => {
    const r = AddExamSchema.parse({
      title: "Cinese",
      exam_date: "2026-07-01",
    });
    expect(r.total_chapters).toBe(0);
  });

  it("rejects empty title", () => {
    const r = AddExamSchema.safeParse({
      title: "   ",
      exam_date: "2026-06-15",
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed date", () => {
    const r = AddExamSchema.safeParse({
      title: "Storia moderna",
      exam_date: "15-06-2026",
    });
    expect(r.success).toBe(false);
  });

  it("caps title at 80 chars", () => {
    const long = "x".repeat(200);
    const r = AddExamSchema.parse({
      title: long,
      exam_date: "2026-06-15",
    });
    expect(r.title.length).toBe(80);
  });
});

describe("ExamIdSchema", () => {
  it("accepts valid UUID", () => {
    expect(ExamIdSchema.parse({ exam_id: VALID_UUID }).exam_id).toBe(VALID_UUID);
  });

  it("rejects non-UUID exam_id", () => {
    expect(ExamIdSchema.safeParse({ exam_id: "abc" }).success).toBe(false);
  });
});

describe("UpdateExamProgressSchema", () => {
  it("coerces string completed_chapters into int", () => {
    const r = UpdateExamProgressSchema.parse({
      exam_id: VALID_UUID,
      completed_chapters: "5",
    });
    expect(r.completed_chapters).toBe(5);
  });

  it("rejects negative completed", () => {
    expect(
      UpdateExamProgressSchema.safeParse({
        exam_id: VALID_UUID,
        completed_chapters: "-1",
      }).success,
    ).toBe(false);
  });
});

describe("SaveDiaryEntrySchema", () => {
  it("accepts a complete valid input", () => {
    const r = SaveDiaryEntrySchema.parse({
      date: "2026-05-12",
      content: "Oggi è andata bene.",
      mood: "stanco ma ok",
    });
    expect(r.date).toBe("2026-05-12");
    expect(r.content).toBe("Oggi è andata bene.");
    expect(r.mood).toBe("stanco ma ok");
  });

  it("accepts null/empty mood (collapsed to null)", () => {
    const r = SaveDiaryEntrySchema.parse({
      date: "2026-05-12",
      content: "body",
      mood: "",
    });
    expect(r.mood).toBeNull();
  });

  it("rejects content beyond MAX_DIARY_CHARS", () => {
    const r = SaveDiaryEntrySchema.safeParse({
      date: "2026-05-12",
      content: "x".repeat(MAX_DIARY_CHARS + 1),
    });
    expect(r.success).toBe(false);
  });

  it("rejects malformed date", () => {
    const r = SaveDiaryEntrySchema.safeParse({
      date: "12-05-2026",
      content: "body",
    });
    expect(r.success).toBe(false);
  });
});

describe("EveningCheckinSchema", () => {
  it("coerces energy_1_5 from string to int", () => {
    const r = EveningCheckinSchema.parse({
      energy_1_5: "3",
      mood: "ok",
      notes: "",
    });
    expect(r.energy_1_5).toBe(3);
    expect(r.notes).toBeNull();
  });

  it("rejects energy out of [1,5]", () => {
    expect(
      EveningCheckinSchema.safeParse({ energy_1_5: "0" }).success,
    ).toBe(false);
    expect(
      EveningCheckinSchema.safeParse({ energy_1_5: "6" }).success,
    ).toBe(false);
    expect(
      EveningCheckinSchema.safeParse({ energy_1_5: "2.5" }).success,
    ).toBe(false);
  });
});

describe("ToggleCarryoverSchema", () => {
  it("accepts true/false strings", () => {
    expect(
      ToggleCarryoverSchema.parse({ task_id: VALID_UUID, carryover: "true" })
        .carryover,
    ).toBe("true");
    expect(
      ToggleCarryoverSchema.parse({ task_id: VALID_UUID, carryover: "false" })
        .carryover,
    ).toBe("false");
  });

  it("rejects boolean-like impostors", () => {
    expect(
      ToggleCarryoverSchema.safeParse({
        task_id: VALID_UUID,
        carryover: "yes",
      }).success,
    ).toBe(false);
  });
});

describe("parseFormData helper", () => {
  it("converts FormData entries to a plain object and validates", () => {
    const fd = new FormData();
    fd.set("exam_id", VALID_UUID);
    const r = parseFormData(ExamIdSchema, fd);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.exam_id).toBe(VALID_UUID);
  });

  it("fails on missing fields", () => {
    const fd = new FormData();
    const r = parseFormData(ExamIdSchema, fd);
    expect(r.success).toBe(false);
  });

  it("skips non-string entries silently", () => {
    const fd = new FormData();
    fd.set("exam_id", VALID_UUID);
    fd.set("extra", new Blob(["x"]));
    const r = parseFormData(ExamIdSchema, fd);
    expect(r.success).toBe(true);
  });
});
