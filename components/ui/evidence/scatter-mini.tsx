// ScatterMini — evidence for "kind: scatter".
//
// Tiny correlation scatterplot. Points are tone-coloured dots; if a
// `threshold` is provided, a horizontal hairline marks it (e.g. "below 6h
// of sleep" boundary). Used for correlations like
// "qualità giorno seguente vs sonno notte prima".
import type { ToneKey } from "@/lib/types";
import { TONE_VAR } from "@/lib/tone-maps";

export function ScatterMini({
  points,
  threshold,
  tone = "info",
  width = 140,
  height = 60,
  ariaLabel,
}: {
  points: [number, number][];
  threshold?: number;
  tone?: ToneKey;
  width?: number;
  height?: number;
  ariaLabel?: string;
}) {
  if (points.length === 0) {
    return (
      <span
        aria-hidden="true"
        className="block rounded border border-border"
        style={{ width, height }}
      />
    );
  }

  // Single pass for x/y bounds. Avoids `Math.min(...arr)` spread which
  // hits the engine's argument-stack limit on large arrays and allocates
  // intermediate spread args. Threshold is folded in for the y range so
  // the dashed line is always inside the chart frame.
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = threshold ?? Infinity;
  let yMax = threshold ?? -Infinity;
  for (const [x, y] of points) {
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y < yMin) yMin = y;
    if (y > yMax) yMax = y;
  }
  const xSpan = Math.max(1e-6, xMax - xMin);
  const ySpan = Math.max(1e-6, yMax - yMin);
  const pad = 4;

  const toX = (x: number) =>
    pad + ((x - xMin) / xSpan) * (width - 2 * pad);
  const toY = (y: number) =>
    height - pad - ((y - yMin) / ySpan) * (height - 2 * pad);

  const toneVar = TONE_VAR[tone];
  const below =
    threshold !== undefined
      ? points.filter(([, y]) => y < threshold).length
      : 0;
  const computedLabel =
    ariaLabel ??
    (threshold !== undefined
      ? `Scatter di ${points.length} punti, soglia a ${threshold}, ${below} sotto`
      : `Scatter di ${points.length} punti`);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={computedLabel}
      className="overflow-visible"
    >
      {threshold !== undefined ? (
        <line
          x1={pad}
          x2={width - pad}
          y1={toY(threshold)}
          y2={toY(threshold)}
          stroke="var(--color-border)"
          strokeWidth={1}
          strokeDasharray="3 3"
          aria-hidden="true"
        />
      ) : null}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={toX(x)}
          cy={toY(y)}
          r={2.5}
          fill={toneVar}
          opacity={0.85}
        />
      ))}
    </svg>
  );
}
