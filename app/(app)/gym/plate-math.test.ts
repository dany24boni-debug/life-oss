import { describe, expect, it } from "vitest";
import { plateBreakdown } from "./plate-math";

/** Profilo tipico: coppie piene di ogni taglio standard. */
const STANDARD = [
  { kg: 20, n: 4 },
  { kg: 10, n: 4 },
  { kg: 5, n: 4 },
  { kg: 2.5, n: 4 },
  { kg: 1.25, n: 4 },
];

describe("plateBreakdown", () => {
  it("target esatto: tagli decrescenti, conteggi per lato", () => {
    // (100 − 20) / 2 = 40 per lato = 2×20.
    expect(plateBreakdown(100, 20, STANDARD)).toEqual({
      kind: "exact",
      perSide: [{ kg: 20, count: 2 }],
    });
    // (77,5 − 20) / 2 = 28,75 = 20 + 5 + 2,5 + 1,25 (frazioni in
    // grammi interi: niente sporcizia float).
    expect(plateBreakdown(77.5, 20, STANDARD)).toEqual({
      kind: "exact",
      perSide: [
        { kg: 20, count: 1 },
        { kg: 5, count: 1 },
        { kg: 2.5, count: 1 },
        { kg: 1.25, count: 1 },
      ],
    });
  });

  it("target = bilanciere → bar-only; sotto il bilanciere → nearest col solo bilanciere", () => {
    expect(plateBreakdown(20, 20, STANDARD)).toEqual({ kind: "bar-only" });
    expect(plateBreakdown(15, 20, STANDARD)).toEqual({
      kind: "nearest",
      totalKg: 20,
      perSide: [],
    });
  });

  it("irraggiungibile → il totale più vicino, anche sopra il target", () => {
    // Solo 20 e 10: per lato si fa {0,10,20,30,…}; target 78 → 29/lato
    // → 30 (dist 1) batte 20 (dist 9): totale 80.
    const r = plateBreakdown(78, 20, [
      { kg: 20, n: 4 },
      { kg: 10, n: 4 },
    ]);
    expect(r).toEqual({
      kind: "nearest",
      totalKg: 80,
      perSide: [
        { kg: 20, count: 1 },
        { kg: 10, count: 1 },
      ],
    });
  });

  it("a pari distanza vince il più leggero", () => {
    // Target 22,5 → 1,25/lato con soli 2,5: dist(0) = dist(2,5) = 1,25
    // → si resta col solo bilanciere (20), non 25.
    expect(plateBreakdown(22.5, 20, [{ kg: 2.5, n: 4 }])).toEqual({
      kind: "nearest",
      totalKg: 20,
      perSide: [],
    });
  });

  it("il caso che frega il greedy nudo: 15/lato con {20, 15} è ESATTO", () => {
    // Greedy prenderebbe il 20 (≤ no: 20 > 15… prenderebbe niente? con
    // 20 > 15 salta al 15: qui il greedy semplice funzionerebbe; il caso
    // killer è 30/lato con {20×1 coppia, 15×2 coppie}: greedy 20+…10
    // infattibile, mentre 15+15 è esatto).
    expect(
      plateBreakdown(80, 20, [
        { kg: 20, n: 2 },
        { kg: 15, n: 4 },
      ]),
    ).toEqual({
      kind: "exact",
      perSide: [{ kg: 15, count: 2 }],
    });
  });

  it("preferenza dischi grossi: la rappresentazione è greedy-like quando può", () => {
    // 35/lato con {20, 15, 10, 5}: 20+15, non 15+10+10 né 10+10+10+5.
    expect(plateBreakdown(90, 20, STANDARD.concat([{ kg: 15, n: 4 }]))).toEqual(
      {
        kind: "exact",
        perSide: [
          { kg: 20, count: 1 },
          { kg: 15, count: 1 },
        ],
      },
    );
  });

  it("i dischi spaiati non contano (floor n/2) e i conteggi limitano", () => {
    // n=3 → 1 coppia: 20/lato ok, 40/lato no (nearest 20 → totale 60).
    expect(plateBreakdown(60, 20, [{ kg: 20, n: 3 }])).toEqual({
      kind: "exact",
      perSide: [{ kg: 20, count: 1 }],
    });
    expect(plateBreakdown(100, 20, [{ kg: 20, n: 3 }])).toEqual({
      kind: "nearest",
      totalKg: 60,
      perSide: [{ kg: 20, count: 1 }],
    });
  });

  it("senza dischi utilizzabili: sempre nearest sul solo bilanciere", () => {
    expect(plateBreakdown(60, 20, [])).toEqual({
      kind: "nearest",
      totalKg: 20,
      perSide: [],
    });
    expect(plateBreakdown(60, 20, [{ kg: 20, n: 1 }])).toEqual({
      kind: "nearest",
      totalKg: 20,
      perSide: [],
    });
  });
});
