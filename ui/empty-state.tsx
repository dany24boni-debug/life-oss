"use client";

// EmptyState — copy-first: one heading, one sentence, one action. No
// illustrations by design (B4).

import { cx } from "./cx";

export function EmptyState({
  heading,
  text,
  action,
  icon,
  compact = false,
  className,
}: {
  heading: string;
  text?: string;
  /** A single action, typically a Button. */
  action?: React.ReactNode;
  /** Optional small icon slot above the heading. */
  icon?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-6" : "gap-2 py-12",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-1 grid h-10 w-10 place-items-center rounded-full bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)] text-[var(--em-text-3)]"
        >
          {icon}
        </span>
      ) : null}
      <p className={cx("text-[var(--em-text)]", compact ? "em-body font-medium" : "em-title")}>
        {heading}
      </p>
      {text ? (
        <p className="em-body-sm max-w-64 text-[var(--em-text-3)]">{text}</p>
      ) : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
