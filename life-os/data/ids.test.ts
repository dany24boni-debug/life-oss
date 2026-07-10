import { describe, expect, it } from "vitest";
import { uuidv7, uuidv7Timestamp } from "./ids";

const V7_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidv7", () => {
  it("produce il formato RFC 9562: versione 7, variant 10", () => {
    for (let i = 0; i < 100; i++) {
      expect(uuidv7()).toMatch(V7_SHAPE);
    }
  });

  it("è strettamente monotono anche dentro lo stesso millisecondo", () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    for (let i = 1; i < ids.length; i++) {
      // Confronto stringa: con esadecimale lowercase a lunghezza fissa
      // l'ordine lessicografico È l'ordine di generazione.
      expect(ids[i] > ids[i - 1]).toBe(true);
    }
  });

  it("non produce duplicati", () => {
    const ids = Array.from({ length: 5000 }, () => uuidv7());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("codifica il timestamp di generazione (estraibile)", () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();
    const ts = uuidv7Timestamp(id);
    // Il contatore può prendere in prestito qualche ms: tolleranza minima.
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 5);
  });

  it("resta monotono se il clock iniettato arretra (skew)", () => {
    const a = uuidv7(1_800_000_000_000);
    const b = uuidv7(1_700_000_000_000); // clock indietro di ~3 anni
    expect(b > a).toBe(true);
  });

  it("ordina per tempo: id generati in ms distanti ordinano per timestamp", () => {
    const early = uuidv7(1_700_000_000_000);
    const late = uuidv7(1_900_000_000_000);
    expect(late > early).toBe(true);
    expect(uuidv7Timestamp(late)).toBeGreaterThan(uuidv7Timestamp(early));
  });
});
