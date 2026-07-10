"use client";

/**
 * Strip mensile dei giorni attivi: griglia lun-dom, quadratini onesti —
 * pieno ember = giorno attivo, bordo = giorno protetto, velo neutro =
 * passato senza attività, vuoto = futuro. Oggi porta l'anello.
 */

import { cx } from "@/ui";
import {
  WEEKDAYS_IT,
  weekdayMondayFirst,
  type DayString,
} from "@/ui/calendar-core";
import { dayRange } from "@/data/streak";

export function MonthHeat({
  from,
  to,
  today,
  activeDays,
  protectedDays,
}: {
  from: DayString;
  to: DayString;
  today: DayString;
  activeDays: ReadonlySet<DayString>;
  protectedDays: ReadonlySet<DayString>;
}) {
  const days = dayRange(from, to);
  const offset = weekdayMondayFirst(from);
  const activeCount = days.filter((d) => activeDays.has(d)).length;

  return (
    <div
      role="img"
      aria-label={`Giorni attivi nel mese: ${activeCount} su ${days.length}.`}
    >
      <div className="grid w-fit grid-cols-7 gap-1.5">
        {WEEKDAYS_IT.map((w) => (
          <span key={w} aria-hidden="true" className="em-eyebrow w-5 text-center">
            {w.slice(0, 1)}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" className="h-5 w-5" />
        ))}
        {days.map((d) => {
          const active = activeDays.has(d);
          const isProtected = protectedDays.has(d);
          const future = d > today;
          return (
            <span
              key={d}
              aria-hidden="true"
              title={d}
              className={cx(
                "h-5 w-5 rounded-[5px]",
                active
                  ? "bg-[var(--em-ember)]"
                  : isProtected
                    ? "shadow-[inset_0_0_0_1.5px_var(--em-hairline-strong)]"
                    : future
                      ? "shadow-[inset_0_0_0_1px_var(--em-hairline)]"
                      : "bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
                d === today && "outline outline-2 outline-offset-1 outline-[var(--em-focus-ring)]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
