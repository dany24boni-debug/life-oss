/**
 * Pure mapping from a NormalizedEvent (Google API output) to the
 * external_calendar_events DB row shape. Extracted so the dedup
 * contract can be unit-tested without a live Supabase client.
 *
 * DB-level dedup is enforced by the UNIQUE INDEX on
 * (account_id, external_id) defined in migration 0011 — every row
 * produced here participates in that constraint via the same key
 * pair, so a re-fetch of the same Google event UPDATEs the row
 * instead of inserting a duplicate.
 */

import type { NormalizedEvent } from "@/lib/google/calendar-client";

export type ExternalEventRow = {
  user_id: string;
  account_id: string;
  external_id: string;
  external_calendar_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  status: string | null;
  html_link: string | null;
  fetched_at: string;
};

/** Conflict target used by the upsert call site. */
export const EXTERNAL_EVENTS_CONFLICT_TARGET = "account_id,external_id" as const;

export function buildExternalEventRow(
  ev: NormalizedEvent,
  userId: string,
  accountId: string,
  fetchedAt: Date = new Date(),
): ExternalEventRow {
  return {
    user_id: userId,
    account_id: accountId,
    external_id: ev.externalId,
    external_calendar_id: ev.calendarId,
    title: ev.title,
    description: ev.description,
    location: ev.location,
    starts_at: ev.startsAt,
    ends_at: ev.endsAt,
    all_day: ev.allDay,
    status: ev.status,
    html_link: ev.htmlLink,
    fetched_at: fetchedAt.toISOString(),
  };
}

export function buildExternalEventRows(
  events: NormalizedEvent[],
  userId: string,
  accountId: string,
  fetchedAt: Date = new Date(),
): ExternalEventRow[] {
  return events.map((e) => buildExternalEventRow(e, userId, accountId, fetchedAt));
}
