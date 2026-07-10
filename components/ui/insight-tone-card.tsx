// InsightToneCard — Pulse insight card (handoff §11).
//
// Renders one InsightCandidate row with:
//   - top stripe gradient + glow tinted by tone
//   - mono Pulse-tone label (WIN / PUSH / WATCH / RECOVER / INFO) +
//     confidence pill (mono small)
//   - 16px medium headline
//   - optional 12.5px secondary detail
//   - optional Evidence/* mini-visualisation when evidenceTyped is set
//
// Tone vocabulary lives in lib/types — toPulseTone bridges the lowercase
// detector tones (good/warn/...) to the uppercase Pulse labels.
import { Evidence } from "@/components/ui/evidence";
import { toPulseTone, type InsightEvidence, type ToneKey } from "@/lib/types";
import {
  TONE_TEXT,
  TONE_VAR,
  TONE_STRIPE,
  TONE_TINT,
  TONE_EDGE,
} from "@/lib/tone-maps";

export function InsightToneCard({
  tone,
  headline,
  detail,
  confidence,
  evidence,
}: {
  tone: ToneKey;
  headline: string;
  detail?: string;
  /** 0..1 — rendered as a "X%" pill. */
  confidence: number;
  evidence?: InsightEvidence;
}) {
  const toneVar = TONE_VAR[tone];
  const pulseLabel = toPulseTone(tone);
  const conf = Math.max(0, Math.min(100, Math.round(confidence * 100)));

  return (
    <article
      className="relative overflow-hidden rounded-xl border border-border bg-surface px-4 pb-3.5 pt-3"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: TONE_STRIPE[tone],
          boxShadow: `0 0 12px ${toneVar}60`,
        }}
      />

      <header className="flex items-baseline justify-between gap-2">
        <span
          className={`font-semibold uppercase ${TONE_TEXT[tone]}`}
          style={{
            fontSize: 10,
            letterSpacing: "var(--tracking-mono-md, 0.12em)",
          }}
        >
          {pulseLabel}
        </span>
        <span
          className="rounded font-mono font-bold tabular-nums"
          style={{
            fontSize: 9,
            padding: "2px 6px",
            letterSpacing: "var(--tracking-mono-xs, 0.04em)",
            background: TONE_TINT[tone],
            color: toneVar,
            border: `1px solid ${TONE_EDGE[tone]}`,
          }}
        >
          {conf}%
        </span>
      </header>

      <p
        className="mt-2 font-medium text-text-primary"
        style={{ fontSize: 15, lineHeight: 1.35 }}
      >
        {headline}
      </p>

      {detail ? (
        <p
          className="mt-1 text-text-secondary"
          style={{ fontSize: 12.5, lineHeight: 1.45 }}
        >
          {detail}
        </p>
      ) : null}

      {evidence ? (
        <div className="mt-3">
          <Evidence evidence={evidence} tone={tone} />
        </div>
      ) : null}
    </article>
  );
}
