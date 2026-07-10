"use client";

// Select — fully custom combobox+listbox (WAI-ARIA APG pattern).
// Focus stays on the trigger; the active option is conveyed via
// aria-activedescendant. Arrow/Home/End navigation, Enter/Space select,
// Esc closes, first-letter typeahead. No native <select> anywhere.

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "./cx";
import { inputFrame } from "./input";
import {
  useControllable,
  useDomId,
  useEscape,
  useOnClickOutside,
} from "./internal";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

export type SelectProps = {
  options: SelectOption[];
  value?: string | null;
  defaultValue?: string | null;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Posts the value with a form. */
  name?: string;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  className?: string;
};

export function Select({
  options,
  value,
  defaultValue = null,
  onChange,
  placeholder = "Seleziona",
  disabled,
  name,
  id,
  className,
  ...aria
}: SelectProps) {
  const [selected, setSelected] = useControllable<string | null>(
    value,
    defaultValue,
    onChange as (v: string | null) => void,
  );
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ query: "", at: 0 });
  const listboxId = useDomId("em-listbox");

  const selectedOption = useMemo(
    () => options.find((o) => o.value === selected) ?? null,
    [options, selected],
  );

  useOnClickOutside([triggerRef, listRef], () => setOpen(false), open);
  useEscape(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, open);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function openList() {
    if (disabled) return;
    const idx = options.findIndex((o) => o.value === selected && !o.disabled);
    setActiveIndex(idx >= 0 ? idx : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }

  function commit(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    setSelected(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function move(from: number, delta: 1 | -1): number {
    let i = from;
    for (let step = 0; step < options.length; step++) {
      i = (i + delta + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => move(i, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => move(i, -1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(options.findIndex((o) => !o.disabled));
        break;
      case "End": {
        e.preventDefault();
        const last = [...options].reverse().findIndex((o) => !o.disabled);
        setActiveIndex(last >= 0 ? options.length - 1 - last : -1);
        break;
      }
      case "Enter":
      case " ":
        e.preventDefault();
        commit(activeIndex);
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // first-letter typeahead
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const now = Date.now();
          const t = typeahead.current;
          t.query = now - t.at > 600 ? e.key : t.query + e.key;
          t.at = now;
          const q = t.query.toLowerCase();
          const idx = options.findIndex(
            (o) => !o.disabled && o.label.toLowerCase().startsWith(q),
          );
          if (idx >= 0) setActiveIndex(idx);
        }
      }
    }
  }

  return (
    <div className={cx("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={
          open && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
        }
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={cx(
          inputFrame(aria["aria-invalid"] === true),
          "flex h-[var(--em-control-h-md)] items-center justify-between gap-2 text-left",
        )}
        {...aria}
      >
        <span
          className={cx(
            "truncate",
            !selectedOption && "text-[var(--em-text-3)]",
          )}
        >
          {selectedOption?.label ?? placeholder}
        </span>
        <Chevron open={open} />
      </button>

      {name ? (
        <input type="hidden" name={name} value={selected ?? ""} />
      ) : null}

      {open ? (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-label={placeholder}
          className={cx(
            "absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-64 overflow-auto overscroll-contain",
            "rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-1.5 shadow-[var(--em-e3)]",
            "animate-[em-pop-in_var(--em-dur-control)_var(--em-ease-out)]",
          )}
        >
          {options.map((opt, i) => {
            const isSelected = opt.value === selected;
            const isActive = i === activeIndex;
            return (
              <li
                key={opt.value}
                id={`${listboxId}-${i}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={opt.disabled || undefined}
                onPointerMove={() => !opt.disabled && setActiveIndex(i)}
                onClick={() => commit(i)}
                className={cx(
                  "flex min-h-[var(--em-tap-min)] cursor-pointer items-center justify-between gap-2 rounded-[var(--em-r-sm)] px-3 py-2",
                  isActive &&
                    "bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
                  opt.disabled && "cursor-default opacity-40",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="em-body truncate">{opt.label}</span>
                  {opt.description ? (
                    <span className="em-body-sm truncate text-[var(--em-text-3)]">
                      {opt.description}
                    </span>
                  ) : null}
                </span>
                {isSelected ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 shrink-0 stroke-[var(--em-ember-text)]"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cx(
        "h-4 w-4 shrink-0 stroke-[var(--em-text-3)] transition-transform duration-[var(--em-dur-control)]",
        open && "rotate-180",
      )}
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
