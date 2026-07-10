import { describe, expect, it } from "vitest";
import {
  mergeAgendaEvents,
  partitionByCutoff,
  type ExternalAgendaEvent,
  type LocalAgendaEntry,
} from "./merge";

function local(overrides: Partial<LocalAgendaEntry> = {}): LocalAgendaEntry {
  return {
    id: "L1",
    custom_module_id: "M1",
    date: "2026-05-12",
    label: "Pattinaggio",
    notes: null,
    ...overrides,
  };
}

function ext(overrides: Partial<ExternalAgendaEvent> = {}): ExternalAgendaEvent {
  return {
    id: "row-1",
    external_id: "g-1",
    title: "Esame Marketing",
    description: null,
    location: "Aula 12",
    starts_at: "2026-05-12T07:00:00.000Z",
    ends_at: "2026-05-12T08:30:00.000Z",
    all_day: false,
    status: "confirmed",
    html_link: "https://example.test/event/g-1",
    ...overrides,
  };
}

describe("mergeAgendaEvents", () => {
  it("returns an empty list when both sources are empty", () => {
    expect(mergeAgendaEvents([], [])).toEqual([]);
  });

  it("returns local-only events tagged source=local", () => {
    const out = mergeAgendaEvents([local()], []);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("local");
    expect(out[0].id).toBe("local:L1");
    expect(out[0].allDay).toBe(true);
    expect(out[0].startsAt).toBe("2026-05-12T00:00:00.000Z");
  });

  it("returns external-only events tagged source=google", () => {
    const out = mergeAgendaEvents([], [ext()]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("google");
    expect(out[0].id).toBe("google:g-1");
    expect(out[0].htmlLink).toBe("https://example.test/event/g-1");
  });

  it("interleaves and sorts by startsAt across sources", () => {
    const localA = local({ id: "L-A", date: "2026-05-13" });            // → 13T00:00
    const localB = local({ id: "L-B", date: "2026-05-12" });            // → 12T00:00
    const extA = ext({ external_id: "g-A", starts_at: "2026-05-12T07:00:00.000Z" });
    const extB = ext({ external_id: "g-B", starts_at: "2026-05-14T18:00:00.000Z" });

    const out = mergeAgendaEvents([localA, localB], [extA, extB]);
    expect(out.map((e) => e.id)).toEqual([
      "local:L-B",   // 12T00:00 — earliest
      "google:g-A",  // 12T07:00
      "local:L-A",   // 13T00:00
      "google:g-B",  // 14T18:00
    ]);
  });

  it("drops cancelled external events", () => {
    const out = mergeAgendaEvents(
      [],
      [
        ext({ external_id: "alive", status: "confirmed" }),
        ext({ external_id: "dead", status: "cancelled" }),
        ext({ external_id: "tentative", status: "tentative" }),
      ],
    );
    expect(out.map((e) => e.id)).toEqual([
      "google:alive",
      "google:tentative", // 'tentative' is kept — only 'cancelled' is dropped
    ]);
  });

  it("falls back to a placeholder title when label/title is missing or blank", () => {
    const out = mergeAgendaEvents(
      [local({ id: "blank-label", label: "" }), local({ id: "ws-label", label: "   " })],
      [ext({ external_id: "no-title", title: null })],
    );
    expect(out.map((e) => e.title)).toEqual([
      "(senza titolo)",
      "(senza titolo)",
      "(senza titolo)",
    ]);
  });

  it("preserves all-day flag and null endsAt on locals", () => {
    const out = mergeAgendaEvents([local()], []);
    expect(out[0].allDay).toBe(true);
    expect(out[0].endsAt).toBeNull();
  });

  it("preserves location + description on external events", () => {
    const out = mergeAgendaEvents(
      [],
      [ext({ description: "Bring laptop", location: "Aula 12" })],
    );
    expect(out[0].description).toBe("Bring laptop");
    expect(out[0].location).toBe("Aula 12");
  });

  it("guarantees a stable, distinct id namespace per source", () => {
    // Locals get "local:<entry_id>", externals get "google:<external_id>".
    // Even if a local entry happened to have id "g-1", they couldn't collide.
    const out = mergeAgendaEvents(
      [local({ id: "g-1" })],
      [ext({ external_id: "g-1" })],
    );
    const ids = out.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("local:g-1");
    expect(ids).toContain("google:g-1");
  });
});

describe("partitionByCutoff", () => {
  it("splits events into near (< cutoff) and far (>= cutoff)", () => {
    const events = mergeAgendaEvents(
      [
        local({ id: "today", date: "2026-05-10" }),
        local({ id: "tomorrow", date: "2026-05-11" }),
        local({ id: "next-week", date: "2026-05-17" }),
        local({ id: "next-month", date: "2026-06-15" }),
      ],
      [],
    );

    // 7-day cutoff from 2026-05-10
    const cutoff = "2026-05-17T00:00:00.000Z";
    const { near, far } = partitionByCutoff(events, cutoff);
    expect(near.map((e) => e.id)).toEqual(["local:today", "local:tomorrow"]);
    expect(far.map((e) => e.id)).toEqual(["local:next-week", "local:next-month"]);
  });

  it("handles empty input", () => {
    const { near, far } = partitionByCutoff([], "2026-05-12T00:00:00.000Z");
    expect(near).toEqual([]);
    expect(far).toEqual([]);
  });
});
