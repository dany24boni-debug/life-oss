import { describe, expect, it } from "vitest";
import {
  buildExternalEventRow,
  buildExternalEventRows,
  EXTERNAL_EVENTS_CONFLICT_TARGET,
} from "./upsert-events";
import type { NormalizedEvent } from "./calendar-client";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const ACCOUNT_ID = "00000000-0000-0000-0000-000000000002";

function ev(overrides: Partial<NormalizedEvent> = {}): NormalizedEvent {
  return {
    externalId: "abc123",
    calendarId: "primary",
    title: "Esame Marketing",
    description: null,
    location: "Aula 12",
    startsAt: "2026-05-12T07:00:00.000Z",
    endsAt: "2026-05-12T08:30:00.000Z",
    allDay: false,
    status: "confirmed",
    htmlLink: "https://example.test/event/abc123",
    ...overrides,
  };
}

describe("buildExternalEventRow", () => {
  it("maps every NormalizedEvent field to its DB column", () => {
    const fetchedAt = new Date("2026-05-10T12:00:00.000Z");
    const row = buildExternalEventRow(ev(), USER_ID, ACCOUNT_ID, fetchedAt);

    expect(row).toEqual({
      user_id: USER_ID,
      account_id: ACCOUNT_ID,
      external_id: "abc123",
      external_calendar_id: "primary",
      title: "Esame Marketing",
      description: null,
      location: "Aula 12",
      starts_at: "2026-05-12T07:00:00.000Z",
      ends_at: "2026-05-12T08:30:00.000Z",
      all_day: false,
      status: "confirmed",
      html_link: "https://example.test/event/abc123",
      fetched_at: "2026-05-10T12:00:00.000Z",
    });
  });

  it("preserves all-day flag and null end time", () => {
    const row = buildExternalEventRow(
      ev({ allDay: true, endsAt: null, startsAt: "2026-05-12T00:00:00.000Z" }),
      USER_ID,
      ACCOUNT_ID,
    );
    expect(row.all_day).toBe(true);
    expect(row.ends_at).toBeNull();
  });
});

describe("dedup contract — (account_id, external_id) UNIQUE", () => {
  // The DB enforces dedup via the UNIQUE INDEX from migration 0011. The
  // app-side contract is: if Google returns the same external_id twice
  // (across two refreshes, or duplicated in one response), every row
  // produced from those events shares the same conflict-key pair, so a
  // single UPSERT with onConflict='account_id,external_id' collapses
  // them into one DB row.

  it("two events with the same externalId produce identical conflict keys", () => {
    const a = buildExternalEventRow(ev({ title: "First fetch" }), USER_ID, ACCOUNT_ID);
    const b = buildExternalEventRow(
      ev({ title: "Second fetch — same id, edited title" }),
      USER_ID,
      ACCOUNT_ID,
    );

    expect(a.account_id).toBe(b.account_id);
    expect(a.external_id).toBe(b.external_id);

    // The non-key fields can differ (Google may have edited the event);
    // upsert-on-conflict will UPDATE those columns.
    expect(a.title).not.toBe(b.title);
  });

  it("different externalIds produce different conflict keys", () => {
    const a = buildExternalEventRow(ev({ externalId: "evt-A" }), USER_ID, ACCOUNT_ID);
    const b = buildExternalEventRow(ev({ externalId: "evt-B" }), USER_ID, ACCOUNT_ID);

    expect(`${a.account_id}|${a.external_id}`).not.toBe(
      `${b.account_id}|${b.external_id}`,
    );
  });

  it("same externalId on different accounts produces different conflict keys", () => {
    const a = buildExternalEventRow(ev(), USER_ID, "account-A");
    const b = buildExternalEventRow(ev(), USER_ID, "account-B");

    // External_id is the SAME (same Google event), but account_id differs
    // — so the conflict-key pair is different and both rows can coexist.
    expect(a.external_id).toBe(b.external_id);
    expect(a.account_id).not.toBe(b.account_id);
  });

  it("buildExternalEventRows preserves order and one row per input", () => {
    const events = [
      ev({ externalId: "a" }),
      ev({ externalId: "b" }),
      ev({ externalId: "c" }),
    ];
    const rows = buildExternalEventRows(events, USER_ID, ACCOUNT_ID);
    expect(rows.map((r) => r.external_id)).toEqual(["a", "b", "c"]);
  });

  it("EXTERNAL_EVENTS_CONFLICT_TARGET matches the migration's UNIQUE INDEX", () => {
    // Sanity: the constant the actions.ts files pass to .upsert() must
    // line up with the column list in migration 0011's
    //   uniq_ext_calendar_event_per_account (account_id, external_id)
    expect(EXTERNAL_EVENTS_CONFLICT_TARGET).toBe("account_id,external_id");
  });
});
