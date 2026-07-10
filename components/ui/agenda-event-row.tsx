// AgendaEventRow — single row in the /agenda merged feed.
//
// Visual: source badge (L = local, G = google) + time/date + title.
// External-source titles link out to the provider when htmlLink is set.
// Mobile-first: max-w-md container, single-row layout, truncation.

import type { UnifiedEvent } from "@/lib/agenda/merge";

type Props = {
  event: UnifiedEvent;
  /** IANA timezone for display formatting. Falls back to 'Europe/Rome'. */
  timezone?: string;
  /**
   * When true, omit the date portion of the metadata line. Used by
   * AgendaDayGroup which already renders the date in the section
   * header — avoids redundant repetition on every row.
   */
  hideDate?: boolean;
};

const SOURCE_BADGE: Record<UnifiedEvent["source"], { label: string; cls: string }> = {
  local: {
    label: "L",
    cls: "bg-accent-info/10 text-accent-info border-accent-info/30",
  },
  google: {
    label: "G",
    cls: "bg-accent-good/10 text-accent-good border-accent-good/30",
  },
};

function formatDate(iso: string, timezone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: timezone,
  });
}

function formatTime(iso: string, timezone: string, allDay: boolean): string {
  if (allDay) return "tutto il giorno";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  });
}

export function AgendaEventRow({ event, timezone = "Europe/Rome", hideDate = false }: Props) {
  const badge = SOURCE_BADGE[event.source];
  const dateLabel = formatDate(event.startsAt, timezone);
  const timeLabel = formatTime(event.startsAt, timezone, event.allDay);

  const title = event.title;
  const titleNode = event.htmlLink ? (
    <a
      href={event.htmlLink}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-text-primary hover:underline underline-offset-2"
    >
      {title}
    </a>
  ) : (
    <span className="font-medium text-text-primary">{title}</span>
  );

  return (
    <li className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
      <span
        aria-label={event.source === "local" ? "Evento locale" : "Evento Google"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold uppercase tracking-wider ${badge.cls}`}
      >
        {badge.label}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs text-text-secondary">
          {hideDate ? null : (
            <>
              <span className="font-medium tabular-nums">{dateLabel}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <span className="tabular-nums">{timeLabel}</span>
        </div>
        <div className="mt-0.5 truncate text-sm">{titleNode}</div>
        {event.location ? (
          <div className="mt-0.5 truncate text-xs text-text-muted">📍 {event.location}</div>
        ) : null}
        {event.description ? (
          <div className="mt-1 line-clamp-2 text-xs text-text-secondary">{event.description}</div>
        ) : null}
      </div>
    </li>
  );
}
