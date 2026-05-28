"use client";

import { useState } from "react";
import { DateToggle } from "@/components/ui/date-toggle";
import {
  CATEGORIES,
  suggestCategory,
  type Category,
} from "@/lib/finance/auto-classify";

// ExpenseForm — Sprint U2 client form per /finance Uscite tab.
//
// Comportamento auto-classify:
//   - L'utente digita la nota.
//   - onChange della nota → ricalcola suggestCategory().
//   - Il chip "suggerito" si aggiorna AUTOMATICAMENTE finché
//     l'utente non clicca un chip manualmente. Da quel momento
//     in poi (touched=true), l'auto-suggest viene disabilitato
//     — la scelta esplicita dell'utente vince.
//   - In edit mode (initialValues passato dal server): partiamo
//     con la categoria salvata e touched=true (l'utente l'ha già
//     scelta esplicitamente in passato).
//
// Perché NON ChipPicker:
//   ChipPicker (commit 3) gestisce il suo state internamente e
//   non espone un onChange — perfetto per /gym dove ci interessa
//   solo il submit. Qui ci serve sapere QUANDO l'utente clicca
//   per disabilitare l'auto-suggest, quindi i chip vivono
//   inline col loro click handler. Stesso look & feel (stesse
//   classi Tailwind), comportamento diverso.

type Props = {
  /** YYYY-MM-DD — today's date in the user's timezone (server). */
  today: string;
  /** Server action: addExpense (add mode) o updateExpense (edit mode). */
  action: (formData: FormData) => void | Promise<void>;
  /** Add mode: undefined. Edit mode: tutti i campi pre-fill. */
  initialValues?: {
    id: string;
    expense_date: string;
    amount: number;
    category: Category;
    note: string | null;
  };
  /** Label del submit button. */
  submitLabel: string;
};

export function ExpenseForm({
  today,
  action,
  initialValues,
  submitLabel,
}: Props) {
  const isEdit = initialValues !== undefined;

  const [note, setNote] = useState<string>(initialValues?.note ?? "");
  const [categoryTouched, setCategoryTouched] = useState<boolean>(isEdit);
  const [manualCategory, setManualCategory] = useState<Category | null>(
    initialValues?.category ?? null,
  );

  // Categoria visivamente selezionata:
  //   - touched (utente ha cliccato o edit-mode) → manualCategory
  //   - not touched → suggestCategory(note) [null se nota vuota]
  const suggested = !categoryTouched ? suggestCategory(note) : null;
  const visualSelected: Category | null = categoryTouched
    ? manualCategory
    : suggested;

  function pickCategory(cat: Category) {
    setManualCategory(cat);
    setCategoryTouched(true);
  }

  return (
    <form action={action} className="space-y-4">
      {isEdit ? (
        <input type="hidden" name="id" value={initialValues.id} />
      ) : null}

      <div>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
            Importo €
          </span>
          <input
            type="number"
            name="amount"
            required
            min={0.01}
            max={99999999.99}
            step="0.01"
            inputMode="decimal"
            defaultValue={initialValues?.amount ?? ""}
            placeholder="12.50"
            className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
          />
        </label>
      </div>

      <div>
        <label className="block">
          <span className="mb-2 block text-xs uppercase tracking-wider text-text-muted">
            Nota
          </span>
          <input
            type="text"
            name="note"
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="es. Esselunga, Frecciarossa Roma, Netflix"
            className="block min-h-[44px] w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent-info focus:ring-offset-2 focus:ring-offset-bg"
          />
        </label>
      </div>

      <div>
        <p
          id="expense-category-label"
          className="mb-2 text-xs uppercase tracking-wider text-text-muted"
        >
          Categoria
          {/* Live region for the auto-suggest hint. Rendered even
              when empty so AT registers the region on mount; the
              "polite" announcement fires when `suggested` flips
              as the user types. Closes ECC end-of-sprint U2 a11y
              M2. */}
          <span
            aria-live="polite"
            aria-atomic="true"
            className="ml-2 inline normal-case tracking-normal text-[10px] text-text-muted"
          >
            {!categoryTouched && suggested ? (
              <>
                · suggerita:{" "}
                <span className="text-accent-energy">{suggested}</span>
              </>
            ) : null}
          </span>
        </p>
        <div
          role="group"
          aria-labelledby="expense-category-label"
          className="flex flex-wrap gap-2"
        >
          {CATEGORIES.map((cat) => {
            // aria-pressed lega lo stato del button alla SCELTA
            // UTENTE soltanto (manualCategory). La categoria
            // "suggerita" dall'auto-classify NON setta
            // aria-pressed — altrimenti lo screen reader
            // annuncerebbe "spotify, pressed" quando l'utente
            // ha solo digitato la nota, non cliccato il chip.
            // Closes ECC end-of-sprint U2 a11y M1.
            const isManualSelected = categoryTouched && manualCategory === cat;
            const isSuggested =
              !categoryTouched && suggested === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isManualSelected}
                onClick={() => pickCategory(cat)}
                className={`inline-flex min-h-[44px] items-center rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg ${
                  isManualSelected
                    ? "border-accent-energy bg-accent-energy/10 text-accent-energy"
                    : isSuggested
                      ? "border-dashed border-accent-energy/60 bg-accent-energy/5 text-accent-energy"
                      : "border-border bg-surface text-text-secondary hover:border-text-muted hover:text-text-primary"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
        {/* Hidden input emesso al submit. AddExpenseSchema
            rifiuta categoria mancante / non in CATEGORIES enum. */}
        {visualSelected ? (
          <input type="hidden" name="category" value={visualSelected} />
        ) : null}
      </div>

      <div role="group" aria-labelledby="expense-date-label">
        <p
          id="expense-date-label"
          className="mb-2 text-xs uppercase tracking-wider text-text-muted"
        >
          Data
        </p>
        <DateToggle
          name="expense_date"
          defaultDate={today}
          defaultValue={initialValues?.expense_date}
        />
      </div>

      <button
        type="submit"
        className="inline-flex min-h-[44px] w-full items-center justify-center rounded-md bg-accent-energy px-4 text-sm font-semibold text-bg transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-info focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {submitLabel}
      </button>
    </form>
  );
}
