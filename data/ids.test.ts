import { describe, expect, it } from "vitest";
import { uuidv7, uuidv7Timestamp, deriveUuidV8 } from "./ids";

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

describe("deriveUuidV8 — golden (contratto di idempotenza)", () => {
  // Questi valori sono FISSATI byte per byte. deriveUuidV8 è l'UNICA
  // implementazione della derivazione (cleanup 16): la usano il modulo Sera
  // (una riga per giorno) e i quattro importer legacy (via la `deriveId`
  // ri-esportata da app/(app)/gym/importer.ts, che ora è un alias di questa).
  // Se questi assert falliscono, ogni id derivato cambia e gli import
  // smettono di deduplicare (rilancio = cloni). NON aggiornare i valori
  // attesi: un fallimento significa che la derivazione è stata rotta.
  it("fissa l'output esatto per chiavi note", async () => {
    expect(await deriveUuidV8("lifeos:sera-day:2026-05-02")).toBe(
      "85c0bff0-b588-87da-af69-f7ced06a5cbb",
    );
    // Stessa chiave-prefisso degli importer gym: lo stesso valore è fissato
    // nel golden test di app/(app)/gym/importer.test.ts → prova che la
    // `deriveId` del gym e questa deriveUuidV8 sono la STESSA funzione.
    expect(
      await deriveUuidV8(
        "lifeos-import:gym_sessions:aaaa1111-0000-4000-8000-000000000001",
      ),
    ).toBe("91a203fa-12a1-8068-90be-8ea08215136a");
    // Prefisso habit-log (run-08): una riga per (abitudine, giorno) —
    // la chiave è habit_id + data. Se questo assert fallisce, i log di
    // due dispositivi smettono di convergere sulla stessa PK.
    expect(
      await deriveUuidV8(
        "lifeos:habit-log:01970000-90ac-7000-8000-000000000001:2026-07-12",
      ),
    ).toBe("481cb061-399a-8a91-aa69-11ae34b725fd");
    // Prefisso slot-check (run-08): una riga per (slot, settimana ISO).
    expect(
      await deriveUuidV8(
        "lifeos:slot-check:aaaa1111-0000-4000-8000-000000000001:2027-W01",
      ),
    ).toBe("14828f50-c9bc-8e13-8135-cf85d241821e");
  });

  it("è deterministica e ha forma UUID v8 variant 10", async () => {
    const a = await deriveUuidV8("prova:1");
    const b = await deriveUuidV8("prova:1");
    const c = await deriveUuidV8("prova:2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toBe("05c038c1-68c7-8020-bc3b-1cb475fc165e");
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
