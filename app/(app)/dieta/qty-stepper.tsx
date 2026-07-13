"use client";

/**
 * Stepper di quantità nelle unità della basis (g o pezzi): −/+ da 44px
 * col passo giusto (10 g / 1 pz) e valore tappabile che apre l'input
 * inline (virgola o punto; garbage → ripristino silenzioso).
 */

import { useState } from "react";
import { cx } from "@/ui";
import type { FoodBasis } from "@/data/schemas";
import { formatQty, parseQtyInput, qtyStep } from "./logic";

export function QtyStepper({
  qty,
  basis,
  onChange,
  label,
}: {
  qty: number;
  basis: FoodBasis;
  onChange: (qty: number) => void;
  /** Nome accessibile ("Quantità di Pasta"). */
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const step = qtyStep(basis);

  function bump(delta: number) {
    const next = Math.round((qty + delta) * 10) / 10;
    if (next > 0 && next <= 10_000) onChange(next);
  }

  function commit() {
    setEditing(false);
    const parsed = parseQtyInput(draft);
    if (parsed !== null) onChange(parsed);
  }

  const btn =
    "grid h-11 w-11 shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] active:bg-[var(--em-ember-tint)]";

  return (
    <span
      role="group"
      aria-label={label}
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        aria-label={`${label}: meno ${step}`}
        className={btn}
        onClick={() => bump(-step)}
      >
        −
      </button>
      {editing ? (
        <input
          autoFocus
          inputMode="decimal"
          value={draft}
          aria-label={label}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className={cx(
            "em-body em-num h-11 w-20 rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-2 text-center text-[var(--em-text)]",
            "shadow-[0_0_0_1px_var(--em-hairline-strong)] outline-none",
          )}
        />
      ) : (
        <button
          type="button"
          aria-label={`${label}: scrivi il valore`}
          onClick={() => {
            setDraft(String(qty).replace(".", ","));
            setEditing(true);
          }}
          className="em-body em-num grid h-11 min-w-20 place-items-center rounded-[var(--em-r-sm)] px-2 text-[var(--em-text)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
        >
          {formatQty(qty, basis)}
        </button>
      )}
      <button
        type="button"
        aria-label={`${label}: più ${step}`}
        className={btn}
        onClick={() => bump(step)}
      >
        +
      </button>
    </span>
  );
}
