"use client";

// Checkbox — native <input type="checkbox"> underneath (keyboard, forms,
// screen readers for free), fully custom 24px visual in a 44px touch row.

import { useEffect, useRef } from "react";
import { cx } from "./cx";

export type CheckboxProps = {
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  name?: string;
  value?: string;
  onChange?: (checked: boolean) => void;
  className?: string;
};

export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  indeterminate = false,
  disabled,
  name,
  value,
  onChange,
  className,
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      className={cx(
        "group flex min-h-[var(--em-tap-min)] cursor-pointer select-none items-start gap-3 py-2",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <span className="relative mt-0.5 inline-flex h-6 w-6 shrink-0">
        <input
          ref={ref}
          type="checkbox"
          name={name}
          value={value}
          checked={checked}
          defaultChecked={defaultChecked}
          disabled={disabled}
          onChange={(e) => onChange?.(e.target.checked)}
          className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-[var(--em-r-sm)] shadow-[0_0_0_1px_var(--em-hairline-strong)] transition-[background,box-shadow] duration-[var(--em-dur-tap)] checked:bg-[var(--em-ember)] checked:shadow-none indeterminate:bg-[var(--em-ember)] indeterminate:shadow-none"
        />
        {/* check mark */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 m-auto h-4 w-4 scale-50 stroke-[var(--em-on-ember)] opacity-0 transition-[opacity,transform] duration-[var(--em-dur-tap)] peer-checked:scale-100 peer-checked:opacity-100 peer-indeterminate:scale-100 peer-indeterminate:opacity-0"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
        {/* indeterminate dash */}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="pointer-events-none absolute inset-0 m-auto h-4 w-4 stroke-[var(--em-on-ember)] opacity-0 transition-opacity duration-[var(--em-dur-tap)] peer-indeterminate:opacity-100"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        >
          <path d="M6 12h12" />
        </svg>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="em-body text-[var(--em-text)]">{label}</span>
        {description ? (
          <span className="em-body-sm text-[var(--em-text-3)]">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
