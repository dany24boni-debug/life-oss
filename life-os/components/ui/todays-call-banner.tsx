// TodaysCallBanner — Pulse handoff §A.
//
// Reads its `tone` + `text` from the caller (typically a server component
// that calls `stubTodaysCall(...)` from lib/voglia/today-call.ts). NO LLM
// chain hits here — the AI swap-in lives in lib/voglia/today-call.ts and
// is gated by ANTHROPIC_API_KEY there. This component is purely visual.
//
// Spec:
//   - Top stripe 2px solid var(--color-accent-{tone}) + 14px tone glow.
//   - Eyebrow row: tone pill (dot + label) + "Today's Call" mono uppercase
//     + optional source mono on the right.
//   - Body: 13.5px medium, 1.4 leading, text-wrap pretty.
//   - BG: var(--grad-call-{tone}), border tone-edge, lift shadow.
//
// The handoff uses 3 Pulse tones (GREEN/YELLOW/RED). Our existing stub
// returns 5 (RECUPERO/VACANZA also). For the extra two we map RECUPERO
// → "info" visual family and VACANZA → "energy". Tone label is shown
// verbatim in the pill so users still see the canonical state name.

import type { CallTone } from "@/lib/types";

type ToneVisual = {
  fill: string;  // CSS var for accent
  bg: string;    // gradient background var
  edge: string;  // border tint var
  lift: string;  // box-shadow lift
};

const VISUAL: Record<CallTone, ToneVisual> = {
  GREEN: {
    fill: "var(--color-accent-good)",
    bg: "var(--grad-call-green)",
    edge: "var(--color-good-edge)",
    lift: "var(--shadow-card-lift-good)",
  },
  YELLOW: {
    fill: "var(--color-accent-warn)",
    bg: "var(--grad-call-yellow)",
    edge: "var(--color-warn-edge)",
    lift: "var(--shadow-card-lift-warn)",
  },
  RED: {
    fill: "var(--color-accent-bad)",
    bg: "var(--grad-call-red)",
    edge: "var(--color-bad-edge)",
    lift: "var(--shadow-card-lift-bad)",
  },
  RECUPERO: {
    fill: "var(--color-accent-info)",
    bg: "linear-gradient(180deg, var(--color-info-tint) 0%, var(--color-surface) 70%)",
    edge: "var(--color-info-edge)",
    lift: "0 18px 36px -16px var(--color-accent-info)",
  },
  VACANZA: {
    fill: "var(--color-accent-energy)",
    bg: "linear-gradient(180deg, var(--color-energy-tint) 0%, var(--color-surface) 70%)",
    edge: "var(--color-energy-edge)",
    lift: "var(--shadow-card-lift-energy)",
  },
};

export function TodaysCallBanner({
  tone,
  text,
  source,
}: {
  tone: CallTone;
  text: string;
  /** Optional eyebrow source label, e.g. "Stub · 8:24" or "Claude · 8:24". */
  source?: string;
}) {
  // Strip a leading "TAG. " prefix from the text so the pill doesn't repeat.
  // The lib/voglia/today-call.ts stub emits text like "GREEN. Sei in linea …".
  const stripped = text.replace(/^(GREEN|YELLOW|RED|RECUPERO|VACANZA)\.\s*/i, "").trim();
  const v = VISUAL[tone];

  return (
    <article
      // role="status" turns the banner into a polite live region — when
      // Today's Call updates and the cross-fade plays, AT announces the
      // new text. Without this, the visual change is silent.
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pulse-todays-call relative overflow-hidden rounded-2xl border px-4 pb-3.5 pt-3"
      style={{
        background: v.bg,
        borderColor: v.edge,
        boxShadow: v.lift,
        animation: "pulse-enter var(--dur-card, 220ms) var(--ease-pulse-out, ease-out) both",
      }}
    >
      {/* Top stripe — full-width solid + glow */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: v.fill,
          boxShadow: `0 0 14px ${v.fill}`,
        }}
      />

      {/* Eyebrow row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded font-mono font-bold"
            style={{
              padding: "3px 8px",
              fontSize: 9,
              letterSpacing: "var(--tracking-mono-lg, 0.16em)",
              background: `color-mix(in srgb, ${v.fill} 15%, transparent)`,
              border: `1px solid color-mix(in srgb, ${v.fill} 40%, transparent)`,
              color: v.fill,
            }}
          >
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: v.fill, boxShadow: `0 0 8px ${v.fill}` }}
            />
            {tone}
          </span>
          <span
            className="font-mono font-semibold uppercase text-text-secondary"
            style={{
              fontSize: 10,
              letterSpacing: "var(--tracking-mono-md, 0.12em)",
            }}
          >
            Today&apos;s Call
          </span>
        </div>
        {source ? (
          <span
            className="font-mono text-text-muted"
            style={{
              fontSize: 9,
              letterSpacing: "var(--tracking-mono-sm, 0.06em)",
            }}
          >
            {source}
          </span>
        ) : null}
      </div>

      {/* Body */}
      <p
        className="mt-2 font-medium text-text-primary"
        style={{
          fontSize: 13.5,
          lineHeight: 1.4,
          letterSpacing: "-0.01em",
          textWrap: "pretty",
        }}
      >
        {stripped}
      </p>
    </article>
  );
}
