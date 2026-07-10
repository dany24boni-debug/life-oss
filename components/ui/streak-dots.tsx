// StreakDots — horizontal row of dots showing recent kept-day history.
// Two input shapes:
//   - data: boolean[]            (legacy: true=kept, false=missed)
//   - data: (0 | 0.5 | 1)[]      (Pulse: 1=full, 0.5=partial, 0=empty)
// Pulse extras: `today=true` paints a halo around the last dot, `tone`
// chooses the accent (default energy).

import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

// Tailwind bg-* class form — kept local because StreakDots is the sole
// consumer. If a second component needs it, hoist into lib/tone-maps.
const TONE_BG: Record<ToneKey, string> = {
  good: "bg-accent-good",
  warn: "bg-accent-warn",
  bad: "bg-accent-bad",
  info: "bg-accent-info",
  energy: "bg-accent-energy",
};

type DotValue = 0 | 0.5 | 1 | boolean;

export function StreakDots({
  data,
  count = 14,
  tone = "good",
  today = false,
}: {
  /** Either booleans (kept/missed) or 0/0.5/1 (Pulse partial states). */
  data: DotValue[];
  count?: number;
  /** Pulse tone for the dot fill. Default "good" preserves prior visual. */
  tone?: ToneKey;
  /** When true, the last dot gets a halo (Pulse spec). Default false. */
  today?: boolean;
}) {
  const slice = data.slice(-count);
  const padded: DotValue[] =
    slice.length < count
      ? [...new Array(count - slice.length).fill(0 as DotValue), ...slice]
      : slice;

  const fillClass = TONE_BG[tone];
  const haloColor = TONE_VAR[tone];

  // Summarise the dot pattern for screen-reader users — without this they
  // hear "image, history of last 14 days" with no actual data.
  let kept = 0;
  let partial = 0;
  let missed = 0;
  for (const d of padded) {
    const v = typeof d === "boolean" ? (d ? 1 : 0) : d;
    if (v === 1) kept += 1;
    else if (v === 0.5) partial += 1;
    else missed += 1;
  }
  const ariaLabel =
    partial > 0
      ? `Cronologia ultimi ${count} giorni: ${kept} pieni, ${partial} parziali, ${missed} saltati`
      : `Cronologia ultimi ${count} giorni: ${kept} pieni, ${missed} saltati`;

  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={ariaLabel}
    >
      {padded.map((d, i) => {
        const v = typeof d === "boolean" ? (d ? 1 : 0) : d;
        const isLast = i === padded.length - 1;
        const halo = today && isLast;
        let className: string;
        let style: React.CSSProperties | undefined;
        if (v === 1) {
          className = `h-2 w-2 rounded-full transition-opacity ${fillClass}`;
        } else if (v === 0.5) {
          className = `h-2 w-2 rounded-full transition-opacity opacity-35 ${fillClass}`;
        } else {
          // empty / missed — hairline border, no fill
          className = "h-2 w-2 rounded-full border border-border bg-transparent";
        }
        if (halo) {
          style = {
            boxShadow: `0 0 0 2px var(--color-bg), 0 0 0 3px ${haloColor}`,
            animation:
              "pulse-glow var(--dur-glow-loop, 2400ms) var(--ease-pulse-glow, ease-in-out) infinite",
          };
        }
        return <span key={i} className={className} style={style} />;
      })}
    </div>
  );
}
