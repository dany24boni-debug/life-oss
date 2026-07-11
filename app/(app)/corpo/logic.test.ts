import { describe, expect, it } from "vitest";
import type { BodyEntry } from "@/data/schemas";
import {
  buildWeightChart,
  formatBodyDelta,
  formatBodyKg,
  stepBodyWeight,
} from "./logic";

function entry(date: string, weight_kg: number): BodyEntry {
  return {
    id: `id-${date}`,
    date,
    weight_kg,
    note: null,
    created_at: "2026-07-01T08:00:00.000Z",
    updated_at: "2026-07-01T08:00:00.000Z",
    deleted_at: null,
  };
}

describe("stepper e formati del peso", () => {
  it("±0,1 nel dominio 20..400, senza scie di float", () => {
    expect(stepBodyWeight(82.4, 1)).toBe(82.5);
    expect(stepBodyWeight(82.4, -1)).toBe(82.3);
    expect(stepBodyWeight(20, -1)).toBe(20);
    expect(stepBodyWeight(400, 1)).toBe(400);
    expect(stepBodyWeight(0.1 + 0.2 + 82, 1)).toBe(82.4);
  });

  it("formato italiano con un decimale; delta con segno", () => {
    expect(formatBodyKg(82.4)).toBe("82,4 kg");
    expect(formatBodyKg(82)).toBe("82,0 kg");
    expect(formatBodyDelta(-0.3)).toBe("−0,3 kg");
    expect(formatBodyDelta(0.2)).toBe("+0,2 kg");
    expect(formatBodyDelta(0)).toBe("=");
  });
});

describe("buildWeightChart", () => {
  it("scala tra min e max; banda = range reale della finestra", () => {
    const chart = buildWeightChart(
      [entry("2026-07-01", 83), entry("2026-07-08", 82), entry("2026-07-11", 82.5)],
      100,
      40,
    );
    expect(chart).not.toBeNull();
    expect(chart!.minKg).toBe(82);
    expect(chart!.maxKg).toBe(83);
    // min in basso (y grande), max in alto (y piccola).
    expect(chart!.bandTopY).toBeLessThan(chart!.bandBottomY);
    expect(chart!.path.split(" ")).toHaveLength(3);
    expect(chart!.first.date).toBe("2026-07-01");
    expect(chart!.last.date).toBe("2026-07-11");
  });

  it("piatto = linea a metà; vuoto = null", () => {
    const flat = buildWeightChart(
      [entry("2026-07-01", 82), entry("2026-07-02", 82)],
      100,
      40,
    );
    expect(flat!.path).toBe("3,20 97,20");
    expect(buildWeightChart([], 100, 40)).toBeNull();
  });
});
