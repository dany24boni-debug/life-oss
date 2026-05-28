// MetricTile — Pulse dashboard metric tile (handoff §2).
//
// Four `kind` variants drive the mini visual under the value:
//   - 'streakDots'  — 14 vertical bars, last bar full opacity + glow
//   - 'progress'    — single pct progress bar with tone glow
//   - 'pctPill'     — 8 horizontal segment dots + a small "%" pill in the
//                     value row
//   - 'sparkline'   — Sparkline (bars variant) of `trend` values
//
// Always painted with:
//   - top stripe gradient + soft glow (`--grad-tile-stripe-{tone}`)
//   - mono uppercase label top-left in tone colour
//   - live dot top-right with tone glow
//   - tabular-nums value + mono unit
//   - sub mono small line at the bottom
//
// Accessibility: AT receives an aria-label combining label/value/unit/sub.
// The dot + stripe are aria-hidden; an sr-only status descriptor mirrors
// the tone for users on screen readers.

import { Sparkline } from "./sparkline";
import type { ToneKey } from "@/lib/types";
import {
  TONE_TEXT,
  TONE_VAR,
  TONE_STRIPE,
  TONE_TINT as TONE_BG_TINT,
  TONE_EDGE,
} from "@/lib/tone-maps";

type CommonProps = {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone: ToneKey;
  /**
   * Optional 0-based index for staggered mount entry. When set, the tile
   * gets a tile-enter animation with animation-delay of index * 60ms.
   * reduced-motion fallback in globals.css clamps this to 0.01ms.
   */
  index?: number;
};

type MetricTileProps = CommonProps &
  (
    | {
        kind: "sparkline";
        /** Last 7-14 numbers. */
        trend: number[];
        pct?: number;
        segments?: never;
      }
    | {
        kind: "streakDots" | "progress" | "pctPill";
        pct: number; // 0-100
        trend?: never;
        /** streakDots / pctPill segment count override. */
        segments?: number;
      }
  );

export function MetricTile(props: MetricTileProps) {
  const { label, value, unit, sub, tone, kind, index } = props;
  const toneVar = TONE_VAR[tone];
  const pctRaw = "pct" in props && typeof props.pct === "number" ? props.pct : 0;
  const safePct = Math.max(0, Math.min(100, pctRaw));
  const trend = kind === "sparkline" ? props.trend : undefined;
  const segments = kind === "streakDots" || kind === "pctPill" ? props.segments : undefined;
  const enterAnimation =
    typeof index === "number"
      ? {
          animation: `tile-enter var(--dur-card, 220ms) var(--ease-pulse-out, ease-out) both`,
          animationDelay: `${Math.max(0, index) * 60}ms`,
        }
      : {};

  return (
    <article
      className="relative overflow-hidden rounded-xl border border-border bg-surface px-3 pb-2.5 pt-2.5"
      style={{ minHeight: 96, ...enterAnimation }}
      aria-label={buildAriaLabel({
        label,
        value,
        unit,
        sub,
        kind,
        pct: safePct,
        trend,
      })}
    >
      {/* Top stripe — gradient + glow */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: TONE_STRIPE[tone],
          boxShadow: `0 0 12px ${toneVar}60`,
        }}
      />

      {/* Header row: mono label + live dot */}
      <header className="flex items-center justify-between">
        <span
          className={`font-semibold uppercase ${TONE_TEXT[tone]}`}
          style={{
            fontSize: 9,
            letterSpacing: "var(--tracking-mono-md, 0.12em)",
          }}
        >
          {label}
        </span>
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full"
          style={{
            background: toneVar,
            boxShadow: `0 0 8px ${toneVar}80`,
            animation:
              "pulse-glow var(--dur-glow-loop, 2400ms) var(--ease-pulse-glow, ease-in-out) infinite",
          }}
        />
      </header>

      {/* Value row */}
      <div className="mt-1.5 flex items-baseline gap-1">
        <span
          className="font-bold tabular-nums leading-none text-text-primary"
          style={{ fontSize: 26, letterSpacing: "-0.025em" }}
        >
          {value}
        </span>
        {unit ? (
          <span
            className="font-medium text-text-secondary"
            style={{ fontSize: 12, letterSpacing: "0.02em" }}
          >
            {unit}
          </span>
        ) : null}
        {kind === "pctPill" ? (
          <span
            className="ml-auto rounded font-mono font-bold"
            style={{
              fontSize: 9,
              padding: "2px 6px",
              letterSpacing: "var(--tracking-mono-xs, 0.04em)",
              background: TONE_BG_TINT[tone],
              color: toneVar,
              border: `1px solid ${TONE_EDGE[tone]}`,
            }}
          >
            {Math.round(safePct)}%
          </span>
        ) : null}
      </div>

      {/* Visual mini under value */}
      <div className="mt-2.5">
        {kind === "progress" ? (
          <ProgressBar pct={safePct} toneVar={toneVar} />
        ) : null}
        {kind === "streakDots" ? (
          <StreakBars segments={segments ?? 14} toneVar={toneVar} />
        ) : null}
        {kind === "pctPill" ? (
          <SegmentDots segments={segments ?? 8} pct={safePct} toneVar={toneVar} />
        ) : null}
        {kind === "sparkline" && trend && trend.length > 1 ? (
          <Sparkline data={trend} variant="bars" width={140} height={26} color={tone} />
        ) : null}
      </div>

      {sub ? (
        <p
          className="mt-1.5 font-mono text-text-muted"
          style={{
            fontSize: 9,
            letterSpacing: "var(--tracking-mono-xs, 0.04em)",
          }}
        >
          {sub}
        </p>
      ) : null}
    </article>
  );
}

// Build the article aria-label so AT users hear the same data the visual
// tile carries: the % pill (pctPill kind) and the trend direction
// (sparkline kind) are otherwise lost on screen readers.
function buildAriaLabel(args: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  kind: MetricTileProps["kind"];
  pct: number;
  trend?: number[];
}): string {
  const { label, value, unit, sub, kind, pct, trend } = args;
  let extras = "";
  if (kind === "pctPill") {
    extras = `, ${Math.round(pct)} percento`;
  } else if (kind === "sparkline" && trend && trend.length >= 2) {
    const delta = trend[trend.length - 1] - trend[0];
    if (delta > 0) extras = ", in salita";
    else if (delta < 0) extras = ", in calo";
    else extras = ", stabile";
  }
  return `${label}: ${value}${unit ?? ""}${extras}${sub ? `, ${sub}` : ""}`;
}

function ProgressBar({ pct, toneVar }: { pct: number; toneVar: string }) {
  return (
    <div className="relative h-1 overflow-hidden rounded bg-border">
      <div
        className="absolute inset-y-0 left-0 rounded transition-all"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${toneVar}, ${toneVar}cc)`,
          boxShadow: `0 0 10px ${toneVar}80`,
        }}
      />
    </div>
  );
}

function StreakBars({ segments, toneVar }: { segments: number; toneVar: string }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: segments }).map((_, i) => {
        const isLast = i === segments - 1;
        const opacity = isLast ? 1 : 0.3 + (i / segments) * 0.6;
        return (
          <span
            key={i}
            className="flex-1 rounded-[1.5px]"
            style={{
              height: 5,
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

function SegmentDots({
  segments,
  pct,
  toneVar,
}: {
  segments: number;
  pct: number;
  toneVar: string;
}) {
  const filled = Math.round((pct / 100) * segments);
  return (
    <div className="flex items-center gap-[3px]">
      {Array.from({ length: segments }).map((_, i) => {
        const on = i < filled;
        const isLast = i === filled - 1;
        return (
          <span
            key={i}
            className="flex-1 rounded-[1.5px]"
            style={{
              height: 5,
              background: on ? toneVar : "var(--color-border)",
              boxShadow: isLast ? `0 0 6px ${toneVar}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
