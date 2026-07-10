"use client";

// StatCard — mono eyebrow, display-face tabular value, optional delta chip
// and sparkline slot. `loading` renders the skeleton shape.

import { cx } from "./cx";
import { Skeleton } from "./skeleton";

export function StatCard({
  label,
  value,
  unit,
  delta,
  hint,
  loading = false,
  children,
  className,
}: {
  label: string;
  value?: string | number;
  unit?: string;
  /** Signed change, e.g. { value: "+12%", tone: "up" }. */
  delta?: { value: string; tone: "up" | "down" | "flat" };
  hint?: string;
  loading?: boolean;
  /** Optional visual slot (sparkline etc.), rendered under the value. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("em-card flex flex-col gap-2 p-4", className)}>
      <p className="em-eyebrow">{label}</p>
      {loading ? (
        <>
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-4 w-16" />
        </>
      ) : (
        <>
          <p className="flex items-baseline gap-1.5">
            <span className="em-title-lg em-num text-[var(--em-text)]">
              {value ?? "—"}
            </span>
            {unit ? (
              <span className="em-body-sm font-[family-name:var(--em-font-mono)] text-[var(--em-text-3)]">
                {unit}
              </span>
            ) : null}
            {delta ? <DeltaChip {...delta} /> : null}
          </p>
          {hint ? (
            <p className="em-body-sm text-[var(--em-text-3)]">{hint}</p>
          ) : null}
          {children}
        </>
      )}
    </div>
  );
}

function DeltaChip({
  value,
  tone,
}: {
  value: string;
  tone: "up" | "down" | "flat";
}) {
  const styles = {
    up: "text-[var(--em-salvia-text)] bg-[var(--em-salvia-tint)]",
    down: "text-[var(--em-segnale-text)] bg-[var(--em-segnale-tint)]",
    flat: "text-[var(--em-text-3)] bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
  } as const;
  const arrow = tone === "up" ? "↑" : tone === "down" ? "↓" : "→";
  return (
    <span
      className={cx(
        "em-num inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[length:var(--em-fs-label)] font-medium",
        styles[tone],
      )}
    >
      <span aria-hidden="true">{arrow}</span>
      {value}
    </span>
  );
}
