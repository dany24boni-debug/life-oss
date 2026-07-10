"use client";

import { useState } from "react";

// DateToggle — Sprint U1 (riusato in U2/U3).
//
// Pattern unificato di input data per tutti i form di Life OS:
// 1. Mostra "📅 Oggi" (o la data fornita) come label compatto.
// 2. Link discreto "Cambia" → toggle che svela <input type="date">.
// 3. Emit di un hidden input `name={name}` con sempre il valore
//    corrente, così il form server-side legge un singolo campo
//    YYYY-MM-DD.
//
// Per supportare edit retroattivo: passa `defaultValue` con la
// data dell'entry esistente. Lo state interno parte da "custom"
// se defaultValue ≠ defaultDate (= oggi), altrimenti da "today".
//
// A11y: il toggle è un <button type="button"> con aria-expanded;
// l'<input type="date"> ha un <label sr-only> associato per id.
// Min-h 44px sul trigger (target size WCAG 2.5.8).
//
// NIENTE state esterno richiesto: si autopilota. Se vuoi
// controllarlo dall'esterno in futuro, accetta una prop
// `onChange` e fai il pattern controlled — V2.

type Props = {
  /** Form field name emitted in the hidden input. */
  name: string;
  /** YYYY-MM-DD — today's date in the user's timezone (server-computed). */
  defaultDate: string;
  /**
   * Optional pre-filled value (e.g. when editing an existing
   * entry whose date differs from today). When omitted or
   * equal to defaultDate, starts collapsed in "today" mode.
   */
  defaultValue?: string;
  /** Stable id prefix for the input/label pair. */
  id?: string;
};

function formatIt(ymd: string): string {
  // YYYY-MM-DD → it-IT short date. Anchored at noon UTC to avoid
  // TZ drift on the boundary day.
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function DateToggle({ name, defaultDate, defaultValue, id }: Props) {
  const initial = defaultValue && defaultValue !== defaultDate
    ? { mode: "custom" as const, value: defaultValue }
    : { mode: "today" as const, value: defaultDate };

  const [mode, setMode] = useState<"today" | "custom">(initial.mode);
  const [value, setValue] = useState<string>(initial.value);

  const inputId = id ?? `date-toggle-${name}`;
  const isToday = mode === "today";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input type="hidden" name={name} value={value} />

      <span className="inline-flex min-h-[44px] items-center rounded-md border border-border bg-bg px-3 text-sm text-text-secondary">
        <span aria-hidden="true">📅</span>
        <span className="ml-2 tabular-nums">
          {isToday ? "Oggi" : formatIt(value)}
        </span>
      </span>

      {/* Single disclosure toggle: aria-expanded reflects the
          state of the controlled date input. The button label
          flips between "Cambia" and "Torna a oggi" so the action
          is always self-describing. ECC mid-sprint U1 fix:
          previous design rendered two different buttons with
          inconsistent aria-expanded semantics. */}
      <button
        type="button"
        onClick={() => {
          if (isToday) {
            setMode("custom");
          } else {
            setMode("today");
            setValue(defaultDate);
          }
        }}
        aria-expanded={!isToday}
        aria-controls={inputId}
        className="inline-flex min-h-[44px] items-center rounded-md px-2 text-xs text-text-muted underline transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {isToday ? "Cambia" : "Torna a oggi"}
      </button>

      {/* Date input always rendered so aria-controls points to a
          real DOM node. Label + input wrapped together in a
          single hidden container when collapsed — the label is
          inside the display:none subtree, so JAWS forms-mode
          can't surface an orphaned label. ECC end-of-sprint U1
          MEDIUM M3 close. */}
      <div className={isToday ? "hidden" : "contents"}>
        <label htmlFor={inputId} className="sr-only">
          Data
        </label>
        <input
          id={inputId}
          type="date"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (!next || next === defaultDate) {
              // Cleared or typed today's date manually — snap back
              // to "today" mode so the visible chip label and the
              // state are consistent (ECC end-of-sprint U1 LOW L4).
              setMode("today");
              setValue(defaultDate);
            } else {
              setValue(next);
            }
          }}
          className="min-h-[44px] rounded-md border border-border bg-bg px-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
        />
      </div>
    </div>
  );
}
