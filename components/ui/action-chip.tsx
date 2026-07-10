// ActionChip — tappable rounded outline chip used in top-of-screen action rows.
// Polymorphic: renders as <Link> when href is provided, else as a <button>
// (defaults to type="submit" so it integrates with parent <form action={...}>).
//
// Pulse: subtle hover lift (translateY -1px) and tap squeeze (scale 0.96).
// Optional `tone="energy"` switches to the gradient CTA variant per
// --grad-energy. Both via transform/opacity only (GPU-friendly).

import Link from "next/link";
import type { ReactNode } from "react";

type Tone = "neutral" | "energy";

type Common = {
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  tone?: Tone;
};

type AsLink = Common & { href: string; type?: never; formAction?: never };
type AsButton = Common & {
  href?: undefined;
  type?: "submit" | "button";
  formAction?: string;
};

const NEUTRAL =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-3.5 py-1.5 text-xs font-medium text-text-secondary " +
  "transition-[transform,colors,box-shadow] duration-150 ease-out " +
  "hover:-translate-y-px hover:border-text-muted hover:bg-surface hover:text-text-primary " +
  "active:scale-[0.96] active:translate-y-0";

const ENERGY =
  "inline-flex items-center gap-1.5 rounded-full border border-accent-energy/40 px-3.5 py-1.5 text-xs font-semibold text-bg " +
  "transition-[transform,box-shadow] duration-150 ease-out " +
  "hover:-translate-y-px hover:shadow-[0_8px_18px_-6px_var(--color-accent-energy)] " +
  "active:scale-[0.96] active:translate-y-0";

const ENERGY_STYLE: React.CSSProperties = {
  backgroundImage: "var(--grad-energy)",
};

function classFor(tone: Tone | undefined): string {
  return tone === "energy" ? ENERGY : NEUTRAL;
}

function styleFor(tone: Tone | undefined): React.CSSProperties | undefined {
  return tone === "energy" ? ENERGY_STYLE : undefined;
}

export function ActionChip(props: AsLink | AsButton) {
  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={`${classFor(props.tone)} ${props.className ?? ""}`}
        style={styleFor(props.tone)}
      >
        {props.icon ? (
          <span className={props.tone === "energy" ? "text-bg" : "text-text-muted"} aria-hidden="true">
            {props.icon}
          </span>
        ) : null}
        <span>{props.children}</span>
      </Link>
    );
  }

  const { type = "submit", icon, children, className, tone } = props as AsButton;
  return (
    <button
      type={type}
      className={`${classFor(tone)} ${className ?? ""}`}
      style={styleFor(tone)}
    >
      {icon ? (
        <span className={tone === "energy" ? "text-bg" : "text-text-muted"} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
