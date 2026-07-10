// StatusPill — small rounded pill with optional dot + label.
// Pulse extensions: explicit `tone` per ToneKey (alongside legacy `variant`),
// `size` xs|sm|md, `mono` toggle for typeface, `dot` alias for withDot.

import type { ToneKey } from "@/lib/types";

// Legacy variant API. "live" maps to info, "neutral" to neutral surface.
type Variant = "live" | "good" | "warn" | "bad" | "neutral";

type DotClass = { fill: string; text: string; shadow: string };

const VARIANT_DOT: Record<Variant, DotClass> = {
  live: { fill: "bg-accent-info", text: "text-accent-info", shadow: "shadow-[0_0_8px_currentColor]" },
  good: { fill: "bg-accent-good", text: "text-accent-good", shadow: "" },
  warn: { fill: "bg-accent-warn", text: "text-accent-warn", shadow: "" },
  bad: { fill: "bg-accent-bad", text: "text-accent-bad", shadow: "" },
  neutral: { fill: "bg-text-muted", text: "text-text-muted", shadow: "" },
};

const TONE_TO_VARIANT: Record<ToneKey, Variant> = {
  good: "good",
  warn: "warn",
  bad: "bad",
  info: "live",
  energy: "warn", // closest legacy fallback; consumers using `tone="energy"`
                  // get the energy text class explicitly below.
};

const VARIANT_BORDER: Record<Variant, string> = {
  live: "border-accent-info/40 bg-accent-info/5",
  good: "border-accent-good/40 bg-accent-good/5",
  warn: "border-accent-warn/40 bg-accent-warn/5",
  bad: "border-accent-bad/40 bg-accent-bad/5",
  neutral: "border-border bg-surface",
};

const TONE_BORDER: Partial<Record<ToneKey, string>> = {
  energy: "border-accent-energy/40 bg-accent-energy/5",
};

const TONE_TEXT: Partial<Record<ToneKey, string>> = {
  energy: "text-accent-energy",
};

const TONE_DOT_FILL: Partial<Record<ToneKey, string>> = {
  energy: "bg-accent-energy",
};

const SIZE_CLASS: Record<NonNullable<StatusPillSize>, string> = {
  xs: "px-2 py-0.5 text-[9px] tracking-[0.14em]",
  sm: "px-2.5 py-1 text-[10px] tracking-[0.14em]",
  md: "px-3 py-1.5 text-[11px] tracking-[0.16em]",
};

type StatusPillSize = "xs" | "sm" | "md";

type StatusPillProps = {
  label: string;
  /** Legacy variant. Mutually exclusive with `tone`. */
  variant?: Variant;
  /** Pulse tone. When set, overrides `variant`. */
  tone?: ToneKey;
  /** Show leading colored dot. Alias `dot` (Pulse). Default true. */
  withDot?: boolean;
  dot?: boolean;
  /** Pulse: mono uppercase typeface. Default true (matches existing visual). */
  mono?: boolean;
  size?: StatusPillSize;
};

export function StatusPill({
  label,
  variant: variantProp,
  tone,
  withDot = true,
  dot,
  mono = true,
  size = "sm",
}: StatusPillProps) {
  // Resolve effective variant. Pulse `tone` takes priority over legacy variant.
  const resolvedVariant: Variant = tone ? TONE_TO_VARIANT[tone] : variantProp ?? "neutral";

  // Border: prefer Pulse tone overrides for energy, else legacy variant map.
  const border =
    (tone && TONE_BORDER[tone]) ?? VARIANT_BORDER[resolvedVariant];

  // Text colour: Pulse override (energy) wins; otherwise legacy mapping.
  const textCls =
    (tone && TONE_TEXT[tone]) ??
    (resolvedVariant === "neutral" ? "text-text-secondary" : VARIANT_DOT[resolvedVariant].text);

  // Dot fill: Pulse override wins; else legacy mapping.
  const dotFill =
    (tone && TONE_DOT_FILL[tone]) ?? VARIANT_DOT[resolvedVariant].fill;
  const dotShadow = VARIANT_DOT[resolvedVariant].shadow;

  const showDot = dot ?? withDot;
  const sizeCls = SIZE_CLASS[size];
  const fontCls = mono ? "font-medium uppercase font-mono" : "font-medium";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${sizeCls} ${fontCls} ${border}`}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${dotFill} ${dotShadow}`}
        />
      ) : null}
      <span className={textCls}>{label}</span>
    </span>
  );
}
