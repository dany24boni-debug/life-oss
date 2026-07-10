"use client";

// Input / Textarea — 16px font floor (prevents iOS focus zoom), shared
// visual frame, error styling via aria-invalid.

import { useRef } from "react";
import { cx } from "./cx";

export const inputFrame = (invalid?: boolean) =>
  cx(
    "w-full bg-[var(--em-surface)] text-[var(--em-text)] placeholder:text-[var(--em-text-3)]",
    "rounded-[var(--em-r-md)] px-4",
    "shadow-[0_0_0_1px_var(--em-hairline)]",
    "transition-[box-shadow,background] duration-[var(--em-dur-control)]",
    "hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]",
    "focus:outline-none focus:shadow-[0_0_0_2px_var(--em-focus-ring)]",
    "disabled:opacity-45 disabled:pointer-events-none",
    "text-[length:var(--em-fs-body)]",
    invalid &&
      "shadow-[0_0_0_1px_var(--em-segnale)] focus:shadow-[0_0_0_2px_var(--em-segnale)]",
  );

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  ref?: React.Ref<HTMLInputElement>;
};

export function Input({ className, ref, ...rest }: InputProps) {
  return (
    <input
      ref={ref}
      className={cx(
        inputFrame(rest["aria-invalid"] === true),
        "h-[var(--em-control-h-md)]",
        className,
      )}
      {...rest}
    />
  );
}

export type TextareaProps =
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    /** Grow with content up to maxRows (default 8). */
    autoGrow?: boolean;
    maxRows?: number;
  };

export function Textarea({
  className,
  autoGrow = true,
  maxRows = 8,
  onInput,
  rows = 3,
  ...rest
}: TextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function handleInput(e: Parameters<NonNullable<TextareaProps["onInput"]>>[0]) {
    if (autoGrow && innerRef.current) {
      const el = innerRef.current;
      el.style.height = "auto";
      const lineHeight = 24; // --em-lh-body in px
      const max = maxRows * lineHeight + 24; // + vertical padding
      el.style.height = `${Math.min(el.scrollHeight, max)}px`;
    }
    onInput?.(e);
  }

  return (
    <textarea
      ref={innerRef}
      rows={rows}
      onInput={handleInput}
      className={cx(
        inputFrame(rest["aria-invalid"] === true),
        "resize-none py-3 leading-[var(--em-lh-body)]",
        className,
      )}
      {...rest}
    />
  );
}
