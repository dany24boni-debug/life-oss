// ProgressDots — evidence visualisation for "kind: progressDots".
//
// Renders 10 dots representing fraction-of-target. Filled dots are tone
// coloured; the last filled dot carries a soft glow. Use for water/steps/
// budget where the progress is "X out of Y today/this period".
import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

export function ProgressDots({
  current,
  target,
  tone = "info",
  segments = 10,
  ariaLabel,
}: {
  current: number;
  target: number;
  tone?: ToneKey;
  segments?: number;
  ariaLabel?: string;
}) {
  const safeTarget = Math.max(1, target);
  const pct = Math.max(0, Math.min(1, current / safeTarget));
  const filled = Math.round(pct * segments);
  const toneVar = TONE_VAR[tone];
  return (
    <div
      className="flex items-center gap-1.5"
      role="img"
      aria-label={
        ariaLabel ?? `Progresso: ${current} su ${target} (${Math.round(pct * 100)}%)`
      }
    >
      {Array.from({ length: segments }).map((_, i) => {
        const on = i < filled;
        const isLastFilled = i === filled - 1;
        return (
          <span
            key={i}
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{
              background: on ? toneVar : "transparent",
              border: on ? "none" : "1px solid var(--color-border)",
              boxShadow: isLastFilled ? `0 0 6px ${toneVar}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
