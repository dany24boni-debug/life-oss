import { describe, expect, it } from "vitest";
import type { BodyEntry } from "@/data/schemas";
import {
  buildWeightChart,
  formatBodyDelta,
  formatBodyKg,
  stepBodyWeight,
  trailingAvg7,
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

describe("trailingAvg7 (PROP-corpo-01)", () => {
  it("giorni consecutivi: media cumulativa della finestra", () => {
    const avgs = trailingAvg7([
      entry("2026-07-01", 80),
      entry("2026-07-02", 82),
      entry("2026-07-03", 84),
    ]);
    expect(avgs).toEqual([80, 81, 82]);
  });

  it("la finestra è di 7 giorni di CALENDARIO: l'ottavo giorno esce", () => {
    const avgs = trailingAvg7([
      entry("2026-07-01", 80), // il 2026-07-08 dista 7 giorni: fuori
      entry("2026-07-07", 86), // dista 1: dentro
      entry("2026-07-08", 88),
    ]);
    expect(avgs[0]).toBe(80);
    expect(avgs[1]).toBe(83); // (80+86)/2
    expect(avgs[2]).toBe(87); // (86+88)/2 — l'01 è fuori finestra
  });

  it("pesate rade (gap > 6 giorni): la media è il punto grezzo", () => {
    const avgs = trailingAvg7([
      entry("2026-07-01", 80),
      entry("2026-07-20", 90),
    ]);
    expect(avgs).toEqual([80, 90]);
  });

  it("buildWeightChart: avgPath condivide la scala e resta nel range", () => {
    const chart = buildWeightChart(
      [
        entry("2026-07-01", 83),
        entry("2026-07-03", 82),
        entry("2026-07-05", 82.5),
      ],
      100,
      40,
    );
    expect(chart!.avgPath).not.toBeNull();
    expect(chart!.avgPath!.split(" ")).toHaveLength(3);
    // Primo punto: finestra = solo sé stesso → coincide col grezzo.
    expect(chart!.avgPath!.split(" ")[0]).toBe(chart!.path.split(" ")[0]);
    // Un solo punto: nessun segmento → null.
    const single = buildWeightChart([entry("2026-07-01", 82)], 100, 40);
    expect(single!.avgPath).toBeNull();
  });
});
