import { describe, it, expect } from "vitest";
import {
  CommuteModeSchema,
  CommuteToggleStateSchema,
  DiaryDraftSchema,
  DIARY_DRAFT_MAX_CHARS,
  parseCommuteMode,
  parseDiaryDraft,
} from "./local-storage";

describe("CommuteModeSchema", () => {
  it("accepts 'on'", () => {
    expect(CommuteModeSchema.parse("on")).toBe("on");
  });

  it("accepts 'off'", () => {
    expect(CommuteModeSchema.parse("off")).toBe("off");
  });

  it("rejects arbitrary strings", () => {
    expect(CommuteModeSchema.safeParse("yes").success).toBe(false);
    expect(CommuteModeSchema.safeParse("ON").success).toBe(false);
    expect(CommuteModeSchema.safeParse("").success).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(CommuteModeSchema.safeParse(null).success).toBe(false);
    expect(CommuteModeSchema.safeParse(1).success).toBe(false);
  });
});

describe("CommuteToggleStateSchema", () => {
  it("accepts the three valid states", () => {
    expect(CommuteToggleStateSchema.parse("on")).toBe("on");
    expect(CommuteToggleStateSchema.parse("off")).toBe("off");
    expect(CommuteToggleStateSchema.parse("auto")).toBe("auto");
  });

  it("rejects unrelated strings", () => {
    expect(CommuteToggleStateSchema.safeParse("automatic").success).toBe(false);
  });
});

describe("parseCommuteMode", () => {
  it("returns the value when valid", () => {
    expect(parseCommuteMode("on")).toBe("on");
    expect(parseCommuteMode("off")).toBe("off");
  });

  it("returns null on null / undefined / invalid (no throw)", () => {
    expect(parseCommuteMode(null)).toBeNull();
    expect(parseCommuteMode(undefined)).toBeNull();
    expect(parseCommuteMode("garbage")).toBeNull();
    expect(parseCommuteMode("")).toBeNull();
  });
});

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
