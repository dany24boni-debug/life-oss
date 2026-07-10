"use client";

// RadioGroup — native radios under custom dots; fieldset+legend semantics.

import { useId } from "react";
import { cx } from "./cx";

export type RadioOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export function RadioGroup({
  legend,
  options,
  value,
  defaultValue,
  onChange,
  name,
  disabled,
  className,
}: {
  legend: string;
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const autoName = useId();
  return (
    <fieldset
      disabled={disabled}
      className={cx("min-w-0 disabled:opacity-45", className)}
    >
      <legend className="em-eyebrow mb-2">{legend}</legend>
      <div className="flex flex-col">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={cx(
              "flex min-h-[var(--em-tap-min)] cursor-pointer select-none items-start gap-3 py-2",
              opt.disabled && "pointer-events-none opacity-45",
            )}
          >
            <span className="relative mt-0.5 inline-flex h-6 w-6 shrink-0">
              <input
                type="radio"
                name={name ?? autoName}
                value={opt.value}
                checked={value !== undefined ? value === opt.value : undefined}
                defaultChecked={
                  defaultValue !== undefined
                    ? defaultValue === opt.value
                    : undefined
                }
                disabled={opt.disabled}
                onChange={() => onChange?.(opt.value)}
                className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full shadow-[0_0_0_1px_var(--em-hairline-strong)] transition-[box-shadow] duration-[var(--em-dur-tap)] checked:shadow-[0_0_0_2px_var(--em-ember)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 m-auto h-3 w-3 scale-0 rounded-full bg-[var(--em-ember)] transition-transform duration-[var(--em-dur-tap)] peer-checked:scale-100"
              />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="em-body text-[var(--em-text)]">{opt.label}</span>
              {opt.description ? (
                <span className="em-body-sm text-[var(--em-text-3)]">
                  {opt.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
