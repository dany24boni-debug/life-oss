import { describe, it, expect } from "vitest";
import {
  DiaryDraftSchema,
  DIARY_DRAFT_MAX_CHARS,
  parseDiaryDraft,
} from "./local-storage";

// I describe su CommuteModeSchema / CommuteToggleStateSchema /
// parseCommuteMode sono morti con la sezione commute (run-05 prompt 1):
// testavano codice eliminato.

describe("DiaryDraftSchema", () => {
  it("accepts an empty string (the user just opened the editor)", () => {
    expect(DiaryDraftSchema.parse("")).toBe("");
  });

  it("accepts a normal-sized draft", () => {
    expect(DiaryDraftSchema.parse("Oggi è andata bene.")).toBe(
      "Oggi è andata bene.",
    );
  });

  it("rejects a draft exceeding the cap", () => {
    const oversized = "x".repeat(DIARY_DRAFT_MAX_CHARS + 1);
    expect(DiaryDraftSchema.safeParse(oversized).success).toBe(false);
  });

  it("accepts exactly the cap (inclusive upper bound)", () => {
    const atCap = "x".repeat(DIARY_DRAFT_MAX_CHARS);
    expect(DiaryDraftSchema.safeParse(atCap).success).toBe(true);
  });
});

describe("parseDiaryDraft", () => {
  it("returns the string when valid", () => {
    expect(parseDiaryDraft("hello")).toBe("hello");
  });

  it("returns null on null / undefined", () => {
    expect(parseDiaryDraft(null)).toBeNull();
    expect(parseDiaryDraft(undefined)).toBeNull();
  });

  it("returns null when over the cap (defensive: corrupted storage)", () => {
    const oversized = "x".repeat(DIARY_DRAFT_MAX_CHARS + 100);
    expect(parseDiaryDraft(oversized)).toBeNull();
  });
});
