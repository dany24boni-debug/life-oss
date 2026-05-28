import { describe, it, expect } from "vitest";
import { estimateOneRepMax } from "./fitness";

describe("estimateOneRepMax (Brzycki)", () => {
  it("returns weight when reps = 1", () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
  });

  it("scales up with multiple reps", () => {
    // Brzycki: 100 × 36/(37-5) = 112.5
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(112.5, 1);
    // 80 × 36/(37-10) = ~106.67
    expect(estimateOneRepMax(80, 10)).toBeCloseTo(106.67, 1);
  });

  it("guards against degenerate inputs", () => {
    expect(estimateOneRepMax(0, 5)).toBe(0);
    expect(estimateOneRepMax(100, 0)).toBe(0);
    expect(estimateOneRepMax(-50, 5)).toBe(0);
  });

  it("clamps reps ≥ 37 to weight (Brzycki breaks down)", () => {
    expect(estimateOneRepMax(100, 37)).toBe(100);
    expect(estimateOneRepMax(100, 50)).toBe(100);
  });
});
