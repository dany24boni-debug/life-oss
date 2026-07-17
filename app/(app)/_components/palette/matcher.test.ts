import { describe, expect, it } from "vitest";
import { fuzzyScore, rankOf } from "./matcher";
import { NAV_SOURCES, gymCardSources } from "./sources";

describe("fuzzyScore", () => {
  it("subsequence: tutti i caratteri in ordine, o null", () => {
    expect(fuzzyScore("tor", "Apri scheda: Torso A")).not.toBeNull();
    expect(fuzzyScore("xyz", "Apri scheda: Torso A")).toBeNull();
    expect(fuzzyScore("", "qualunque")).toBe(0);
  });

  it("inizio parola batte il match in mezzo", () => {
    const word = fuzzyScore("cal", "Calendario") as number;
    const mid = fuzzyScore("cal", "focale") as number;
    expect(word).toBeGreaterThan(mid);
  });

  it("consecutivi battono gli sparsi; a pari match vince il corto", () => {
    const run = fuzzyScore("die", "Dieta") as number;
    const scattered = fuzzyScore("die", "d i e t a lunga") as number;
    expect(run).toBeGreaterThan(scattered);
    const short = fuzzyScore("task", "Task") as number;
    const long = fuzzyScore("task", "Task lunghissima coda") as number;
    expect(short).toBeGreaterThan(long);
  });

  it("case-insensitive", () => {
    expect(fuzzyScore("TOR", "torso a")).toEqual(fuzzyScore("tor", "Torso A"));
  });
});

describe("rankOf sulle sorgenti", () => {
  it("le keywords partecipano al match", () => {
    const gym = NAV_SOURCES.find((s) => s.id === "nav:/gym")!;
    expect(rankOf("allenamento", gym)).not.toBeNull();
  });

  it("'tor' trova la scheda Torso A davanti alle superfici", () => {
    const sources = [
      ...NAV_SOURCES,
      ...gymCardSources([{ id: "d1", name: "Torso A", subtitle: null }]),
    ];
    const ranked = sources
      .map((s) => ({ s, score: rankOf("torso", s) }))
      .filter((x) => x.score !== null)
      .sort((a, b) => (b.score as number) - (a.score as number));
    expect(ranked[0]?.s.id).toBe("gym-card:d1");
  });
});

describe("gymCardSources", () => {
  it("nome → 'Apri scheda: …' con il deep-link della card", () => {
    expect(
      gymCardSources([{ id: "abc", name: "Gambe", subtitle: "quad + femorali" }]),
    ).toEqual([
      {
        id: "gym-card:abc",
        label: "Apri scheda: Gambe",
        group: "Palestra",
        keywords: "scheda card palestra gym allenamento quad + femorali",
        href: "/gym?scheda=abc",
      },
    ]);
  });
});

describe("NAV_SOURCES", () => {
  it("quattordici superfici, id = href", () => {
    expect(NAV_SOURCES).toHaveLength(14);
    for (const s of NAV_SOURCES) {
      expect(s.id).toBe(`nav:${s.href}`);
      expect(s.group).toBe("Vai a");
    }
  });
});
