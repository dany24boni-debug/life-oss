import { describe, expect, it } from "vitest";
import {
  computeFireAt,
  derivePreset,
  instantToHhmm,
  zonedTimeToInstant,
} from "./time";

const TZ = "Europe/Rome";

describe("zonedTimeToInstant", () => {
  it("estate (CEST, +2) e inverno (CET, +1)", () => {
    expect(zonedTimeToInstant("2026-07-10", "18:30", TZ)?.toISOString()).toBe(
      "2026-07-10T16:30:00.000Z",
    );
    expect(zonedTimeToInstant("2026-01-10", "18:30", TZ)?.toISOString()).toBe(
      "2026-01-10T17:30:00.000Z",
    );
  });

  it("mezzanotte e ora di pranzo restano nel giorno civile giusto", () => {
    expect(zonedTimeToInstant("2026-07-10", "00:00", TZ)?.toISOString()).toBe(
      "2026-07-09T22:00:00.000Z",
    );
    expect(zonedTimeToInstant("2026-07-10", "12:00", "UTC")?.toISOString()).toBe(
      "2026-07-10T12:00:00.000Z",
    );
  });

  it("l'ora inesistente del salto di primavera degrada di un'ora, senza throw", () => {
    // 2026-03-29 02:30 a Roma non esiste (si salta da 02:00 a 03:00).
    const t = zonedTimeToInstant("2026-03-29", "02:30", TZ);
    expect(t).not.toBeNull();
    const wall = instantToHhmm(t!, TZ);
    expect(["01:30", "03:30"]).toContain(wall);
  });

  it("l'ora ambigua del ritorno (ottobre) risolve a un istante valido", () => {
    const t = zonedTimeToInstant("2026-10-25", "02:30", TZ);
    expect(t).not.toBeNull();
    expect(instantToHhmm(t!, TZ)).toBe("02:30");
  });

  it("input malformati -> null; zona ignota -> UTC", () => {
    expect(zonedTimeToInstant("2026-7-10", "18:30", TZ)).toBeNull();
    expect(zonedTimeToInstant("2026-07-10", "25:00", TZ)).toBeNull();
    expect(
      zonedTimeToInstant("2026-07-10", "18:30", "Not/AZone")?.toISOString(),
    ).toBe("2026-07-10T18:30:00.000Z");
  });
});

describe("computeFireAt", () => {
  it("all'orario, 10 minuti prima, 1 ora prima", () => {
    expect(computeFireAt("at_time", "2026-07-10", "18:30", TZ)).toBe(
      "2026-07-10T16:30:00.000Z",
    );
    expect(computeFireAt("before_10m", "2026-07-10", "18:30", TZ)).toBe(
      "2026-07-10T16:20:00.000Z",
    );
    expect(computeFireAt("before_1h", "2026-07-10", "18:30", TZ)).toBe(
      "2026-07-10T15:30:00.000Z",
    );
  });

  it("mattina del giorno: 08:00 locali, basta la data", () => {
    expect(computeFireAt("morning", "2026-07-10", null, TZ)).toBe(
      "2026-07-10T06:00:00.000Z",
    );
  });

  it("requisiti mancanti -> null (niente data; niente orario per i relativi)", () => {
    expect(computeFireAt("at_time", null, "18:30", TZ)).toBeNull();
    expect(computeFireAt("before_1h", "2026-07-10", null, TZ)).toBeNull();
    expect(computeFireAt("morning", null, null, TZ)).toBeNull();
  });
});

describe("derivePreset", () => {
  it("riconosce ogni preset dal fire_at esatto", () => {
    const day = "2026-07-10";
    const time = "18:30";
    for (const preset of ["at_time", "before_10m", "before_1h", "morning"] as const) {
      const fireAt = computeFireAt(preset, day, time, TZ)!;
      expect(derivePreset(day, time, fireAt, TZ)).toBe(preset);
    }
  });

  it("fire_at personalizzato o campi cambiati -> null", () => {
    expect(
      derivePreset("2026-07-10", "18:30", "2026-07-10T11:11:00.000Z", TZ),
    ).toBeNull();
    // Il fire_at era \"all'orario\" di un ALTRO orario.
    const stale = computeFireAt("at_time", "2026-07-10", "10:00", TZ)!;
    expect(derivePreset("2026-07-10", "18:30", stale, TZ)).toBeNull();
  });
});

describe("instantToHhmm", () => {
  it("etichetta l'istante nella zona giusta", () => {
    expect(instantToHhmm("2026-07-10T16:30:00.000Z", TZ)).toBe("18:30");
    expect(instantToHhmm("2026-07-10T16:30:00.000Z", "UTC")).toBe("16:30");
  });
});
