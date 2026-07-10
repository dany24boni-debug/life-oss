import { describe, expect, it } from "vitest";
import { LocalEventSchema } from "@/data/schemas";
import {
  buildAgendaImportPlan,
  type LegacyAgendaEntryRow,
} from "./importer";

const cena: LegacyAgendaEntryRow = {
  id: "cccc3333-0000-4000-8000-000000000001",
  date: "2026-07-18",
  label: "  Cena con Marco  ",
  notes: "Portare il vino",
  created_at: "2026-06-01T10:00:00+00:00",
};

const lezione: LegacyAgendaEntryRow = {
  id: "cccc3333-0000-4000-8000-000000000002",
  date: "2026-07-20",
  label: "Lezione di analisi",
  notes: "   ",
  created_at: null,
};

describe("buildAgendaImportPlan — mappatura pura /agenda legacy", () => {
  it("mappa una riga legacy in un evento tutto-il-giorno valido", async () => {
    const plan = await buildAgendaImportPlan([cena]);
    expect(plan.skippedInvalid).toBe(0);
    expect(plan.events).toHaveLength(1);
    const ev = plan.events[0];
    // Ogni riga importata deve passare lo schema entità (fonte unica).
    expect(LocalEventSchema.parse(ev)).toEqual(ev);
    expect(ev.title).toBe("Cena con Marco"); // trim applicato
    expect(ev.date).toBe("2026-07-18");
    expect(ev.all_day).toBe(true);
    expect(ev.start_time).toBeNull();
    expect(ev.end_time).toBeNull();
    expect(ev.notes).toBe("Portare il vino");
    expect(ev.created_at).toBe("2026-06-01T10:00:00.000Z");
    expect(ev.updated_at).toBe(ev.created_at);
    expect(ev.deleted_at).toBeNull();
  });

  it("è deterministico: stesso input → stesse righe (id inclusi)", async () => {
    const a = await buildAgendaImportPlan([cena, lezione]);
    const b = await buildAgendaImportPlan([cena, lezione]);
    expect(a).toEqual(b);
    // Id diversi per righe diverse.
    expect(a.events[0].id).not.toBe(a.events[1].id);
  });

  it("note vuote → null; created_at mancante → istante di fallback", async () => {
    const plan = await buildAgendaImportPlan([lezione]);
    const ev = plan.events[0];
    expect(ev.notes).toBeNull();
    expect(ev.created_at).toBe("2026-01-01T00:00:00.000Z");
    expect(LocalEventSchema.parse(ev)).toEqual(ev);
  });

  it("salta righe senza titolo o con data malformata, contandole", async () => {
    const senzaLabel: LegacyAgendaEntryRow = {
      id: "cccc3333-0000-4000-8000-000000000003",
      date: "2026-07-21",
      label: null,
      notes: null,
      created_at: null,
    };
    const labelVuota: LegacyAgendaEntryRow = {
      ...senzaLabel,
      id: "cccc3333-0000-4000-8000-000000000004",
      label: "   ",
    };
    const dataRotta: LegacyAgendaEntryRow = {
      ...cena,
      id: "cccc3333-0000-4000-8000-000000000005",
      date: "18/07/2026",
    };
    const plan = await buildAgendaImportPlan([
      senzaLabel,
      labelVuota,
      dataRotta,
      cena,
    ]);
    expect(plan.skippedInvalid).toBe(3);
    expect(plan.events).toHaveLength(1);
    expect(plan.events[0].title).toBe("Cena con Marco");
  });

  it("tronca titolo a 500 e note a 2000 (cap dello schema)", async () => {
    const lunga: LegacyAgendaEntryRow = {
      id: "cccc3333-0000-4000-8000-000000000006",
      date: "2026-08-01",
      label: "x".repeat(900),
      notes: "y".repeat(5000),
      created_at: "2026-06-01T10:00:00+00:00",
    };
    const plan = await buildAgendaImportPlan([lunga]);
    const ev = plan.events[0];
    expect(ev.title).toHaveLength(500);
    expect(ev.notes).toHaveLength(2000);
    expect(LocalEventSchema.parse(ev)).toEqual(ev);
  });
});
