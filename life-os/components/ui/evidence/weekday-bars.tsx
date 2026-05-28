// WeekdayBars — evidence for "kind: weekdayBars".
//
// 7-bar histogram across days of the week (lun..dom). Bars marked `hi=true`
// get full tone glow + opacity 1; others stay at 0.45 opacity. Use for
// "best/worst day of week" patterns where one weekday clearly stands out.
import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

type Day = { d: string; v: number; hi?: boolean };

export function WeekdayBars({
  days,
  tone = "info",
  height = 44,
  ariaLabel,
}: {
  days: Day[];
  tone?: ToneKey;
  height?: number;
  ariaLabel?: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.v));
  const toneVar = TONE_VAR[tone];
  const peakDays = days.filter((d) => d.hi).map((d) => d.d);
  const computedLabel =
    ariaLabel ??
    (peakDays.length > 0
      ? `Distribuzione per giorno della settimana, picco ${peakDays.join(", ")}`
      : `Distribuzione per giorno della settimana, ${days.length} giorni`);
  return (
    <div
      role="img"
      aria-label={computedLabel}
    >
      <div className="flex items-end gap-[5px]" style={{ height }}>
        {days.map((d, i) => {
          const h = Math.max(3, Math.round((d.v / max) * height));
          const hi = Boolean(d.hi);
          return (
            <span
              key={i}
              aria-hidden="true"
              className="flex-1 rounded-[2px]"
              style={{
                height: h,
                background: toneVar,
                opacity: hi ? 1 : 0.45,
                boxShadow: hi ? `0 0 8px ${toneVar}` : undefined,
              }}
            />
          );
        })}
      </div>
      <div
        className="mt-1 flex gap-[5px] font-mono uppercase text-text-muted"
        style={{
          fontSize: 9,
          letterSpacing: "var(--tracking-mono-md, 0.12em)",
        }}
        aria-hidden="true"
      >
        {days.map((d, i) => (
          <span key={i} className="flex-1 text-center">
            {d.d}
          </span>
        ))}
      </div>
    </div>
  );
}
