"use client";

// Field — shared label / hint / error scaffolding for every form control.
// Wires ids + aria-describedby so controls only need to spread `fieldProps`.

import { useId } from "react";
import { cx } from "./cx";

export type FieldRenderProps = {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
  "aria-required": true | undefined;
};

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  /** Render-prop: receives id + aria wiring for the control. */
  children: (props: FieldRenderProps) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="em-eyebrow cursor-pointer select-none">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-[var(--em-ember-text)]">
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        "aria-required": required ? true : undefined,
      })}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="em-body-sm text-[var(--em-segnale-text)]"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="em-body-sm text-[var(--em-text-3)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
