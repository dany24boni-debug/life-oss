"use client";

// TimePicker — input-shaped trigger + popover: free typing on top
// ("8.30" -> 08:30, lenient Italian forms) and two scroll columns
// (ore / minuti in 5' steps). 24h. No native <input type="time">.

import { useEffect, useRef, useState } from "react";
import { cx } from "./cx";
import { inputFrame } from "./input";
import {
  useControllable,
  useEscape,
  useOnClickOutside,
} from "./internal";
import { isValidTime, parseTimeLoose, type TimeString } from "./calendar-core";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  String(i * 5).padStart(2, "0"),
);

export type TimePickerProps = {
  value?: TimeString | null;
  defaultValue?: TimeString | null;
  onChange?: (time: TimeString | null) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  name?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  className?: string;
};

export function TimePicker({
  value,
  defaultValue = null,
  onChange,
  placeholder = "--:--",
  disabled,
  clearable = true,
  name,
  id,
  className,
  ...aria
}: TimePickerProps) {
  const [selected, setSelected] = useControllable<TimeString | null>(
    value,
    defaultValue,
    onChange,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minColRef = useRef<HTMLDivElement>(null);

  useOnClickOutside([triggerRef, popRef], () => setOpen(false), open);
  useEscape(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, open);

  const [h, m] = (selected ?? "--:--").split(":");

  // Scroll the selected hour/minute into view when opening.
  useEffect(() => {
    if (!open) return;
    requestAnimationFrame(() => {
      hourColRef.current
        ?.querySelector<HTMLElement>('[data-current="true"]')
        ?.scrollIntoView({ block: "center" });
      minColRef.current
        ?.querySelector<HTMLElement>('[data-current="true"]')
        ?.scrollIntoView({ block: "center" });
    });
  }, [open]);

  function commitDraft() {
    const parsed = parseTimeLoose(draft);
    if (parsed) {
      setSelected(parsed);
      setDraft("");
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  function setPart(part: "h" | "m", v: string) {
    const curH = isValidTime(selected ?? "") ? h : "09";
    const curM = isValidTime(selected ?? "") ? m : "00";
    const next: TimeString =
      part === "h" ? `${v}:${curM}` : `${curH}:${v}`;
    setSelected(next);
  }

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
          className={cx(
            "em-num truncate",
            !selected && "text-[var(--em-text-3)]",
          )}
        >
          {selected ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {clearable && selected && !disabled ? (
            // Spacer: il bottone Cancella vero è un SIBLING del trigger
            // (interattivo dentro <button> = albero ARIA invalido, run-13).
            <span aria-hidden="true" className="h-6 w-6" />
          ) : null}
          <ClockIcon />
        </span>
      </button>
      {clearable && selected && !disabled ? (
        <button
          type="button"
          aria-label="Cancella orario"
          onClick={() => setSelected(null)}
          className="absolute right-9 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_10%,transparent)] hover:text-[var(--em-text)]"
        >
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
        </button>
      ) : null}

      {name ? (
        <input type="hidden" name={name} value={selected ?? ""} />
      ) : null}

      {open ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label="Orario"
          className={cx(
            "absolute left-0 z-50 mt-1.5 w-64",
            "rounded-[var(--em-r-lg)] bg-[var(--em-surface-2)] p-3 shadow-[var(--em-e3)]",
            "animate-[em-pop-in_var(--em-dur-control)_var(--em-ease-out)]",
          )}
        >
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label="Scrivi un orario, per esempio 18:30"
            placeholder="Scrivi: 18:30"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            onBlur={() => draft && commitDraft()}
            className={cx(
              inputFrame(false),
              "em-num mb-3 h-11 bg-[var(--em-surface)] text-center",
            )}
          />
          <div className="flex gap-2">
            <TimeColumn
              ref={hourColRef}
              label="Ore"
              items={HOURS}
              current={h}
              onPick={(v) => setPart("h", v)}
            />
            <TimeColumn
              ref={minColRef}
              label="Minuti"
              items={MINUTES}
              current={m}
              onPick={(v) => setPart("m", v)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TimeColumn({
  ref,
  label,
  items,
  current,
  onPick,
}: {
  ref: React.Ref<HTMLDivElement>;
  label: string;
  items: string[];
  current: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex-1">
      <p className="em-eyebrow mb-1.5 text-center">{label}</p>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        onKeyDown={(e) => {
          // Contratto tastiera del listbox (run-13): un tab-stop per
          // colonna, frecce ↑/↓ e Home/End spostano valore e focus.
          const idx = items.indexOf(current);
          let next: string | undefined;
          if (e.key === "ArrowDown")
            next = items[Math.min(idx + 1, items.length - 1)];
          if (e.key === "ArrowUp") next = items[Math.max(idx - 1, 0)];
          if (e.key === "Home") next = items[0];
          if (e.key === "End") next = items[items.length - 1];
          if (next !== undefined && next !== current) {
            e.preventDefault();
            onPick(next);
            e.currentTarget
              .querySelector<HTMLElement>(`[data-value="${next}"]`)
              ?.focus();
          }
        }}
        className="h-44 overflow-y-auto overscroll-contain rounded-[var(--em-r-sm)] bg-[var(--em-surface)] p-1"
      >
        {items.map((v, i) => {
          const isCurrent = v === current;
          // Roving: tab-stop sul corrente; se il corrente non è in lista
          // (nessuna selezione), il primo item tiene il tab-stop.
          const isStop =
            isCurrent || (!items.includes(current) && i === 0);
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={isCurrent}
              data-current={isCurrent || undefined}
              data-value={v}
              tabIndex={isStop ? 0 : -1}
              onClick={() => onPick(v)}
              className={cx(
                "em-body em-num block w-full rounded-[var(--em-r-sm)] py-2 text-center",
                "transition-colors duration-[var(--em-dur-tap)]",
                isCurrent
                  ? "bg-[var(--em-ember)] font-semibold text-[var(--em-on-ember)]"
                  : "hover:bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
              )}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClockIcon() {
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
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}
