"use client";

// Calendar — month grid + week strip, Italian (Monday-first), fully custom.
// Keyboard: arrows move by day/week, PageUp/PageDown change month, Home/End
// jump to week bounds, Enter/Space select. Roving tabindex on the grid.
// Touch: horizontal swipe pages months. Today wears the ember dot.

import { useRef, useState } from "react";
import { cx } from "./cx";
import { useControllable } from "./internal";
import {
  addDays,
  addMonths,
  clampDay,
  formatDayShort,
  formatMonthYear,
  isSameMonth,
  monthMatrix,
  todayLocal,
  toDate,
  weekOf,
  WEEKDAYS_IT,
  type DayString,
} from "./calendar-core";

export type CalendarProps = {
  value?: DayString | null;
  defaultValue?: DayString | null;
  onChange?: (day: DayString) => void;
  min?: DayString;
  max?: DayString;
  /** Density markers under each day (0-3 dots), e.g. events/tasks count. */
  markers?: (day: DayString) => number;
  className?: string;
};

export function Calendar({
  value,
  defaultValue = null,
  onChange,
  min,
  max,
  markers,
  className,
}: CalendarProps) {
  const [selected, setSelected] = useControllable<DayString | null>(
    value,
    defaultValue,
    onChange as (v: DayString | null) => void,
  );
  const today = todayLocal();
  const [viewMonth, setViewMonth] = useState<DayString>(
    selected ?? today,
  );
  const [focusDay, setFocusDay] = useState<DayString>(selected ?? today);
  const gridRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const weeks = monthMatrix(viewMonth);

  function isDisabled(day: DayString) {
    return (min !== undefined && day < min) || (max !== undefined && day > max);
  }

  function moveFocus(next: DayString) {
    const clamped = clampDay(next, min, max);
    setFocusDay(clamped);
    if (!isSameMonth(clamped, viewMonth)) setViewMonth(clamped);
    // Focus follows after re-render.
    requestAnimationFrame(() => {
      gridRef.current
        ?.querySelector<HTMLElement>(`[data-day="${clamped}"]`)
        ?.focus();
    });
  }

  function onGridKeyDown(e: React.KeyboardEvent) {
    const map: Record<string, () => DayString> = {
      ArrowLeft: () => addDays(focusDay, -1),
      ArrowRight: () => addDays(focusDay, 1),
      ArrowUp: () => addDays(focusDay, -7),
      ArrowDown: () => addDays(focusDay, 7),
      PageUp: () => addMonths(focusDay, -1),
      PageDown: () => addMonths(focusDay, 1),
      Home: () => weekOf(focusDay)[0],
      End: () => weekOf(focusDay)[6],
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      moveFocus(fn());
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!isDisabled(focusDay)) setSelected(focusDay);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setViewMonth((m) => addMonths(m, dx < 0 ? 1 : -1));
    }
  }

  return (
    <div className={cx("select-none", className)}>
      {/* Header: month + nav */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p aria-live="polite" className="em-title text-[var(--em-text)]">
          {formatMonthYear(viewMonth)}
        </p>
        <div className="flex items-center gap-1">
          <NavButton
            label="Mese precedente"
            onClick={() => setViewMonth((m) => addMonths(m, -1))}
          >
            <path d="M15 6l-6 6 6 6" />
          </NavButton>
          <button
            type="button"
            onClick={() => {
              setViewMonth(today);
              moveFocus(today);
            }}
            className="em-body-sm h-9 rounded-[var(--em-r-sm)] px-2.5 font-medium text-[var(--em-ember-text)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[var(--em-ember-tint)]"
          >
            Oggi
          </button>
          <NavButton
            label="Mese successivo"
            onClick={() => setViewMonth((m) => addMonths(m, 1))}
          >
            <path d="M9 6l6 6-6 6" />
          </NavButton>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7" aria-hidden="true">
        {WEEKDAYS_IT.map((d) => (
          <div key={d} className="em-eyebrow pb-2 text-center">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={formatMonthYear(viewMonth)}
        onKeyDown={onGridKeyDown}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="grid grid-cols-7 gap-y-0.5"
      >
        {weeks.flat().map((day) => {
          const inMonth = isSameMonth(day, viewMonth);
          const disabled = isDisabled(day);
          const isSelected = day === selected;
          const isToday = day === today;
          const markerCount = markers ? Math.min(markers(day), 3) : 0;
          return (
            <button
              key={day}
              type="button"
              role="gridcell"
              data-day={day}
              tabIndex={day === focusDay ? 0 : -1}
              aria-selected={isSelected || undefined}
              aria-label={formatDayShort(day)}
              aria-disabled={disabled || undefined}
              disabled={disabled}
              onClick={() => {
                setFocusDay(day);
                if (!isSameMonth(day, viewMonth)) setViewMonth(day);
                setSelected(day);
              }}
              className={cx(
                "relative mx-auto flex h-11 w-11 flex-col items-center justify-center rounded-full",
                "em-body em-num transition-colors duration-[var(--em-dur-tap)]",
                isSelected
                  ? "bg-[var(--em-ember)] font-semibold text-[var(--em-on-ember)]"
                  : "hover:bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
                !inMonth && !isSelected && "text-[var(--em-text-3)] opacity-60",
                disabled && "pointer-events-none opacity-25",
              )}
            >
              {toDate(day).getDate()}
              {/* today: the ember dot; markers: quiet dots */}
              {isToday && !isSelected ? (
                <span className="em-dot absolute bottom-1.5" />
              ) : markerCount > 0 && !isSelected ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 flex gap-0.5"
                >
                  {Array.from({ length: markerCount }).map((_, i) => (
                    <span
                      key={i}
                      className="h-1 w-1 rounded-full bg-[var(--em-text-3)]"
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)] hover:text-[var(--em-text)]"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4.5 w-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}

/* ── Week strip — the Today-view variant ─────────────────────────────── */

export function WeekStrip({
  value,
  onChange,
  markers,
  className,
}: {
  value?: DayString;
  onChange?: (day: DayString) => void;
  markers?: (day: DayString) => number;
  className?: string;
}) {
  const today = todayLocal();
  const [selected, setSelected] = useControllable<DayString>(
    value,
    today,
    onChange,
  );
  const days = weekOf(selected);

  return (
    <div
      className={cx("flex justify-between gap-1", className)}
      role="listbox"
      aria-label="Settimana"
    >
      {days.map((day) => {
        const isSelected = day === selected;
        const isToday = day === today;
        const markerCount = markers ? Math.min(markers(day), 3) : 0;
        return (
          <button
            key={day}
            type="button"
            role="option"
            aria-selected={isSelected}
            onClick={() => setSelected(day)}
            className={cx(
              "flex min-w-11 flex-1 flex-col items-center gap-1 rounded-[var(--em-r-md)] py-2",
              "transition-colors duration-[var(--em-dur-tap)]",
              isSelected
                ? "bg-[var(--em-surface-2)] shadow-[var(--em-e1)]"
                : "hover:bg-[color-mix(in_srgb,var(--em-text)_6%,transparent)]",
            )}
          >
            <span className="em-eyebrow">
              {WEEKDAYS_IT[(toDate(day).getDay() + 6) % 7]}
            </span>
            <span
              className={cx(
                "em-body em-num font-semibold",
                isToday
                  ? "text-[var(--em-ember-text)]"
                  : "text-[var(--em-text)]",
              )}
            >
              {toDate(day).getDate()}
            </span>
            {isToday ? (
              <span className="em-dot" />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-1.5 items-center gap-0.5"
              >
                {Array.from({ length: markerCount }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1 w-1 rounded-full bg-[var(--em-text-3)]"
                  />
                ))}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
