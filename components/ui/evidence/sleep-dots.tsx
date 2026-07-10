// SleepDots — evidence for "kind: sleepDots".
//
// Renders one dot per night across the input array. Dot size + opacity
// scale with the hours value; null nights render as a thin hairline ring
// (= no log). Use for "media sonno settimana / hai dormito X notti sotto
// 6h" patterns.
import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

const TARGET_HOURS = 8;

export function SleepDots({
  nights,
  tone = "info",
  ariaLabel,
}: {
  nights: (number | null)[];
  tone?: ToneKey;
  ariaLabel?: string;
}) {
  const toneVar = TONE_VAR[tone];
  const logged = nights.filter((h): h is number => typeof h === "number");
  const avg =
    logged.length > 0
      ? logged.reduce((s, h) => s + h, 0) / logged.length
      : null;
  const belowTarget = logged.filter((h) => h < TARGET_HOURS).length;
  const computedLabel =
    ariaLabel ??
    (avg !== null
      ? `Sonno ultime ${nights.length} notti, media ${avg.toFixed(1)}h, ${belowTarget} sotto le ${TARGET_HOURS}h`
      : `Sonno ultime ${nights.length} notti, nessuna registrata`);
  return (
    <div
      className="flex items-center gap-2"
      role="img"
      aria-label={computedLabel}
    >
      {nights.map((h, i) => {
        if (h === null || h === undefined) {
          return (
            <span
              key={i}
              aria-hidden="true"
              className="h-3 w-3 rounded-full border border-border"
            />
          );
        }
        const ratio = Math.max(0.3, Math.min(1, h / TARGET_HOURS));
        const size = Math.round(8 + ratio * 8);
        return (
          <span
            key={i}
            aria-hidden="true"
            className="rounded-full"
            style={{
              width: size,
              height: size,
              background: toneVar,
              opacity: ratio,
              boxShadow: ratio >= 0.85 ? `0 0 6px ${toneVar}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
