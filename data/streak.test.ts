import { describe, expect, it } from "vitest";
import {
  civilDayInZone,
  computeStreak,
  dayRange,
  shiftDay,
  type StreakInput,
} from "./streak";

function streak(input: {
  active?: string[];
  protected?: string[];
  today: string;
}) {
  const args: StreakInput = {
    activityDays: new Set(input.active ?? []),
    protectedDays: new Set(input.protected ?? []),
    today: input.today,
  };
  return computeStreak(args);
}

describe("computeStreak — catene normali", () => {
  it("zero attività: tutto a zero", () => {
    expect(streak({ today: "2026-07-10" })).toEqual({
      current: 0,
      best: 0,
      todayCounts: false,
    });
  });

  it("tre giorni consecutivi fino a oggi", () => {
    const s = streak({
      active: ["2026-07-08", "2026-07-09", "2026-07-10"],
      today: "2026-07-10",
    });
    expect(s).toEqual({ current: 3, best: 3, todayCounts: true });
  });

  it("oggi senza attività è in sospeso, non rompe: la catena arriva a ieri", () => {
    const s = streak({
      active: ["2026-07-08", "2026-07-09"],
      today: "2026-07-10",
    });
    expect(s).toEqual({ current: 2, best: 2, todayCounts: false });
  });

  it("un buco non protetto spezza: current riparte, best ricorda", () => {
    const s = streak({
      active: ["2026-07-05", "2026-07-06", "2026-07-07", "2026-07-10"],
      today: "2026-07-10",
    });
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
    expect(s.todayCounts).toBe(true);
  });

  it("ieri buco e oggi inattivo: streak a zero (riparti oggi, senza drammi)", () => {
    const s = streak({
      active: ["2026-07-07"],
      today: "2026-07-10",
    });
    expect(s.current).toBe(0);
    expect(s.best).toBe(1);
  });
});

describe("computeStreak — giorni protetti", () => {
  it("un giorno protetto fa da ponte e non conta", () => {
    const s = streak({
      active: ["2026-07-08", "2026-07-10"],
      protected: ["2026-07-09"],
      today: "2026-07-10",
    });
    expect(s).toEqual({ current: 2, best: 2, todayCounts: true });
  });

  it("una vacanza intera (più giorni protetti) tiene la catena", () => {
    const s = streak({
      active: ["2026-07-01", "2026-07-02", "2026-07-10"],
      protected: dayRange("2026-07-03", "2026-07-09"),
      today: "2026-07-10",
    });
    expect(s).toEqual({ current: 3, best: 3, todayCounts: true });
  });

  it("protetto in coda con oggi in sospeso: la streak si conserva", () => {
    // Attivo venerdì, sabato protetto, domenica (oggi) ancora niente.
    const s = streak({
      active: ["2026-07-10"],
      protected: ["2026-07-11"],
      today: "2026-07-12",
    });
    expect(s).toEqual({ current: 1, best: 1, todayCounts: false });
  });

  it("il ponte regge solo se TUTTI i giorni in mezzo sono protetti", () => {
    const s = streak({
      active: ["2026-07-06", "2026-07-10"],
      protected: ["2026-07-07", "2026-07-09"], // l'8 è scoperto
      today: "2026-07-10",
    });
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });

  it("giorni solo protetti, mai attivi: nessuna streak inventata", () => {
    const s = streak({
      protected: dayRange("2026-07-01", "2026-07-10"),
      today: "2026-07-10",
    });
    expect(s).toEqual({ current: 0, best: 0, todayCounts: false });
  });

  it("un giorno sia attivo sia protetto conta come attivo", () => {
    const s = streak({
      active: ["2026-07-09", "2026-07-10"],
      protected: ["2026-07-09"],
      today: "2026-07-10",
    });
    expect(s.current).toBe(2);
  });
});

describe("computeStreak — best storico", () => {
  it("best considera anche catene lontane con ponti protetti", () => {
    const s = streak({
      active: ["2026-01-01", "2026-01-02", "2026-01-04", "2026-07-10"],
      protected: ["2026-01-03"],
      today: "2026-07-10",
    });
    expect(s.best).toBe(3); // 1-2 (ponte 3) 4
    expect(s.current).toBe(1);
  });

  it("best non è mai sotto current", () => {
    const s = streak({
      active: ["2026-07-09", "2026-07-10"],
      today: "2026-07-10",
    });
    expect(s.best).toBeGreaterThanOrEqual(s.current);
  });
});

describe("aritmetica dei giorni — DST e confini", () => {
  it("shiftDay attraversa i giorni DST come giorni normali (+1 civile)", () => {
    // Europa: ingresso ora legale 2026-03-29 (23h), uscita 2026-10-25 (25h).
    expect(shiftDay("2026-03-28", 1)).toBe("2026-03-29");
    expect(shiftDay("2026-03-29", 1)).toBe("2026-03-30");
    expect(shiftDay("2026-10-24", 1)).toBe("2026-10-25");
    expect(shiftDay("2026-10-25", 1)).toBe("2026-10-26");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("una catena attraverso il cambio d'ora conta giorno per giorno", () => {
    const s = streak({
      active: ["2026-03-28", "2026-03-29", "2026-03-30"],
      today: "2026-03-30",
    });
    expect(s.current).toBe(3);
  });

  it("dayRange è inclusivo e gestisce il cambio mese", () => {
    expect(dayRange("2026-07-30", "2026-08-02")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
    expect(dayRange("2026-07-10", "2026-07-09")).toEqual([]);
  });
});

describe("civilDayInZone — timezone iniettata", () => {
  it("lo stesso istante cade in giorni diversi per zone diverse", () => {
    const instant = "2026-07-10T22:30:00.000Z";
    expect(civilDayInZone(instant, "Europe/Rome")).toBe("2026-07-11"); // 00:30
    expect(civilDayInZone(instant, "UTC")).toBe("2026-07-10");
  });

  it("notte del cambio d'ora di marzo: 01:30 UTC è 03:30 a Roma (già CEST)", () => {
    expect(civilDayInZone("2026-03-29T01:30:00.000Z", "Europe/Rome")).toBe(
      "2026-03-29",
    );
    // Poco prima del salto: 00:30 UTC = 01:30 CET, stesso giorno.
    expect(civilDayInZone("2026-03-29T00:30:00.000Z", "Europe/Rome")).toBe(
      "2026-03-29",
    );
  });

  it("notte del ritorno all'ora solare (ottobre, giorno da 25 ore)", () => {
    // 00:30 UTC = 02:30 CEST (prima del ritorno) -> 25 ottobre.
    expect(civilDayInZone("2026-10-25T00:30:00.000Z", "Europe/Rome")).toBe(
      "2026-10-25",
    );
    // 23:30 UTC del 25 = 00:30 CET del 26.
    expect(civilDayInZone("2026-10-25T23:30:00.000Z", "Europe/Rome")).toBe(
      "2026-10-26",
    );
  });

  it("zona non valida degrada a UTC senza lanciare", () => {
    expect(civilDayInZone("2026-07-10T22:30:00.000Z", "Not/AZone")).toBe(
      "2026-07-10",
    );
  });

  it("accetta anche Date, non solo stringhe", () => {
    expect(
      civilDayInZone(new Date("2026-07-10T05:00:00.000Z"), "Europe/Rome"),
    ).toBe("2026-07-10");
  });
});
