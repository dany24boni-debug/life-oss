"use client";

// Progress — linear bar + ring, determinate and indeterminate, tones.

import { cx } from "./cx";

type Tone = "ember" | "salvia" | "segnale" | "neutral";

const TONE_FILL: Record<Tone, string> = {
  ember: "var(--em-ember)",
  salvia: "var(--em-salvia)",
  segnale: "var(--em-segnale)",
  neutral: "var(--em-text-3)",
};

export function ProgressBar({
  value,
  max = 100,
  tone = "ember",
  label,
  className,
}: {
  /** Omit for indeterminate. */
  value?: number;
  max?: number;
  tone?: Tone;
  /** Accessible name. */
  label: string;
  className?: string;
}) {
  const indeterminate = value === undefined;
  const pct = indeterminate ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : Math.round(value)}
      className={cx(
        "relative h-1.5 w-full overflow-hidden rounded-full",
        "bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)]",
        className,
      )}
    >
      {indeterminate ? (
        <span
          className="absolute top-0 h-full w-1/3 rounded-full animate-[em-indeterminate_1.4s_var(--em-ease-in-out)_infinite]"
          style={{ background: TONE_FILL[tone] }}
        />
      ) : (
        <span
          className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--em-dur-card)] ease-[var(--em-ease-out)]"
          style={{ width: `${pct}%`, background: TONE_FILL[tone] }}
        />
      )}
    </div>
  );
}

export function ProgressRing({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  tone = "ember",
  label,
  children,
  className,
}: {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  tone?: Tone;
  /** Accessible name. */
  label: string;
  /** Center content (a number, a unit...). */
  children?: React.ReactNode;
  className?: string;
}) {
  const pct = Math.min(1, Math.max(0, value / max));
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cx("relative inline-grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="color-mix(in srgb, var(--em-text) 10%, transparent)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE_FILL[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-[stroke-dashoffset] duration-[var(--em-dur-screen)] ease-[var(--em-ease-out)]"
        />
      </svg>
      {children ? (
        <div className="absolute inset-0 grid place-items-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
