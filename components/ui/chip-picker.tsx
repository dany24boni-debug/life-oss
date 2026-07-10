"use client";

import { useState } from "react";

// ChipPicker — Sprint U2 generalization of the U1
// MuscleGroupChips. Supporta entrambi i pattern di selezione:
//
//   mode="multi"  → multi-select toggle (es. muscle groups in
//                   /gym, ognuno indipendente).
//   mode="single" → single-select tipo radio (es. categoria
//                   spesa in /finance Uscite; click sullo stesso
//                   chip lo deseleziona, click su un altro lo
//                   sostituisce).
//
// In entrambi i modi i chip sono `<button aria-pressed>` —
// semantica BUTTON, NON radiogroup, quindi APG roving-tabindex
// non applica e ogni chip è un Tab stop separato.
//
// Submit per mode:
//   - multi:  N `<input type="hidden" name={name} value={v}>`
//             (uno per ogni selezionato). Server: parseFormDataMulti.
//   - single: 1 `<input type="hidden" name={name} value={v}>` se
//             c'è un selezionato, altrimenti nessuno. Server:
//             parseFormData OK perché single-value.
//
// Hidden iteration su `options` (non sullo state) → DOM order
// deterministico, payload riproducibile.
//
// A11y: aria-pressed riflette lo stato del chip; il gruppo si
// nomina via aria-labelledby (preferred) o aria-label (fallback).
// Min-h 44px (WCAG 2.5.8) + focus-visible:ring (2.4.11).
//
// Live region "X selezionati" → V2 con useFormState (consistent
// con altre status messages deferred in U1/U2).

export type ChipOption = {
  value: string;
  label: string;
  /** Optional emoji rendered to the left of the label. */
  emoji?: string;
};

type Props = {
  /** Hidden input name. Multi emette N inputs, single emette 0/1. */
  name: string;
  /** Vocabolario completo dei chip disponibili. */
  options: ReadonlyArray<ChipOption>;
  /**
   * "multi" (default) o "single". In single il click sullo stesso
   * chip toggla off; click su un altro chip sostituisce.
   */
  mode?: "multi" | "single";
  /**
   * Stato iniziale. Per mode "single" usa solo il primo elemento
   * (gli altri vengono ignorati con un console.warn in dev).
   */
  defaultSelected?: ReadonlyArray<string>;
  /**
   * Naming — pass either. ariaLabelledBy punta all'id di un
   * heading visibile (preferred, WCAG 1.3.1). ariaLabel fallback.
   */
  ariaLabel?: string;
  ariaLabelledBy?: string;
};

export function ChipPicker({
  name,
  options,
  mode = "multi",
  defaultSelected,
  ariaLabel,
  ariaLabelledBy,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    if (!defaultSelected || defaultSelected.length === 0) return new Set();
    if (mode === "single") {
      // In single mode keep only the first preselected value —
      // emit a dev warning if the caller passed more than one
      // (it's a programming error, but we silently degrade rather
      // than throw to avoid breaking the form).
      if (defaultSelected.length > 1 && process.env.NODE_ENV !== "production") {
        console.warn(
          `[ChipPicker name="${name}"] mode="single" but defaultSelected has ${defaultSelected.length} entries; using only the first.`,
        );
      }
      return new Set([defaultSelected[0]]);
    }
    return new Set(defaultSelected);
  });

  function toggle(value: string) {
    setSelected((prev) => {
      if (mode === "single") {
        // Same chip clicked again → deselect; different chip →
        // replace. Either way the new set has 0 or 1 element.
        if (prev.has(value)) return new Set();
        return new Set([value]);
      }
      // multi
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <div
      role="group"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Seleziona")}
      aria-labelledby={ariaLabelledBy}
      className="flex flex-wrap gap-2"
    >
      {options.map((opt) => {
        const active = selected.has(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(opt.value)}
            className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
              active
                ? "border-accent-energy bg-accent-energy/10 text-accent-energy"
                : "border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
            }`}
          >
            {opt.emoji ? (
              <span aria-hidden="true">{opt.emoji}</span>
            ) : null}
            <span>{opt.label}</span>
          </button>
        );
      })}

      {/* Hidden inputs in options-order (not Set-order) → DOM order
          deterministico indipendentemente dall'ordine di click. */}
      {options.map((opt) =>
        selected.has(opt.value) ? (
          <input
            key={`hidden-${opt.value}`}
            type="hidden"
            name={name}
            value={opt.value}
          />
        ) : null,
      )}
    </div>
  );
}
