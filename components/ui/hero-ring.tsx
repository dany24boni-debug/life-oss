// HeroRing — Pulse conic-gradient progress ring.
//
// API is dual-mode for backwards compatibility:
//
//   Legacy:  <HeroRing value={pct} label="OGGI" subtitle="..." color="info" unit="%" />
//   Pulse:   <HeroRing pct={73} label="VITAL SCORE" caption="FOCUS · ENERGIA · CALMA" thick={13} />
//
// Both call shapes are accepted. `value` ↔ `pct`, `subtitle` ↔ `caption`.
// The `color` tone (default "energy") drives the gradient family inside the
// arc. When tone is "energy" the arc ramps energy→deep-orange→bad along the
// filled portion (handoff §1 "rainbow"). For any other tone, the arc stays
// in that tone's family — preserves existing per-page identity (good/warn/
// bad/info) while still adopting the Pulse conic + glow.

import type { ToneKey } from "@/lib/types";
import { TONE_TEXT, TONE_VAR } from "@/lib/tone-maps";

type LegacyProps = {
  value: number;
  label: string;
  subtitle?: string;
  color?: ToneKey;
  size?: number;
  unit?: string;
  thick?: number;
};

type PulseProps = {
  pct: number;
  label?: string;
  caption?: string;
  color?: ToneKey;
  size?: number;
  thick?: number;
  scoreLabel?: "gradient" | "solid";
  unit?: string;
};

type Props = LegacyProps | PulseProps;

// Resolves the conic-gradient string for the filled arc. Each tone except
// "energy" stays inside its color family; "energy" goes through the Pulse
// rainbow energy → orange-red → bad.
function gradientFor(tone: ToneKey, pct: number): string {
  const border = "var(--color-border)";
  const stops = (() => {
    switch (tone) {
      case "energy":
        return [
          { c: "var(--color-accent-energy)", at: 0 },
          { c: "var(--color-accent-energy)", at: pct * 0.35 },
          { c: "#ff6a00", at: pct * 0.7 },
          { c: "var(--color-accent-bad)", at: pct },
        ];
      case "good":
        return [
          { c: "#16a34a", at: 0 },                          // darker green
          { c: "var(--color-accent-good)", at: pct * 0.5 },
          { c: "#4ade80", at: pct },                        // light green
        ];
      case "warn":
        return [
          { c: "#a16207", at: 0 },
          { c: "var(--color-accent-warn)", at: pct * 0.5 },
          { c: "#facc15", at: pct },
        ];
      case "bad":
        return [
          { c: "#b91c1c", at: 0 },
          { c: "var(--color-accent-bad)", at: pct * 0.5 },
          { c: "#f87171", at: pct },
        ];
      case "info":
      default:
        return [
          { c: "#1d4ed8", at: 0 },
          { c: "var(--color-accent-info)", at: pct * 0.5 },
          { c: "#60a5fa", at: pct },
        ];
    }
  })();

  const filled = stops
    .map((s) => `${s.c} ${s.at.toFixed(2)}%`)
    .join(", ");
  // Hairline gap (+0.001%) prevents the last filled stop and the boundary
  // border stop from collapsing to an identical position. Concatenating
  // ".001" onto a `.toFixed(2)` string would yield an invalid `73.00.001%`
  // token — must be added numerically.
  const boundary = (pct + 0.001).toFixed(3);
  return `conic-gradient(from -90deg, ${filled}, ${border} ${boundary}%, ${border} 100%)`;
}

export function HeroRing(props: Props) {
  // Normalise the dual-mode API.
  const pct = "pct" in props ? props.pct : (props as LegacyProps).value;
  const label = props.label ?? "";
  const caption =
    "caption" in props
      ? props.caption
      : (props as LegacyProps).subtitle;
  const color: ToneKey = props.color ?? "energy";
  const size = props.size ?? 220;
  const thick = props.thick ?? Math.max(10, Math.round(size * 0.06));
  const unit = "unit" in props ? props.unit : undefined;
  const scoreLabel: "gradient" | "solid" =
    "scoreLabel" in props && props.scoreLabel ? props.scoreLabel : "gradient";

  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  const innerR = (size - thick * 2) / 2;
  const conic = gradientFor(color, clamped);
  const mask = `radial-gradient(circle at center, transparent ${innerR}px, #000 ${innerR + 1}px)`;

  // Center number rendering: gradient text-clip (Pulse default) or solid.
  const numberStyle: React.CSSProperties =
    scoreLabel === "gradient"
      ? {
          backgroundImage: `linear-gradient(180deg, var(--color-text-primary), ${TONE_VAR[color]})`,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
          fontVariantNumeric: "tabular-nums",
        }
      : { fontVariantNumeric: "tabular-nums", color: "var(--color-text-primary)" };

  return (
    <div
      className="relative mx-auto"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${clamped}${unit ?? "%"}${caption ? `, ${caption}` : ""}`}
    >
      {/* Conic-gradient ring with radial mask for inner cavity.
       * Fades in on mount via the shared pulse-enter keyframe (opacity +
       * tiny translateY) — gives the page a sense of arrival without
       * jank. Reduced-motion fallback in globals.css clamps duration. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full"
        style={{
          background: conic,
          WebkitMask: mask,
          mask,
          filter: `drop-shadow(0 0 12px ${TONE_VAR[color]}40)`,
          animation:
            "pulse-enter var(--dur-screen, 320ms) var(--ease-pulse-out, ease-out) both",
        }}
      />
      {/* Inner hairline circle. */}
      <div
        aria-hidden="true"
        className="absolute rounded-full border border-border"
        style={{ inset: thick - 1 }}
      />

      {/* Centered content. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <div className="flex items-baseline">
          <span
            className="font-bold leading-none tracking-tight"
            style={{
              ...numberStyle,
              fontSize: Math.max(40, Math.round(size * 0.36)),
              letterSpacing: "-0.05em",
            }}
          >
            {clamped}
          </span>
          {unit && unit !== "" ? (
            <span className="ml-1 text-xl font-medium text-text-muted">{unit}</span>
          ) : null}
        </div>
        {label ? (
          <p
            className="mt-2 font-medium uppercase text-text-muted"
            style={{
              fontSize: 10,
              letterSpacing: "var(--tracking-mono-md, 0.12em)",
            }}
          >
            {label}
          </p>
        ) : null}
        {caption ? (
          <p
            className={`mt-1 text-sm ${TONE_TEXT[color]}`}
            style={{ fontSize: 11, letterSpacing: "0.02em" }}
          >
            {caption}
          </p>
        ) : null}
      </div>
    </div>
  );
}
