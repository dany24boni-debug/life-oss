"use client";

// Tabs — underline style, roving tabindex, arrow-key navigation,
// horizontally scrollable when overflowing.

import { useRef } from "react";
import { cx } from "./cx";
import { useControllable, useDomId } from "./internal";

export type TabItem = { value: string; label: string; disabled?: boolean };

export function Tabs({
  items,
  value,
  defaultValue,
  onChange,
  className,
  children,
}: {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  /** Render-prop for the active panel content. */
  children?: (active: string) => React.ReactNode;
}) {
  const first = items.find((t) => !t.disabled)?.value ?? items[0]?.value ?? "";
  const [active, setActive] = useControllable(
    value,
    defaultValue ?? first,
    onChange,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const baseId = useDomId("em-tabs");

  function onKeyDown(e: React.KeyboardEvent) {
    const enabled = items.filter((t) => !t.disabled);
    const idx = enabled.findIndex((t) => t.value === active);
    let next: TabItem | undefined;
    if (e.key === "ArrowRight") next = enabled[(idx + 1) % enabled.length];
    if (e.key === "ArrowLeft")
      next = enabled[(idx - 1 + enabled.length) % enabled.length];
    if (e.key === "Home") next = enabled[0];
    if (e.key === "End") next = enabled[enabled.length - 1];
    if (next) {
      e.preventDefault();
      setActive(next.value);
      listRef.current
        ?.querySelector<HTMLElement>(`[data-value="${next.value}"]`)
        ?.focus();
    }
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 overflow-x-auto border-b border-[var(--em-hairline)]"
      >
        {items.map((t) => {
          const isActive = t.value === active;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              data-value={t.value}
              id={`${baseId}-tab-${t.value}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${t.value}`}
              tabIndex={isActive ? 0 : -1}
              disabled={t.disabled}
              onClick={() => setActive(t.value)}
              className={cx(
                "relative -mb-px min-h-[var(--em-tap-min)] whitespace-nowrap px-3.5 pb-2.5 pt-2",
                "em-body-sm font-medium transition-colors duration-[var(--em-dur-control)]",
                isActive
                  ? "text-[var(--em-text)]"
                  : "text-[var(--em-text-3)] hover:text-[var(--em-text-2)]",
                t.disabled && "pointer-events-none opacity-40",
              )}
            >
              {t.label}
              <span
                aria-hidden="true"
                className={cx(
                  "absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-[background] duration-[var(--em-dur-control)]",
                  isActive ? "bg-[var(--em-ember)]" : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>
      {children ? (
        <div
          role="tabpanel"
          id={`${baseId}-panel-${active}`}
          aria-labelledby={`${baseId}-tab-${active}`}
          tabIndex={0}
          className="pt-4"
        >
          {children(active)}
        </div>
      ) : null}
    </div>
  );
}
