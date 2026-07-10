import { describe, expect, it } from "vitest";
import { taskToIcs } from "./ics";

const NOW = new Date("2026-07-10T09:00:00.000Z");

const BASE = {
  id: "0198f3a0-0000-7000-8000-000000000001",
  title: "Chiamare il dentista",
  notes: null,
  date: "2026-07-10",
  time: "18:30",
};

describe("taskToIcs — snapshot", () => {
  it("task con promemoria 10 minuti prima, Europe/Rome con VTIMEZONE", () => {
    const ics = taskToIcs({
      task: BASE,
      reminderFireAt: "2026-07-10T16:20:00.000Z", // 18:20 a Roma
      timeZone: "Europe/Rome",
      now: NOW,
    });
    expect(ics).toBe(
      [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//LifeOS//Task//IT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VTIMEZONE",
        "TZID:Europe/Rome",
        "BEGIN:DAYLIGHT",
        "TZOFFSETFROM:+0100",
        "TZOFFSETTO:+0200",
        "TZNAME:CEST",
        "DTSTART:19700329T020000",
        "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
        "END:DAYLIGHT",
        "BEGIN:STANDARD",
        "TZOFFSETFROM:+0200",
        "TZOFFSETTO:+0100",
        "TZNAME:CET",
        "DTSTART:19701025T030000",
        "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
        "END:STANDARD",
        "END:VTIMEZONE",
        "BEGIN:VEVENT",
        "UID:0198f3a0-0000-7000-8000-000000000001@lifeos.local",
        "DTSTAMP:20260710T090000Z",
        "DTSTART;TZID=Europe/Rome:20260710T183000",
        "DTEND;TZID=Europe/Rome:20260710T190000",
        "SUMMARY:Chiamare il dentista",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        "DESCRIPTION:Chiamare il dentista",
        "TRIGGER:-PT10M",
        "END:VALARM",
        "END:VEVENT",
        "END:VCALENDAR",
      ].join("\r\n") + "\r\n",
    );
  });

  it("senza promemoria: allarme all'inizio (PT0S)", () => {
    const ics = taskToIcs({
      task: BASE,
      reminderFireAt: null,
      timeZone: "Europe/Rome",
      now: NOW,
    });
    expect(ics).toContain("TRIGGER:PT0S");
  });

  it("offset composto (1h30) e DTEND oltre mezzanotte", () => {
    const ics = taskToIcs({
      task: { ...BASE, date: "2026-07-10", time: "23:45" },
      reminderFireAt: "2026-07-10T20:15:00.000Z", // 22:15 Roma = 1h30 prima
      timeZone: "Europe/Rome",
      now: NOW,
    });
    expect(ics).toContain("TRIGGER:-PT1H30M");
    expect(ics).toContain("DTEND;TZID=Europe/Rome:20260711T001500");
  });

  it("escaping: virgole, punti e virgola, backslash e newline nelle note", () => {
    const ics = taskToIcs({
      task: {
        ...BASE,
        title: "Cena; con Marco, forse",
        notes: "riga uno\nriga due \\ fine",
      },
      reminderFireAt: null,
      timeZone: "Europe/Rome",
      now: NOW,
    });
    expect(ics).toContain("SUMMARY:Cena\\; con Marco\\, forse");
    expect(ics).toContain("DESCRIPTION:riga uno\\nriga due \\\\ fine");
  });

  it("le righe lunghe si piegano con CRLF + spazio e ogni riga è CRLF", () => {
    const ics = taskToIcs({
      task: {
        ...BASE,
        title:
          "Titolo molto lungo che supera senza dubbio la soglia dei settantaquattro caratteri per riga del formato iCalendar",
      },
      reminderFireAt: null,
      timeZone: "Europe/Rome",
      now: NOW,
    });
    expect(ics).toContain("\r\n "); // continuazione piegata
    // Nessun newline nudo: tolti i CRLF non resta alcun \n o \r.
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    // La riga fisica più lunga resta nel limite.
    const longest = Math.max(...ics.split("\r\n").map((l) => l.length));
    expect(longest).toBeLessThanOrEqual(75);
  });

  it("zona non-Rome degrada a istanti UTC assoluti (niente TZID orfano)", () => {
    const ics = taskToIcs({
      task: BASE,
      reminderFireAt: null,
      timeZone: "America/New_York",
      now: NOW,
    });
    expect(ics).not.toContain("VTIMEZONE");
    expect(ics).not.toContain("TZID");
    expect(ics).toContain("DTSTART:20260710T183000Z");
  });
});
