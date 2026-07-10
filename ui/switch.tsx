"use client";

// Switch — role="switch" button with a sliding thumb; optional form value
// via hidden input. Instant, tactile, 44px row.

import { useControllable } from "./internal";
import { cx } from "./cx";

export function Switch({
  label,
  description,
  checked,
  defaultChecked = false,
  onChange,
  disabled,
  name,
  className,
}: {
  label: string;
  description?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** When set, a hidden input posts "on"/"" with the form. */
  name?: string;
  className?: string;
}) {
  const [isOn, setOn] = useControllable(checked, defaultChecked, onChange);

  return (
    <div
      className={cx(
        "flex min-h-[var(--em-tap-min)] items-center justify-between gap-4 py-1",
        disabled && "pointer-events-none opacity-45",
        className,
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="em-body text-[var(--em-text)]">{label}</span>
        {description ? (
          <span className="em-body-sm text-[var(--em-text-3)]">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOn(!isOn)}
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-[var(--em-dur-control)]",
          isOn
            ? "bg-[var(--em-ember)]"
            : "bg-[color-mix(in_srgb,var(--em-text)_18%,transparent)]",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.3)]",
            "transition-[left] duration-[var(--em-dur-control)] ease-[var(--em-ease-out)]",
            isOn ? "left-6" : "left-1",
          )}
        />
      </button>
      {name ? (
        <input type="hidden" name={name} value={isOn ? "on" : ""} />
      ) : null}
    </div>
  );
}
