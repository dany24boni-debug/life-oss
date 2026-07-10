/**
 * Merge local agenda entries (custom_module_entries with kind=calendar)
 * with imported external events (external_calendar_events) into a
 * single source-tagged, time-sorted feed for the /agenda view.
 *
 * No timezone math here — caller-supplied ISO strings are compared
 * lexicographically, which is correct because they're all in UTC. The
 * UI layer formats them in profiles.timezone for display.
 */

export type UnifiedSource = "local" | "google";

export type UnifiedEvent = {
  /** Globally unique within a merged set: "local:<entry_id>" or "google:<external_id>". */
  id: string;
  source: UnifiedSource;
  title: string;
  description: string | null;
  location: string | null;
  /** ISO-8601 UTC. Local entries (date-only) are coerced to midnight UTC. */
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  /** Provider deep-link, when applicable (google only in V0). */
  htmlLink: string | null;
  /** For local events, the custom module this entry belongs to. */
  customModuleId: string | null;
};

export type LocalAgendaEntry = {
  id: string;
  custom_module_id: string;
  date: string;            // 'YYYY-MM-DD'
  label: string | null;
  notes: string | null;
};

export type ExternalAgendaEvent = {
  id: string;
  external_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  starts_at: string;       // ISO-8601 UTC
  ends_at: string | null;
  all_day: boolean;
  status: string | null;   // 'confirmed' | 'tentative' | 'cancelled' | null
  html_link: string | null;
};

const FALLBACK_TITLE = "(senza titolo)";

function localEntryToUnified(l: LocalAgendaEntry): UnifiedEvent {
  return {
    id: `local:${l.id}`,
    source: "local",
    title: l.label?.trim() ? l.label : FALLBACK_TITLE,
    description: l.notes,
    location: null,
    startsAt: `${l.date}T00:00:00.000Z`,
    endsAt: null,
    allDay: true,
    htmlLink: null,
    customModuleId: l.custom_module_id,
  };
}

function externalEventToUnified(e: ExternalAgendaEvent): UnifiedEvent {
  return {
    id: `google:${e.external_id}`,
    source: "google",
    title: e.title?.trim() ? e.title : FALLBACK_TITLE,
    description: e.description,
    location: e.location,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    allDay: e.all_day,
    htmlLink: e.html_link,
    customModuleId: null,
  };
}

/**
 * Merge + sort. Cancelled external events are dropped (Google sometimes
 * returns them via singleEvents=true with status=cancelled when an
 * occurrence of a recurring event was deleted).
 */
export function mergeAgendaEvents(
  local: LocalAgendaEntry[],
  external: ExternalAgendaEvent[],
): UnifiedEvent[] {
  const out: UnifiedEvent[] = [];

  for (const l of local) {
    out.push(localEntryToUnified(l));
  }

  for (const e of external) {
    if (e.status === "cancelled") continue;
    out.push(externalEventToUnified(e));
  }

  // ISO-8601 UTC strings sort correctly lexicographically.
  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return out;
}

/**
 * Group a unified list by a coarser bucket — used by the /agenda view
 * to render "Prossimi 7 giorni" vs "Più avanti (≤30 giorni)" sections.
 *
 * The cutoff is an ISO-8601 string; events with startsAt < cutoff fall
 * in `near`, the rest in `far`.
 */
export function partitionByCutoff(
  events: UnifiedEvent[],
  cutoffIso: string,
): { near: UnifiedEvent[]; far: UnifiedEvent[] } {
  const near: UnifiedEvent[] = [];
  const far: UnifiedEvent[] = [];
  for (const e of events) {
    if (e.startsAt < cutoffIso) near.push(e);
    else far.push(e);
  }
  return { near, far };
}

/**
 * Format a UTC ISO timestamp as a 'YYYY-MM-DD' date string in the
 * given IANA timezone. Used to bucket events into per-day groups
 * regardless of the underlying instant's UTC date.
 *
 * Example: an event at "2026-05-12T22:30:00.000Z" displayed in
 * Europe/Rome (UTC+2 in summer) belongs to date "2026-05-13".
 */
export function eventDateInTimezone(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 'en-CA' produces ISO YYYY-MM-DD by default — locale-stable.
  return d.toLocaleDateString("en-CA", { timeZone: timezone });
}

export type AgendaDayGroup = {
  /** 'YYYY-MM-DD' in the user's timezone. */
  date: string;
  events: UnifiedEvent[];
};

/**
 * Bucket events by their date (in the user's timezone), preserving
 * the input order within each bucket. Output is already chronological
 * because mergeAgendaEvents sorts by startsAt UTC, and date-in-tz is
 * monotonic with startsAt for any single timezone.
 */
export function groupEventsByDay(
  events: UnifiedEvent[],
  timezone: string,
): AgendaDayGroup[] {
  const map = new Map<string, UnifiedEvent[]>();
  for (const e of events) {
    const key = eventDateInTimezone(e.startsAt, timezone);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(e);
    else map.set(key, [e]);
  }
  return Array.from(map, ([date, evs]) => ({ date, events: evs }));
}

/**
 * Drop events whose date-in-timezone is strictly before `todayYmd`.
 * Events on the current day are kept regardless of whether they've
 * already started — the user expects "today's agenda" to remain
 * visible until the day rolls over.
 */
export function filterFromDay(
  events: UnifiedEvent[],
  todayYmd: string,
  timezone: string,
): UnifiedEvent[] {
  return events.filter(
    (e) => eventDateInTimezone(e.startsAt, timezone) >= todayYmd,
  );
}
