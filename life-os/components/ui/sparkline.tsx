// Sparkline — inline mini chart. Two variants:
//   - "line" (default): polyline + gradient area fill (existing behaviour).
//   - "bars" (Pulse): vertical bars, last one full-opacity + drop-shadow.
// Backwards compatible: existing callers (recap, gym, finance, business)
// don't change. New Pulse callers (MetricTile, Evidence/StreakBars) opt
// into bars via `variant="bars"`.

import type { ToneKey } from "@/lib/types";

// djb2-style 32-bit hash on the rounded data points. Cheap, deterministic,
// distinct for visually-distinct series, doesn't allocate.
function hashSeries(data: number[]): string {
  let h = 5381;
  for (const v of data) {
    h = (h * 33) ^ Math.round(v * 100);
    h |= 0;
  }
  return (h >>> 0).toString(36);
}

const TONE_STROKE: Record<ToneKey, string> = {
  good: "var(--color-accent-good)",
  warn: "var(--color-accent-warn)",
  bad: "var(--color-accent-bad)",
  info: "var(--color-accent-info)",
  energy: "var(--color-accent-energy)",
};

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  /** Tone key — accepts the Pulse vocabulary. Defaults to "good". */
  color?: ToneKey;
  /** Pulse rendering: bars instead of polyline. Default "line". */
  variant?: "line" | "bars";
  /** Bars-only: last bar gets drop-shadow + full opacity. Default true. */
  glowLast?: boolean;
  /** Bars-only: pixel gap between bars. Default 2. */
  gap?: number;
};

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "good",
  variant = "line",
  glowLast = true,
  gap = 2,
}: SparklineProps) {
  if (data.length < 2) {
    return <span className="inline-block" style={{ width, height }} aria-hidden="true" />;
  }

  const stroke = TONE_STROKE[color] ?? TONE_STROKE.good;

  if (variant === "bars") {
    return <BarsSparkline data={data} width={width} height={height} stroke={stroke} glowLast={glowLast} gap={gap} />;
  }

  return <LineSparkline data={data} width={width} height={height} stroke={stroke} color={color} />;
}

function LineSparkline({
  data,
  width,
  height,
  stroke,
  color,
}: {
  data: number[];
  width: number;
  height: number;
  stroke: string;
  color: string;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((d, i) => {
      const x = i * stepX;
      const y = height - ((d - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath = `M 0 ${height} L ${points
    .split(" ")
    .map((p) => p.replace(",", " "))
    .join(" L ")} L ${width} ${height} Z`;

  const gradId = `spark-${color}-${hashSeries(data)}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function BarsSparkline({
  data,
  width,
  height,
  stroke,
  glowLast,
  gap,
}: {
  data: number[];
  width: number;
  height: number;
  stroke: string;
  glowLast: boolean;
  gap: number;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(0.1, max - min);
  const barW = (width - gap * (data.length - 1)) / data.length;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block"
      aria-hidden="true"
      style={{ overflow: "visible" }}
    >
      {data.map((v, i) => {
        const h = Math.max(2, ((v - min) / range) * (height - 2) + 4);
        const isLast = i === data.length - 1;
        // Linear ramp from 0.4 → 1 across the series; final bar is always 1.
        const opacity = isLast ? 1 : 0.4 + (i / Math.max(1, data.length - 1)) * 0.6;
        return (
          <rect
            key={i}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={1}
            fill={stroke}
            opacity={opacity}
            filter={isLast && glowLast ? `drop-shadow(0 0 4px ${stroke})` : undefined}
          />
        );
      })}
    </svg>
  );
}
