// RoutineRow — list item with emoji + text + checkbox.
// - When `onToggle` is provided: renders as a button (interactive client usage).
// - Otherwise: renders as a div (pure presentational, wrap in a <form action={...}>
//   with hidden inputs for server-action interaction).
// `text` can be a string with arrow chains ("Water → brush teeth") or any ReactNode.
//
// Pulse extension: when `module` is set, a 3px colored stripe runs along the
// left edge tinted by the module's accent + a soft glow. Status dot variants
// `done | now | next | skipped` are exposed via `status`. Both additive.

import type { ReactNode } from "react";
import { MODULE_TONE, type ModuleKey } from "@/lib/types";

const TONE_VAR: Record<string, string> = {
  good: "var(--color-accent-good)",
  warn: "var(--color-accent-warn)",
  bad: "var(--color-accent-bad)",
  info: "var(--color-accent-info)",
  energy: "var(--color-accent-energy)",
};

const STATUS_DOT: Record<NonNullable<RoutineStatus>, string> = {
  done: "bg-accent-good",
  now: "bg-accent-energy",
  next: "bg-text-muted/50",
  skipped: "bg-accent-bad/40",
};

type RoutineStatus = "done" | "now" | "next" | "skipped";

type CommonProps = {
  emoji?: string;
  text: ReactNode;
  checked?: boolean;
  trailing?: ReactNode;
  italic?: boolean;
  /** Pulse: paints a 3px colored stripe on the left edge tinted by module. */
  module?: ModuleKey;
  /** Pulse: optional status dot at the right edge (replaces default checkbox). */
  status?: RoutineStatus;
};

type Props =
  | (CommonProps & { onToggle: () => void })
  | (CommonProps & { onToggle?: undefined });

export function RoutineRow(props: Props) {
  const { emoji, text, checked = false, trailing, italic = false, module: mod, status } = props;
  const interactive = "onToggle" in props && typeof props.onToggle === "function";
  const hasArrow = typeof text === "string" && text.includes("→");
  const italicCls = italic || hasArrow ? "italic" : "";
  const textCls = `flex-1 text-sm leading-snug ${
    checked ? "text-text-muted line-through" : "text-text-primary"
  } ${italicCls}`.trim();

  // Resolve the stripe color: chameleon_os uses the dedicated violet token,
  // every other module maps to its tone accent via MODULE_TONE.
  const stripeColor = mod
    ? mod === "chameleon_os"
      ? "var(--color-module-violet)"
      : TONE_VAR[MODULE_TONE[mod]]
    : null;

  const trailingNode = trailing ?? (status ? <StatusDot status={status} /> : <Checkbox checked={checked} />);

  const inner = (
    <>
      {stripeColor ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{
            background: stripeColor,
            boxShadow: `0 0 12px ${stripeColor}80`,
          }}
        />
      ) : null}
      {emoji ? (
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg text-base"
          aria-hidden="true"
        >
          {emoji}
        </span>
      ) : null}
      <span className={textCls}>{text}</span>
      {trailingNode}
    </>
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={(props as { onToggle: () => void }).onToggle}
        className="group relative flex w-full items-center gap-3 py-2.5 text-left transition-opacity active:opacity-70"
        aria-pressed={checked}
      >
        {inner}
      </button>
    );
  }

  return <div className="relative flex items-center gap-3 py-2.5">{inner}</div>;
}

export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
        checked
          ? "border-accent-good bg-accent-good"
          : "border-border bg-bg group-hover:border-text-muted"
      }`}
    >
      {checked ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3 text-bg" aria-hidden="true">
          <path
            d="M3 8l3 3 7-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

function StatusDot({ status }: { status: RoutineStatus }) {
  return (
    <span
      aria-hidden="true"
      className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[status]} ${
        status === "now" ? "shadow-[0_0_8px_var(--color-accent-energy)]" : ""
      }`}
    />
  );
}
