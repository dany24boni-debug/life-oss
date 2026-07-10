import { describe, expect, it } from "vitest";
import {
  findInPresenceDays,
  isInPresenceDay,
  isCommuteWindow,
  isCommuteActive,
} from "./in-presence";
import type { ExternalAgendaEvent } from "@/lib/agenda/merge";

const TZ = "Europe/Rome";

function ev(overrides: Partial<ExternalAgendaEvent> = {}): ExternalAgendaEvent {
  return {
    id: "row-1",
    external_id: "g-1",
    title: "Cena con Marco",
    description: null,
    location: null,
    starts_at: "2026-05-12T18:00:00.000Z",
    ends_at: "2026-05-12T20:00:00.000Z",
    all_day: false,
    status: "confirmed",
    html_link: null,
    ...overrides,
  };
}

describe("findInPresenceDays", () => {
  it("returns an empty set when no events match keywords", () => {
    const out = findInPresenceDays(
      [ev({ title: "Cena" }), ev({ title: "Cinema con amici", external_id: "g-2" })],
      TZ,
    );
    expect(out.size).toBe(0);
  });

  it("matches a university keyword in the title", () => {
    const out = findInPresenceDays(
      [ev({ title: "Lezione di Matematica", starts_at: "2026-05-12T07:00:00.000Z" })],
      TZ,
    );
    expect(out.has("2026-05-12")).toBe(true);
  });

  it("matches keywords in the location even when title is generic", () => {
    const out = findInPresenceDays(
      [ev({ title: "Marketing", location: "Università Aula 3", starts_at: "2026-05-13T09:00:00.000Z" })],
      TZ,
    );
    expect(out.has("2026-05-13")).toBe(true);
  });

  it("skips cancelled events", () => {
    const out = findInPresenceDays(
      [
        ev({ title: "Lezione di Storia", status: "cancelled" }),
        ev({ external_id: "g-2", title: "Esame Marketing", status: "confirmed", starts_at: "2026-05-15T08:00:00.000Z" }),
      ],
      TZ,
    );
    expect(out.has("2026-05-12")).toBe(false); // cancelled lecture skipped
    expect(out.has("2026-05-15")).toBe(true);  // confirmed exam kept
  });

  it("collapses multiple in-presence events on the same day to one entry", () => {
    const out = findInPresenceDays(
      [
        ev({ external_id: "g-a", title: "Lezione mattina", starts_at: "2026-05-12T08:00:00.000Z" }),
        ev({ external_id: "g-b", title: "Lezione Marketing", location: "Aula 4", starts_at: "2026-05-12T11:00:00.000Z" }),
        ev({ external_id: "g-c", title: "Esame finale", starts_at: "2026-05-12T15:00:00.000Z" }),
      ],
      TZ,
    );
    expect(out.size).toBe(1);
    expect(out.has("2026-05-12")).toBe(true);
  });

  it("places late-evening events on the local-tz date, not UTC", () => {
    // 2026-05-13T22:30:00Z = 2026-05-14T00:30 in Europe/Rome (UTC+2 summer).
    const out = findInPresenceDays(
      [ev({ title: "Lezione serale", starts_at: "2026-05-13T22:30:00.000Z" })],
      TZ,
    );
    expect(out.has("2026-05-14")).toBe(true);
    expect(out.has("2026-05-13")).toBe(false);
  });

  it("is case-insensitive across title and keyword", () => {
    const out = findInPresenceDays(
      [ev({ title: "LEZIONE di MATEMATICA", starts_at: "2026-05-20T09:00:00.000Z" })],
      TZ,
    );
    expect(out.has("2026-05-20")).toBe(true);
  });

  it("matches the generic 'on-site' English keyword", () => {
    const out = findInPresenceDays(
      [ev({ title: "Team meeting (on-site)", starts_at: "2026-05-21T09:00:00.000Z" })],
      TZ,
    );
    expect(out.has("2026-05-21")).toBe(true);
  });
});

describe("isInPresenceDay", () => {
  it("returns true when the day has an in-presence event", () => {
    const events = [ev({ title: "Lezione Marketing", starts_at: "2026-05-12T07:00:00.000Z" })];
    expect(isInPresenceDay(events, TZ, "2026-05-12")).toBe(true);
  });

  it("returns false when the day has no in-presence event", () => {
    const events = [ev({ title: "Cinema", starts_at: "2026-05-12T20:00:00.000Z" })];
    expect(isInPresenceDay(events, TZ, "2026-05-12")).toBe(false);
  });
});

describe("isCommuteWindow", () => {
  // Reminder: Europe/Rome in May is UTC+2 (CEST). 08:00 Rome = 06:00 UTC.

  it("morning window: 08:00 Rome → true", () => {
    expect(isCommuteWindow(new Date("2026-05-12T06:00:00Z"), TZ)).toBe(true);
  });

  it("morning window inclusive start: 07:00 Rome → true", () => {
    expect(isCommuteWindow(new Date("2026-05-12T05:00:00Z"), TZ)).toBe(true);
  });

  it("morning window exclusive end: 09:30 Rome → false", () => {
    expect(isCommuteWindow(new Date("2026-05-12T07:30:00Z"), TZ)).toBe(false);
  });

  it("midday outside both windows: 12:00 Rome → false", () => {
    expect(isCommuteWindow(new Date("2026-05-12T10:00:00Z"), TZ)).toBe(false);
  });

  it("evening window: 18:30 Rome → true", () => {
    expect(isCommuteWindow(new Date("2026-05-12T16:30:00Z"), TZ)).toBe(true);
  });

  it("evening window exclusive end: 19:30 Rome → false", () => {
    expect(isCommuteWindow(new Date("2026-05-12T17:30:00Z"), TZ)).toBe(false);
  });

  it("late night: 23:30 Rome → false", () => {
    expect(isCommuteWindow(new Date("2026-05-12T21:30:00Z"), TZ)).toBe(false);
  });
});

describe("isCommuteActive", () => {
  const LECTURE_EV = ev({ title: "Lezione di Storia", starts_at: "2026-05-12T07:30:00.000Z" });

  it("in-presence day + within commute window → true", () => {
    // 08:00 Rome on a day with a lecture event
    expect(isCommuteActive([LECTURE_EV], TZ, new Date("2026-05-12T06:00:00Z"))).toBe(true);
  });

  it("in-presence day + outside commute window → false", () => {
    // 14:00 Rome on a day with a lecture event
    expect(isCommuteActive([LECTURE_EV], TZ, new Date("2026-05-12T12:00:00Z"))).toBe(false);
  });

  it("remote day + within commute window → false", () => {
    const cinemaOnly = ev({ title: "Cinema", starts_at: "2026-05-12T20:00:00.000Z" });
    expect(isCommuteActive([cinemaOnly], TZ, new Date("2026-05-12T06:00:00Z"))).toBe(false);
  });

  it("no events + within commute window → false", () => {
    expect(isCommuteActive([], TZ, new Date("2026-05-12T06:00:00Z"))).toBe(false);
  });
});
