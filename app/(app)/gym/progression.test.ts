import { describe, expect, it } from "vitest";
import type { GymProgramSlot, GymSet } from "@/data/schemas";
import {
  buildGridRows,
  buildProgressTable,
  doneCellLabel,
  formatElapsed,
  ghostLabel,
  lastDoneSet,
  nextSetNumberInRow,
  parseActualRestInput,
  parseRepsRange,
  parseRirFloors,
  plannedSetCount,
  rirFloorAt,
  rirLabelAt,
  suggestedRestS,
  verdictForSlot,
  verdictLabel,
} from "./progression";

const AUDIT = {
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  deleted_at: null,
};

let n = 0;
function set(over: Partial<GymSet>): GymSet {
  n += 1;
  return {
    id: `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    session_id: "s1",
    exercise_id: "ex-1",
    set_number: 1,
    weight_kg: 60,
    reps: 8,
    rir_done: null,
    rest_actual_s: null,
    feeling_1_10: null,
    done_at: null,
    ...AUDIT,
  ...over,
  };
}

function slot(over: Partial<GymProgramSlot>): GymProgramSlot {
  n += 1;
  return {
    id: `01990000-0000-7000-8000-${String(n).padStart(12, "0")}`,
    day_id: "day-1",
    exercise_id: "ex-1",
    section: "FORZA",
    variant: null,
    target_sets: 4,
    target_reps: "3–5",
    target_rir: "1",
    rest_seconds: 270,
    bodyweight: false,
    notes: null,
    sort_order: 0,
    ...AUDIT,
    ...over,
  };
}

describe("parsing delle prescrizioni", () => {
  it("parseRepsRange: range, singolo, trattino ASCII, testo libero", () => {
    expect(parseRepsRange("3–5")).toEqual({ min: 3, max: 5 });
    expect(parseRepsRange("8-10")).toEqual({ min: 8, max: 10 });
    expect(parseRepsRange("12")).toEqual({ min: 12, max: 12 });
    expect(parseRepsRange("max")).toBeNull();
    expect(parseRepsRange(null)).toBeNull();
  });

  it("parseRirFloors: uniforme, range (pavimento = minimo), discendente", () => {
    expect(parseRirFloors("1")).toEqual([1]);
    expect(parseRirFloors("1–2")).toEqual([1]);
    expect(parseRirFloors("2/1/0")).toEqual([2, 1, 0]);
    expect(parseRirFloors("x")).toBeNull();
    expect(parseRirFloors(null)).toBeNull();
  });

  it("rirFloorAt e rirLabelAt: per-indice, l'ultimo copre la coda", () => {
    const floors = parseRirFloors("2/1/0");
    expect(rirFloorAt(floors, 0)).toBe(2);
    expect(rirFloorAt(floors, 2)).toBe(0);
    expect(rirFloorAt(floors, 5)).toBe(0);
    expect(rirFloorAt(null, 0)).toBeNull();
    expect(rirLabelAt("2/1/0", 1)).toBe("1");
    expect(rirLabelAt("1–2", 3)).toBe("1–2");
  });

  it("ghostLabel: la cella fantasma parla la lingua del foglio", () => {
    const s = slot({ target_reps: "15–20", target_rir: "2/1/0" });
    expect(ghostLabel(s, 0)).toBe("15–20 @RIR2");
    expect(ghostLabel(s, 2)).toBe("15–20 @RIR0");
    expect(ghostLabel(slot({ target_rir: null }), 0)).toBe("3–5");
    expect(
      ghostLabel(slot({ target_reps: null, target_rir: null }), 0),
    ).toBe("—");
  });
});

describe("verdetto AUMENTA / RESTA", () => {
  const panca = slot({ target_sets: 4, target_reps: "3–5", target_rir: "1" });

  it("AUMENTA: tutte le serie fatte, reps al tetto, RIR entro il pavimento", () => {
    const sets = [5, 5, 5, 5].map((reps, i) =>
      set({ reps, rir_done: 1, set_number: i + 1 }),
    );
    expect(verdictForSlot(panca, sets)).toBe("aumenta");
  });

  it("RESTA: una serie sotto il tetto, o serie mancanti, o RIR alto", () => {
    const sotto = [5, 5, 4, 5].map((reps, i) =>
      set({ reps, set_number: i + 1 }),
    );
    expect(verdictForSlot(panca, sotto)).toBe("resta");

    const poche = [5, 5, 5].map((reps, i) => set({ reps, set_number: i + 1 }));
    expect(verdictForSlot(panca, poche)).toBe("resta");

    const rirAlto = [5, 5, 5, 5].map((reps, i) =>
      set({ reps, rir_done: i === 3 ? 2 : 1, set_number: i + 1 }),
    );
    expect(verdictForSlot(panca, rirAlto)).toBe("resta");
  });

  it("RIR non registrato non blocca; senza range o storia non si giudica", () => {
    const senzaRir = [5, 5, 5, 5].map((reps, i) =>
      set({ reps, rir_done: null, set_number: i + 1 }),
    );
    expect(verdictForSlot(panca, senzaRir)).toBe("aumenta");
    expect(verdictForSlot(panca, [])).toBeNull();
    expect(
      verdictForSlot(slot({ target_reps: null }), senzaRir),
    ).toBeNull();
  });

  it("il caso del foglio: Laterali 3×15–20 RIR 2/1/0, confronto per-indice", () => {
    const laterali = slot({
      target_sets: 3,
      target_reps: "15–20",
      target_rir: "2/1/0",
    });
    // Reps al tetto e RIR esattamente sulla discesa: si sale.
    const perfetta = [
      set({ reps: 20, rir_done: 2, set_number: 1 }),
      set({ reps: 20, rir_done: 1, set_number: 2 }),
      set({ reps: 20, rir_done: 0, set_number: 3 }),
    ];
    expect(verdictForSlot(laterali, perfetta)).toBe("aumenta");
    // Terza serie con RIR 1 (> pavimento 0 del SUO indice): resta.
    const terzaMorbida = [
      set({ reps: 20, rir_done: 2, set_number: 1 }),
      set({ reps: 20, rir_done: 1, set_number: 2 }),
      set({ reps: 20, rir_done: 1, set_number: 3 }),
    ];
    expect(verdictForSlot(laterali, terzaMorbida)).toBe("resta");
  });

  it("etichette: +2,5 kg solo dove c'è un carico", () => {
    expect(verdictLabel("aumenta", false)).toBe("AUMENTA +2,5 kg");
    expect(verdictLabel("aumenta", true)).toBe("AUMENTA");
    expect(verdictLabel("resta", false)).toBe("RESTA");
  });
});

describe("aderenza", () => {
  it("serie previste = somma dei target del giorno (fixture: 24)", () => {
    const torsoA = [4, 4, 4, 3, 3, 3, 3].map((target_sets) =>
      slot({ target_sets }),
    );
    expect(plannedSetCount(torsoA)).toBe(24);
    expect(plannedSetCount([])).toBe(0);
  });
});

describe("griglia: righe e stati delle celle", () => {
  it("N celle per target, fatte poi fantasma; le extra allungano", () => {
    const s = slot({ target_sets: 3, exercise_id: "ex-1" });
    const fatte = [
      set({ exercise_id: "ex-1", set_number: 1, weight_kg: 62.5, reps: 4 }),
    ];
    const rows = buildGridRows([s], fatte);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.map((c) => c.kind)).toEqual([
      "done",
      "ghost",
      "ghost",
    ]);
    expect(nextSetNumberInRow(rows[0])).toBe(2);

    const quattro = [1, 2, 3, 4].map((k) =>
      set({ exercise_id: "ex-1", set_number: k }),
    );
    expect(buildGridRows([s], quattro)[0].cells.map((c) => c.kind)).toEqual([
      "done",
      "done",
      "done",
      "done",
    ]);
  });

  it("fuori scheda: righe dai set orfani, poi gli aggiunti ancora vuoti", () => {
    const s = slot({ exercise_id: "ex-1", target_sets: 2 });
    const rows = buildGridRows(
      [s],
      [set({ exercise_id: "ex-9", set_number: 1 })],
      ["ex-5"],
    );
    expect(rows.map((r) => r.exerciseId)).toEqual(["ex-1", "ex-9", "ex-5"]);
    expect(rows[1].slot).toBeNull();
    expect(rows[1].cells).toHaveLength(1);
    expect(rows[2].cells).toHaveLength(0);
    // Un pending già coperto da uno slot non raddoppia.
    expect(
      buildGridRows([s], [], ["ex-1"]).map((r) => r.exerciseId),
    ).toEqual(["ex-1"]);
  });

  it("etichetta della cella fatta: kg italiani, corpo libero senza kg", () => {
    expect(doneCellLabel({ weight_kg: 62.5, reps: 9 })).toBe("62,5 × 9");
    expect(doneCellLabel({ weight_kg: null, reps: 12 })).toBe("× 12");
  });
});

describe("recupero quieto (mai countdown)", () => {
  it("formatElapsed sale: 2:10", () => {
    expect(formatElapsed(130)).toBe("2:10");
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(3721)).toBe("62:01");
  });

  it("lastDoneSet: il done_at più recente; i non confermati non contano", () => {
    const a = set({ done_at: "2026-07-10T18:00:00.000Z" });
    const b = set({ done_at: "2026-07-10T18:05:00.000Z" });
    const c = set({ done_at: null });
    expect(lastDoneSet([a, b, c])?.id).toBe(b.id);
    expect(lastDoneSet([c])).toBeNull();
  });

  it("suggerimento recupero = trascorso reale; oltre l'ora è una pausa", () => {
    const at = "2026-07-10T18:00:00.000Z";
    const now = Date.parse(at);
    expect(suggestedRestS(at, now + 150_000)).toBe(150);
    expect(suggestedRestS(at, now + 3_700_000)).toBeNull();
    expect(suggestedRestS(null, now)).toBeNull();
  });

  it("parseActualRestInput: dominio del set (0..3600)", () => {
    expect(parseActualRestInput("150")).toBe(150);
    expect(parseActualRestInput("2'30")).toBe(150);
    expect(parseActualRestInput("2:30")).toBe(150);
    expect(parseActualRestInput("5000")).toBe(3600);
    expect(parseActualRestInput("")).toBeNull();
    expect(parseActualRestInput("boh")).toBeNull();
  });
});

describe("tabella Progressi: colonne, e1RM, Δ, punti PR", () => {
  const dates = new Map([
    ["s1", "2026-07-01"],
    ["s2", "2026-07-08"],
    ["s3", "2026-07-15"],
  ]);

  it("colonne più recenti prima; volume e e1RM per seduta; Δ vs precedente", () => {
    const sets = [
      set({ session_id: "s1", weight_kg: 60, reps: 8, set_number: 1 }),
      set({ session_id: "s1", weight_kg: 60, reps: 8, set_number: 2 }),
      set({ session_id: "s2", weight_kg: 62.5, reps: 8, set_number: 1 }),
      set({ session_id: "s2", weight_kg: null, reps: 12, set_number: 2 }),
    ];
    const table = buildProgressTable(sets, dates);
    expect(table.columns.map((c) => c.sessionId)).toEqual(["s2", "s1"]);
    expect(table.maxSets).toBe(2);

    const [recent, prior] = table.columns;
    expect(prior.volumeKg).toBe(960);
    expect(prior.e1rmKg).toBeCloseTo(60 * (36 / 29), 5);
    expect(prior.deltaE1rmKg).toBeNull(); // prima seduta: nessun confronto
    expect(recent.volumeKg).toBe(500);
    expect(recent.e1rmKg).toBeCloseTo(62.5 * (36 / 29), 5);
    // Δ arrotondato a 0,1: (62,5-60) × 36/29 ≈ 3,1.
    expect(recent.deltaE1rmKg).toBeCloseTo(3.1, 5);
  });

  it("punti PR: battere il MIGLIOR carico di tutte le sedute prima; mai alla prima", () => {
    const sets = [
      set({ session_id: "s1", weight_kg: 60, reps: 5, set_number: 1 }),
      set({ session_id: "s2", weight_kg: 62.5, reps: 5, set_number: 1 }),
      set({ session_id: "s2", weight_kg: 60, reps: 8, set_number: 2 }),
      set({ session_id: "s3", weight_kg: 62.5, reps: 5, set_number: 1 }),
    ];
    const table = buildProgressTable(sets, dates);
    const bySession = new Map(table.columns.map((c) => [c.sessionId, c]));
    expect(bySession.get("s1")?.prFlags).toEqual([false]); // prima: mai record
    expect(bySession.get("s2")?.prFlags).toEqual([true, false]);
    expect(bySession.get("s3")?.prFlags).toEqual([false]); // eguagliare non basta
  });

  it("sedute sconosciute alla mappa date restano fuori; corpo libero: e1RM null", () => {
    const sets = [
      set({ session_id: "ignota", weight_kg: 100, reps: 5 }),
      set({ session_id: "s1", weight_kg: null, reps: 12, set_number: 1 }),
    ];
    const table = buildProgressTable(sets, dates);
    expect(table.columns).toHaveLength(1);
    expect(table.columns[0].e1rmKg).toBeNull();
    expect(table.columns[0].deltaE1rmKg).toBeNull();
    expect(table.columns[0].volumeKg).toBe(0);
  });

  it("taglio alle ultime N colonne (default 10)", () => {
    const many = new Map(
      Array.from({ length: 14 }, (_, i) => [
        `s${i}`,
        `2026-06-${String(i + 1).padStart(2, "0")}`,
      ]),
    );
    const sets = Array.from({ length: 14 }, (_, i) =>
      set({ session_id: `s${i}`, weight_kg: 50 + i, reps: 5, set_number: 1 }),
    );
    const table = buildProgressTable(sets, many);
    expect(table.columns).toHaveLength(10);
    expect(table.columns[0].sessionId).toBe("s13"); // la più recente davanti
  });
});
