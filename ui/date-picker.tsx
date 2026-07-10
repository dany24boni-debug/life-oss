"use client";

// DatePicker — input-shaped trigger + popover Calendar. No native
// <input type="date"> anywhere. Posts "YYYY-MM-DD" via hidden input.

import { useRef, useState } from "react";
import { cx } from "./cx";
import { inputFrame } from "./input";
import { Calendar } from "./calendar";
import { useControllable, useEscape, useOnClickOutside } from "./internal";
import {
  formatDayShort,
  todayLocal,
  type DayString,
} from "./calendar-core";

export type DatePickerProps = {
  value?: DayString | null;
  defaultValue?: DayString | null;
  onChange?: (day: DayString | null) => void;
  min?: DayString;
  max?: DayString;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  name?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  className?: string;
};

export function DatePicker({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  placeholder = "Scegli una data",
  disabled,
  clearable = true,
  name,
  id,
  className,
  ...aria
}: DatePickerProps) {
  const [selected, setSelected] = useControllable<DayString | null>(
    value,
    defaultValue,
    onChange,
  );
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useOnClickOutside([triggerRef, popRef], () => setOpen(false), open);
  useEscape(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, open);

  const isToday = selected === todayLocal();

  return (
    <div className={cx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          inputFrame(aria["aria-invalid"] === true),
          "flex h-[var(--em-control-h-md)] items-center justify-between gap-2 text-left",
        )}
        {...aria}
      >
        <span
          className={cx("em-num truncate", !selected && "text-[var(--em-text-3)]")}
        >
          {selected
            ? isToday
              ? `Oggi · ${formatDayShort(selected)}`
              : formatDayShort(selected)
            : placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && selected && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Cancella data"
              onClick={(e) => {
                e.stopPropagation();
                setSelected(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelected(null);
                }
              }}
              className="grid h-6 w-6 place-items-center rounded-full text-[var(--em-text-3)] hover:bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)] hover:text-[var(--em-text)]"
            >
              <CrossIcon />
            </span>
          ) : null}
          <CalendarIcon />
        </span>
      </button>

      {name ? (
        <input type="hidden" name={name} value={selected ?? ""} />
      ) : null}

      {open ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Calendario"
          className={cx(
            "absolute left-0 z-50 mt-1.5 w-[calc(100vw-40px)] max-w-80",
            "rounded-[var(--em-r-lg)] bg-[var(--em-surface-2)] p-4 shadow-[var(--em-e3)]",
            "animate-[em-pop-in_var(--em-dur-control)_var(--em-ease-out)]",
          )}
        >
          <Calendar
            value={selected}
            onChange={(day) => {
              setSelected(day);
              setOpen(false);
              triggerRef.current?.focus();
            }}
            min={min}
            max={max}
          />
        </div>
      ) : null}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 stroke-[var(--em-text-3)]"
      fill="none"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 10h17M8.5 3v4M15.5 3v4" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
