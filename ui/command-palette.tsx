"use client";

// CommandPalette shell — overlay + combobox input + grouped, fuzzy-filtered
// list. This is the SHELL (per B4): items and open-state come from the
// caller; global hotkey wiring belongs to a later phase.

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "./cx";
import {
  Portal,
  useDomId,
  useEscape,
  useFocusTrap,
  useLockBodyScroll,
} from "./internal";
import { EmptyState } from "./empty-state";

export type CommandItem = {
  id: string;
  label: string;
  group?: string;
  hint?: string;
  keywords?: string;
  onSelect: () => void;
};

/** Subsequence fuzzy match: every query char appears in order. */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function CommandPalette({
  open,
  onClose,
  items,
  placeholder = "Cerca o digita un comando",
  rank,
}: {
  open: boolean;
  onClose: () => void;
  items: CommandItem[];
  placeholder?: string;
  /**
   * Optional scorer (run-12): higher wins, null excludes. When absent,
   * the built-in boolean subsequence filter keeps the original order.
   */
  rank?: (query: string, item: CommandItem) => number | null;
}) {
  // The body mounts fresh on every open, so query/active state resets by
  // construction — no reset effects needed.
  if (!open) return null;
  return (
    <PaletteBody
      items={items}
      onClose={onClose}
      placeholder={placeholder}
      rank={rank}
    />
  );
}

function PaletteBody({
  onClose,
  items,
  placeholder,
  rank,
}: {
  onClose: () => void;
  items: CommandItem[];
  placeholder: string;
  rank?: (query: string, item: CommandItem) => number | null;
}) {
  const [query, setQueryRaw] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useDomId("em-cmdk");

  useFocusTrap(panelRef, true, "input");
  useLockBodyScroll(true);
  useEscape(onClose, true);

  // Query changes reset the active row — event-driven, not an effect.
  function setQuery(v: string) {
    setQueryRaw(v);
    setActiveIndex(0);
  }

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    if (rank) {
      // Ranked mode: score, drop nulls, best first (stable on ties).
      return items
        .map((it) => ({ it, score: rank(query, it) }))
        .filter((x): x is { it: CommandItem; score: number } =>
          x.score !== null,
        )
        .sort((a, b) => b.score - a.score)
        .map((x) => x.it);
    }
    return items.filter((it) =>
      fuzzyMatch(query, `${it.label} ${it.keywords ?? ""}`),
    );
  }, [items, query, rank]);

  // Grouped view preserving filter order.
  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>();
    for (const it of filtered) {
      const g = it.group ?? "Comandi";
      map.set(g, [...(map.get(g) ?? []), it]);
    }
    return [...map.entries()];
  }, [filtered]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function commit(index: number) {
    const item = filtered[index];
    if (!item) return;
    onClose();
    item.onSelect();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <Portal>
      <div className="em-scope fixed inset-0 z-[95] bg-transparent">
        <div
          aria-hidden="true"
          onClick={onClose}
          className="absolute inset-0 bg-[var(--em-overlay)] backdrop-blur-[2px] animate-[em-fade-in_var(--em-dur-control)_linear]"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Palette comandi"
          tabIndex={-1}
          className={cx(
            "absolute inset-x-4 top-[12dvh] mx-auto max-w-lg overflow-hidden",
            "rounded-[var(--em-r-lg)] bg-[var(--em-surface-2)] shadow-[var(--em-e3)]",
            "animate-[em-pop-in_var(--em-dur-card)_var(--em-ease-out)]",
          )}
        >
          <div className="flex items-center gap-3 border-b border-[var(--em-hairline)] px-4">
            <SearchIcon />
            <input
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-activedescendant={
                filtered.length > 0 ? `${listboxId}-${activeIndex}` : undefined
              }
              aria-label={placeholder}
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
              className="h-14 w-full bg-transparent text-[length:var(--em-fs-body)] text-[var(--em-text)] placeholder:text-[var(--em-text-3)] focus:outline-none"
            />
            <kbd className="em-eyebrow rounded-[4px] bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)] px-1.5 py-0.5">
              esc
            </kbd>
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Risultati"
            className="max-h-[50dvh] overflow-y-auto overscroll-contain p-2"
          >
            {filtered.length === 0 ? (
              <EmptyState
                compact
                heading="Nessun risultato"
                text="Prova con altre parole."
              />
            ) : (
              grouped.map(([group, groupItems]) => (
                <div key={group} className="mb-1">
                  <p className="em-eyebrow px-2 pb-1 pt-2">{group}</p>
                  {groupItems.map((it) => {
                    const index = filtered.indexOf(it);
                    const isActive = index === activeIndex;
                    return (
                      <div
                        key={it.id}
                        id={`${listboxId}-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={isActive}
                        onPointerMove={() => setActiveIndex(index)}
                        onClick={() => commit(index)}
                        className={cx(
                          "flex min-h-[var(--em-tap-min)] cursor-pointer items-center justify-between gap-3 rounded-[var(--em-r-sm)] px-2.5 py-2",
                          isActive &&
                            "bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)]",
                        )}
                      >
                        <span className="em-body truncate text-[var(--em-text)]">
                          {it.label}
                        </span>
                        {it.hint ? (
                          <span className="em-eyebrow shrink-0">{it.hint}</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4.5 w-4.5 shrink-0 stroke-[var(--em-text-3)]"
      fill="none"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}
