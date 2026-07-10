"use client";

/**
 * Barre di completamento per giorno — SVG fatto a mano su ChartFrame
 * (B2.5: nessuna dipendenza di charting). Due letture per barra: il
 * pianificato (ghost, neutro) e il chiuso (ember). Testo assi 12px mono.
 */

import { WEEKDAYS_IT, weekdayMondayFirst, type DayString } from "@/ui/calendar-core";
import type { DayCompletion } from "./logic";

const SLOT_W = 44;
const CHART_H = 96;
const LABEL_H = 34;

export function WeekBars({
  days,
  today,
}: {
  days: DayCompletion[];
  today: DayString;
}) {
  const width = days.length * SLOT_W;
  const height = CHART_H + LABEL_H;
  const max = Math.max(1, ...days.map((d) => d.total));
  const scale = (n: number) => (n / max) * (CHART_H - 18);

  const totalDone = days.reduce((s, d) => s + d.done, 0);
  const totalPlanned = days.reduce((s, d) => s + d.total, 0);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Completamento per giorno: ${totalDone} task chiusi su ${totalPlanned} pianificati.`}
      className="h-auto w-full max-w-md"
    >
      {days.map((d, i) => {
        const x = i * SLOT_W;
        const cx = x + SLOT_W / 2;
        const ghostH = d.total > 0 ? Math.max(scale(d.total), 3) : 0;
        const doneH = d.done > 0 ? Math.max(scale(d.done), 3) : 0;
        const isToday = d.date === today;
        return (
          <g key={d.date}>
            {d.total === 0 ? (
              // Giorno senza task pianificati: solo la base, niente barre finte.
              <rect
                x={cx - 8}
                y={CHART_H - 2}
                width={16}
                height={2}
                rx={1}
                fill="var(--em-hairline)"
              />
            ) : (
              <>
                <rect
                  x={cx - 12}
                  y={CHART_H - ghostH}
                  width={24}
                  height={ghostH}
                  rx={3}
                  fill="var(--em-hairline-strong)"
                  opacity={0.55}
                />
                {d.done > 0 ? (
                  <rect
                    x={cx - 12}
                    y={CHART_H - doneH}
                    width={24}
                    height={doneH}
                    rx={3}
                    fill="var(--em-ember)"
                  />
                ) : null}
              </>
            )}
            {d.done > 0 ? (
              <text
                x={cx}
                y={CHART_H - doneH - 5}
                textAnchor="middle"
                fontSize="12"
                fontFamily="var(--em-font-mono)"
                fill="var(--em-text-2)"
              >
                {d.done}
              </text>
            ) : null}
            <text
              x={cx}
              y={CHART_H + 18}
              textAnchor="middle"
              fontSize="12"
              fontFamily="var(--em-font-mono)"
              fill={isToday ? "var(--em-ember-text)" : "var(--em-text-3)"}
            >
              {WEEKDAYS_IT[weekdayMondayFirst(d.date)]}
            </text>
            {isToday ? (
              <circle cx={cx} cy={CHART_H + 27} r={2.5} fill="var(--em-ember)" />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
