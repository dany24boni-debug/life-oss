import { describe, expect, it } from "vitest";
import { eventParse, toEventCreate } from "./event-parse";

// Venerdì 10 luglio 2026, mattina a Roma (CEST).
const NOW = new Date("2026-07-10T08:00:00.000Z");
const TODAY = "2026-07-10";
const NONE = new Set<string>();

function mustParse(input: string, defaultDate = TODAY) {
  const r = eventParse(input, NOW, NONE, defaultDate, false, TODAY);
  if (!r) throw new Error("parse nullo");
  return r;
}

describe("eventParse — il quick-add degli eventi", () => {
  it('"cena con Marco ven 20:30" -> titolo, giorno, inizio', () => {
    const r = mustParse("cena con Marco ven 20:30");
    expect(r.title).toBe("cena con Marco");
    // "ven" strettamente futuro rispetto a venerdì 10 = venerdì 17.
    expect(r.date).toBe("2026-07-17");
    expect(r.time).toBe("20:30");
    expect(r.chips.map((c) => c.kind).sort()).toEqual(["date", "time"]);
  });

  it("senza data dal testo vale il giorno selezionato, come chip attenuato", () => {
    const r = mustParse("dentista alle 15", "2026-07-22");
    expect(r.title).toBe("dentista");
    expect(r.date).toBe("2026-07-22");
    expect(r.time).toBe("15:00");
    expect(r.chips.some((c) => c.muted)).toBe(true);
  });

  it("priorità, tag e hint modulo restano testo: gli eventi non li hanno", () => {
    const r = mustParse("palestra #salute !! domani");
    expect(r.date).toBe("2026-07-11");
    expect(r.title).toBe("palestra #salute !!");
    expect(r.chips.every((c) => c.kind === "date" || c.kind === "time")).toBe(
      true,
    );
  });

  it("dismissare il chip data fa decadere la data (e il testo torna)", () => {
    const first = mustParse("pranzo domani");
    const dateChip = first.chips.find((c) => c.kind === "date");
    const r = eventParse(
      "pranzo domani",
      NOW,
      new Set([dateChip!.key]),
      TODAY,
      true, // anche il default dismesso: nessuna data
      TODAY,
    );
    expect(r?.date).toBeUndefined();
    expect(r?.title).toBe("pranzo domani");
  });
});

describe("toEventCreate — la regola della durata", () => {
  it("con inizio: fine +1h, non tutto il giorno", () => {
    const create = toEventCreate({
      title: "Cena",
      date: "2026-07-17",
      time: "20:30",
      chips: [],
    });
    expect(create).toEqual({
      title: "Cena",
      date: "2026-07-17",
      start_time: "20:30",
      end_time: "21:30",
      all_day: false,
    });
  });

  it("senza orario: tutto il giorno, niente fine", () => {
    const create = toEventCreate({
      title: "Compleanno",
      date: "2026-07-17",
      chips: [],
    });
    expect(create.all_day).toBe(true);
    expect(create.start_time).toBeNull();
    expect(create.end_time).toBeNull();
  });
});
