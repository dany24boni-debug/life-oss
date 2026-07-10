import { describe, expect, it } from "vitest";
import {
  addDays,
  daysInMonth,
  formatDayShortIt,
  fromEpochDays,
  isLeapYear,
  isoWeekday,
  isValidDate,
  toEpochDays,
  todayInTimeZone,
  toIso,
} from "./civil";

describe("aritmetica civile", () => {
  it("ancore note: epoch, y2k, oggi", () => {
    expect(toEpochDays({ y: 1970, m: 1, d: 1 })).toBe(0);
    expect(fromEpochDays(0)).toEqual({ y: 1970, m: 1, d: 1 });
    expect(isoWeekday({ y: 1970, m: 1, d: 1 })).toBe(4); // giovedì
    expect(isoWeekday({ y: 2026, m: 7, d: 10 })).toBe(5); // venerdì
    expect(isoWeekday({ y: 2000, m: 1, d: 1 })).toBe(6); // sabato
  });

  it("round-trip per 3000 giorni attorno a oggi", () => {
    const base = toEpochDays({ y: 2026, m: 7, d: 10 });
    for (let i = -1500; i < 1500; i++) {
      expect(toEpochDays(fromEpochDays(base + i))).toBe(base + i);
    }
  });

  it("addDays attraversa mesi e anni", () => {
    expect(addDays({ y: 2026, m: 12, d: 31 }, 1)).toEqual({
      y: 2027,
      m: 1,
      d: 1,
    });
    expect(addDays({ y: 2026, m: 3, d: 1 }, -1)).toEqual({
      y: 2026,
      m: 2,
      d: 28,
    });
    expect(addDays({ y: 2028, m: 3, d: 1 }, -1)).toEqual({
      y: 2028,
      m: 2,
      d: 29, // 2028 bisestile
    });
  });

  it("bisestili e validità", () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2100)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(isValidDate(2026, 2, 29)).toBe(false);
    expect(isValidDate(2028, 2, 29)).toBe(true);
    expect(isValidDate(2026, 4, 31)).toBe(false);
  });

  it("toIso azzeropadda", () => {
    expect(toIso({ y: 2026, m: 7, d: 5 })).toBe("2026-07-05");
  });

  it("todayInTimeZone: stesso istante, giorni civili diversi", () => {
    const instant = new Date("2026-07-10T22:30:00Z");
    expect(todayInTimeZone(instant, "Europe/Rome")).toEqual({
      y: 2026,
      m: 7,
      d: 11, // 00:30 dell'11 a Roma (UTC+2 in estate)
    });
    expect(todayInTimeZone(instant, "America/New_York")).toEqual({
      y: 2026,
      m: 7,
      d: 10, // 18:30 del 10 a New York
    });
  });

  it("todayInTimeZone: timezone non valida degrada a UTC senza lanciare", () => {
    const instant = new Date("2026-07-10T22:30:00Z");
    expect(todayInTimeZone(instant, "Marte/Olympus")).toEqual({
      y: 2026,
      m: 7,
      d: 10,
    });
  });

  it("formatDayShortIt produce l'etichetta chip italiana", () => {
    expect(formatDayShortIt({ y: 2026, m: 7, d: 10 })).toBe("ven 10 lug");
    expect(formatDayShortIt({ y: 2026, m: 12, d: 25 })).toBe("ven 25 dic");
  });
});
