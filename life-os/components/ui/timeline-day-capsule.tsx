// TimelineDayCapsule — Pulse day-bucket for /timeline (handoff §10).
//
// Renders a card per day with:
//   - mono eyebrow row: relative date (Oggi · ieri · weekday/dd) + event count
//   - a vertical lane on the left where each event gets a small coloured dot
//     (module tone) connected by a hairline; the lane stops one row early so
//     the last dot sits without a tail.
//   - each row: mono time chip + summary text
//
// Module accent comes from MODULE_TONE; chameleon_os uses the dedicated
// violet token. The card is purely presentational; the page pre-groups
// events by date and hands them in.
import { MODULE_TONE, type ModuleKey, moduleSlugBase } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

type Event = {
  id: string;
  summary: string;
  module: string; // raw slug from user_events.module
  occurred_at: string; // ISO
};

function dotColor(slug: string): string {
  const base: ModuleKey = moduleSlugBase(slug);
  if (base === "chameleon_os") return "var(--color-module-violet)";
  return TONE_VAR[MODULE_TONE[base]] ?? TONE_VAR.info;
}

export function TimelineDayCapsule({
  dateLabel,
  events,
  timezone,
}: {
  dateLabel: string;
  events: Event[];
  timezone: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface px-4 pb-3 pt-3.5">
      <header className="flex items-baseline justify-between">
        <span
          className="font-semibold uppercase text-text-primary"
          style={{
            fontSize: 11,
            letterSpacing: "var(--tracking-mono-md, 0.12em)",
          }}
        >
          {dateLabel}
        </span>
        <span
          className="font-mono uppercase text-text-muted"
          style={{
            fontSize: 9,
            letterSpacing: "var(--tracking-mono-md, 0.12em)",
          }}
        >
          {events.length} EVENTI
        </span>
      </header>

      <ol className="relative mt-3" aria-label={`Eventi di ${dateLabel}`}>
        <span
          aria-hidden="true"
          className="absolute left-[5px] top-2 bottom-3 w-px bg-border"
        />
        {events.map((e) => {
          const c = dotColor(e.module);
          return (
            <li key={e.id} className="relative flex items-start gap-3 py-1.5 pl-5">
              <span
                aria-hidden="true"
                className="absolute left-0 top-2.5 h-[11px] w-[11px] rounded-full border"
                style={{
                  background: c,
                  borderColor: "var(--color-bg)",
                  boxShadow: `0 0 6px ${c}80`,
                }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug text-text-primary">
                  {e.summary}
                </p>
              </div>
              <span
                className="shrink-0 font-mono uppercase text-text-muted tabular-nums"
                style={{
                  fontSize: 10,
                  letterSpacing: "var(--tracking-mono-xs, 0.04em)",
                }}
              >
                {formatTime(e.occurred_at, timezone)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function formatTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("it-IT", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}
