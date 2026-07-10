// AgendaDayGroup — header for a single day + the events that fall on
// it, rendered without per-row date repetition.
//
// Header label rules (Italian):
//   - 'YYYY-MM-DD' == today in the user's timezone → "Oggi"
//   - == today + 1 → "Domani"
//   - else → weekday + day + month abbreviation, e.g. "Lun 12 mag"
//
// The day count badge in the header is decorative; if the group has 1
// event we still show "1 evento" rather than singular/plural collapsing.

import type { AgendaDayGroup as DayGroup } from "@/lib/agenda/merge";
import { AgendaEventRow } from "./agenda-event-row";

type Props = {
  group: DayGroup;
  /** IANA timezone for label formatting. Falls back to Europe/Rome. */
  timezone?: string;
  /** YYYY-MM-DD in the user's timezone for "today" label resolution. */
  todayYmd: string;
};

function ymdAfter(ymd: string, days: number): string {
  // Treat ymd as UTC midnight, add days, format back. Safe because
  // we only compare dates as strings — timezone math is already
  // baked into ymd by the caller.
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayLabel(ymd: string, todayYmd: string, timezone: string): string {
  if (ymd === todayYmd) return "Oggi";
  if (ymd === ymdAfter(todayYmd, 1)) return "Domani";
  // Use noon UTC: timezone-stable for the day name regardless of DST.
  const d = new Date(`${ymd}T12:00:00Z`);
  const weekday = d.toLocaleDateString("it-IT", { weekday: "short", timeZone: timezone });
  const day = d.toLocaleDateString("it-IT", { day: "numeric", timeZone: timezone });
  const month = d.toLocaleDateString("it-IT", { month: "short", timeZone: timezone });
  // Capitalise the weekday (it-IT returns lowercase 'lun').
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1).replace(".", "");
  return `${weekdayCap} ${day} ${month.replace(".", "")}`;
}

export function AgendaDayGroup({ group, timezone = "Europe/Rome", todayYmd }: Props) {
  const label = dayLabel(group.date, todayYmd, timezone);
  const isToday = group.date === todayYmd;
  const count = group.events.length;

  return (
    <section className="mt-5 first:mt-0">
      <header className="mb-2 flex items-baseline justify-between px-1">
        <h2
          className={`text-sm font-semibold tracking-tight ${
            isToday ? "text-accent-energy" : "text-text-primary"
          }`}
        >
          {label}
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-text-muted">
          {count} {count === 1 ? "evento" : "eventi"}
        </span>
      </header>
      <ul className="rounded-xl border border-border bg-surface">
        {group.events.map((e) => (
          <AgendaEventRow key={e.id} event={e} timezone={timezone} hideDate />
        ))}
      </ul>
    </section>
  );
}
