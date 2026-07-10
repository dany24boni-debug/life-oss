"use client";

// Button — primary / secondary / ghost / destructive, three sizes.
// Loading replaces the label with a spinner while locking width, so layouts
// never jump. Always a real <button>.

import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-[var(--em-ember)] text-[var(--em-on-ember)] font-semibold " +
    "hover:bg-[color-mix(in_srgb,var(--em-ember)_88%,var(--em-text))] " +
    "active:bg-[color-mix(in_srgb,var(--em-ember)_80%,var(--em-ink))]",
  secondary:
    "bg-[var(--em-surface-2)] text-[var(--em-text)] font-medium " +
    "shadow-[0_0_0_1px_var(--em-hairline)] " +
    "hover:shadow-[0_0_0_1px_var(--em-hairline-strong)] " +
    "active:bg-[color-mix(in_srgb,var(--em-surface-2)_92%,var(--em-text))]",
  ghost:
    "bg-transparent text-[var(--em-text-2)] font-medium " +
    "hover:bg-[color-mix(in_srgb,var(--em-text)_7%,transparent)] hover:text-[var(--em-text)] " +
    "active:bg-[color-mix(in_srgb,var(--em-text)_11%,transparent)]",
  destructive:
    "bg-[var(--em-segnale)] text-white font-semibold " +
    "hover:bg-[color-mix(in_srgb,var(--em-segnale)_88%,var(--em-ink))] " +
    "active:bg-[color-mix(in_srgb,var(--em-segnale)_78%,var(--em-ink))]",
};

const SIZE: Record<Size, string> = {
  sm: "h-[var(--em-control-h-sm)] px-3 text-[length:var(--em-fs-body-sm)] rounded-[var(--em-r-sm)] gap-1.5",
  md: "h-[var(--em-control-h-md)] px-4 text-[length:var(--em-fs-body)] rounded-[var(--em-r-md)] gap-2",
  lg: "h-[var(--em-control-h-lg)] px-5 text-[length:var(--em-fs-body)] rounded-[var(--em-r-md)] gap-2",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Optional leading icon slot. */
  icon?: React.ReactNode;
  /** Stretch to container width. */
  block?: boolean;
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  icon,
  block,
  className,
  children,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type ?? "button"}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap",
        "transition-[background,box-shadow,color,opacity] duration-[var(--em-dur-control)]",
        VARIANT[variant],
        SIZE[size],
        block && "w-full",
        (disabled || loading) && "pointer-events-none",
        disabled && !loading && "opacity-45",
        className,
      )}
      {...rest}
    >
      <span
        className={cx(
          "inline-flex items-center justify-center gap-[inherit]",
          loading && "invisible",
        )}
      >
        {icon ? (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {icon}
          </span>
        ) : null}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      ) : null}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block animate-[em-spin_800ms_linear_infinite] rounded-full border-2 border-current border-t-transparent opacity-80"
      style={{ width: size, height: size }}
    />
  );
}
