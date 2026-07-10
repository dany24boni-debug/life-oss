import { describe, expect, it } from "vitest";
import { seraDayId } from "@/data/local/sera";
import { EveningCheckinSchema } from "@/data/schemas";
import { buildSeraImportPlan, type LegacyCheckinRow } from "./importer";

const serata: LegacyCheckinRow = {
  id: "ffff6666-0000-4000-8000-000000000001",
  date: "2026-06-20",
  energy_1_5: 4,
  mood: " sereno ",
  notes: "Cena fuori",
  created_at: "2026-06-20T21:30:00+00:00",
};

describe("buildSeraImportPlan — mappatura pura evening_checkins", () => {
  it("mappa una riga legacy in un check-in valido con id DERIVATO DALLA DATA", async () => {
    const plan = await buildSeraImportPlan([serata]);
    expect(plan.skippedInvalid).toBe(0);
    const row = plan.checkins[0];
    expect(EveningCheckinSchema.parse(row)).toEqual(row);
    // L'id è quello del giorno: un check-in scritto a mano per lo stesso
    // giorno è la stessa riga (l'import non lo toccherà mai).
    expect(row.id).toBe(await seraDayId("2026-06-20"));
    expect(row.energy_1_5).toBe(4);
    expect(row.mood).toBe("sereno");
    expect(row.notes).toBe("Cena fuori");
    expect(row.journal).toBeNull(); // i diari legacy restano su Drive
    expect(row.created_at).toBe("2026-06-20T21:30:00.000Z");
  });

  it("è deterministico: stesso input → stesse righe", async () => {
    const a = await buildSeraImportPlan([serata]);
    const b = await buildSeraImportPlan([serata]);
    expect(a).toEqual(b);
  });

  it("normalizza energia fuori dominio a null; campi vuoti a null", async () => {
    const sporca: LegacyCheckinRow = {
      ...serata,
      id: "x1",
      date: "2026-06-21",
      energy_1_5: 9,
      mood: "   ",
      notes: null,
      created_at: null,
    };
    const plan = await buildSeraImportPlan([sporca]);
    const row = plan.checkins[0];
    expect(row.energy_1_5).toBeNull();
    expect(row.mood).toBeNull();
    expect(row.notes).toBeNull();
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(EveningCheckinSchema.parse(row)).toEqual(row);
  });

  it("scarta date malformate e giorni duplicati, contandoli", async () => {
    const dataRotta: LegacyCheckinRow = {
      ...serata,
      id: "x2",
      date: "20/06/2026",
    };
    const duplicato: LegacyCheckinRow = { ...serata, id: "x3" }; // stessa data
    const plan = await buildSeraImportPlan([serata, dataRotta, duplicato]);
    expect(plan.skippedInvalid).toBe(2);
    expect(plan.checkins).toHaveLength(1);
  });
});
