"use client";

/**
 * Gestione dei giorni protetti (B2.5): riposo e vacanze SEGNATI IN
 * ANTICIPO — il DatePicker parte da oggi, proteggere il passato a
 * posteriori snaturerebbe la regola (iron rule 2 dell'audit). Scelta di
 * data via Ember DatePicker, lista con rimozione, salvataggio immediato
 * via SettingsRepo con errore a toast.
 */

import { useState } from "react";
import { DatePicker, EmptyState, Skeleton, useToast } from "@/ui";
import { formatDayShort, type DayString } from "@/ui/calendar-core";
import { appRepos, useSettings } from "@/data/hooks";
import { useToday } from "../_components/tasks/screen-hooks";

// Il ToastProvider vive nel layout del gruppo (run-03 prompt 5).
export function ProtectedDays() {
  return <ProtectedDaysInner />;
}

function ProtectedDaysInner() {
  const toast = useToast();
  const today = useToday();
  const settings = useSettings();
  // Il DatePicker si svuota dopo ogni aggiunta: key incrementale.
  const [pickerKey, setPickerKey] = useState(0);

  async function save(days: DayString[]) {
    const r = await appRepos().settings.update({ protected_days: days });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  function add(day: DayString | null) {
    if (!day || settings === undefined) return;
    setPickerKey((k) => k + 1);
    if (settings.protected_days.includes(day)) return;
    void save([...settings.protected_days, day]);
  }

  function remove(day: DayString) {
    if (settings === undefined) return;
    void save(settings.protected_days.filter((d) => d !== day));
  }

  const days = settings?.protected_days ?? [];
  // I passati restano visibili (hanno fatto da ponte) ma in coda.
  const upcoming = days.filter((d) => d >= today);
  const past = days.filter((d) => d < today);

  return (
    <section aria-label="Giorni protetti" className="em-card p-5">
      <p className="em-eyebrow">Giorni protetti</p>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Riposo e vacanze segnati in anticipo: nei giorni protetti la streak
        non si spezza. Non contano come attivi — fanno da ponte.
      </p>

      <div className="mt-4 max-w-64">
        <DatePicker
          key={pickerKey}
          min={today}
          placeholder="Proteggi un giorno"
          clearable={false}
          onChange={add}
        />
      </div>

      {/* Skeleton invece del pop-in (run-10 P4, PROP-imp-01). */}
      {settings === undefined ? (
        <div className="mt-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : upcoming.length === 0 &&
        past.length === 0 ? (
        <EmptyState
          compact
          heading="Nessun giorno protetto"
          text="Aggiungi il prossimo giorno di riposo qui sopra."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-1">
          {[...upcoming, ...past].map((day) => {
            const isPast = day < today;
            return (
              <li
                key={day}
                className="flex min-h-[var(--em-tap-min)] items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-1 last:border-b-0"
              >
                <span
                  className={
                    isPast
                      ? "em-body-sm em-num text-[var(--em-text-3)]"
                      : "em-body em-num text-[var(--em-text)]"
                  }
                >
                  {formatDayShort(day)}
                  {day === today ? " · oggi" : isPast ? " · passato" : ""}
                </span>
                <button
                  type="button"
                  onClick={() => remove(day)}
                  aria-label={`Rimuovi protezione: ${formatDayShort(day)}`}
                  className="em-body-sm rounded-[var(--em-r-sm)] px-2.5 py-1.5 text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_8%,transparent)] hover:text-[var(--em-text)]"
                >
                  Rimuovi
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
