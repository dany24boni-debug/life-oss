import { describe, it, expect } from "vitest";
import { stubTodaysCall } from "./today-call";

describe("stubTodaysCall", () => {
  const base = {
    state: "Manutenzione",
    yesterdayCompletionPct: 100,
    streakDays: 3,
    topTargetGap: null,
    detectionFlag: null,
  };

  it("uses RECUPERO when state is Recupero, regardless of completion", () => {
    const out = stubTodaysCall({ ...base, state: "Recupero", yesterdayCompletionPct: 0 });
    expect(out.color_tag).toBe("RECUPERO");
    expect(out.text.startsWith("RECUPERO")).toBe(true);
  });

  it("uses VACANZA when state is Vacanza", () => {
    const out = stubTodaysCall({ ...base, state: "Vacanza" });
    expect(out.color_tag).toBe("VACANZA");
    expect(out.text.startsWith("VACANZA")).toBe(true);
  });

  it("returns RED when a slip detection is open (overrides completion)", () => {
    const out = stubTodaysCall({ ...base, detectionFlag: "slip", yesterdayCompletionPct: 100 });
    expect(out.color_tag).toBe("RED");
  });

  it("returns GREEN when yesterday completion >= 80% and no slip", () => {
    const out = stubTodaysCall({ ...base, yesterdayCompletionPct: 85 });
    expect(out.color_tag).toBe("GREEN");
  });

  it("includes the top target gap snippet in GREEN copy when provided", () => {
    const out = stubTodaysCall({
      ...base,
      yesterdayCompletionPct: 90,
      topTargetGap: "chameleon_os revenue_eur: 320",
    });
    expect(out.color_tag).toBe("GREEN");
    expect(out.text).toContain("chameleon_os revenue_eur: 320");
  });

  it("returns YELLOW for 50-79% completion", () => {
    const out = stubTodaysCall({ ...base, yesterdayCompletionPct: 60 });
    expect(out.color_tag).toBe("YELLOW");
  });

  it("returns YELLOW for under 50% completion (still recoverable, no slip yet)", () => {
    const out = stubTodaysCall({ ...base, yesterdayCompletionPct: 30 });
    expect(out.color_tag).toBe("YELLOW");
  });

  it("returns YELLOW for 0% completion when no slip flag is open", () => {
    // Locked-in contract: 0% without a Voglia detection stays YELLOW so the
    // banner reads "riparti dal LIGHT più piccolo" instead of jumping to RED.
    // RED is reserved for the Voglia Engine's confirmed slip detection.
    const out = stubTodaysCall({ ...base, yesterdayCompletionPct: 0, detectionFlag: null });
    expect(out.color_tag).toBe("YELLOW");
  });

  it("priority order: Recupero/Vacanza > slip > completion thresholds", () => {
    // Recupero wins over slip flag.
    expect(
      stubTodaysCall({ ...base, state: "Recupero", detectionFlag: "slip" }).color_tag,
    ).toBe("RECUPERO");
    // Vacanza wins over slip flag.
    expect(
      stubTodaysCall({ ...base, state: "Vacanza", detectionFlag: "slip" }).color_tag,
    ).toBe("VACANZA");
    // Slip wins over a perfect completion.
    expect(
      stubTodaysCall({ ...base, state: "Manutenzione", detectionFlag: "slip", yesterdayCompletionPct: 100 })
        .color_tag,
    ).toBe("RED");
  });
});
