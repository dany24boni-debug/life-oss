// StreakBars — evidence visualisation for "kind: streakBars".
//
// Renders a series of vertical bars whose height encodes the value at each
// step. Bars share an opacity ramp 0.4 → 1 (newest fully opaque) and the
// last bar gets a soft tone glow. Use for "X giorni di seguito sotto target"
// or other consecutive-day counters.
import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

export function StreakBars({
  values,
  tone = "info",
  height = 36,
  ariaLabel,
}: {
  values: number[];
  tone?: ToneKey;
  height?: number;
  ariaLabel?: string;
}) {
  if (values.length === 0) {
    return (
      <span
        aria-hidden="true"
        className="block rounded border border-border"
        style={{ height, width: "100%" }}
      />
    );
  }
  const max = Math.max(1, ...values);
  const toneVar = TONE_VAR[tone];
  const last = values[values.length - 1];
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const computedLabel =
    ariaLabel ??
    `Streak negli ultimi ${values.length} giorni, valori da ${minV} a ${maxV}, ultimo ${last}`;
  return (
    <div
      className="flex items-end gap-[3px]"
      style={{ height }}
      role="img"
      aria-label={computedLabel}
    >
      {values.map((v, i) => {
        const isLast = i === values.length - 1;
        const opacity = isLast ? 1 : 0.4 + (i / Math.max(1, values.length - 1)) * 0.5;
        const h = Math.max(2, Math.round((v / max) * height));
        return (
          <span
            key={i}
            aria-hidden="true"
            className="flex-1 rounded-[1.5px]"
            style={{
              height: h,
              background: toneVar,
              opacity,
              boxShadow: isLast ? `0 0 6px ${toneVar}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
