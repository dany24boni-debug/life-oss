"use client";

/**
 * La tabella Progressi per esercizio (run-07 prompt 3) — il foglio
 * "Progressi", rinato: colonne = ultime sedute (datate, più recenti
 * prima), scroll orizzontale; righe di testata volume · e1RM (Brzycki,
 * set migliore) · Δ vs precedente (salvia su / segnale giù / neutro);
 * poi le righe set 1..n con "peso × reps" (RIR piccolo se registrato) e
 * il punto ember sui PR di carico. La riga "Forza Rel." arriva col
 * prompt 4 (serve il peso corporeo).
 */

import { cx } from "@/ui";
import { relativeStrength } from "@/data/derived";
import type { GymSet } from "@/data/schemas";
import { formatDayShort } from "@/ui/calendar-core";
import { formatKg } from "./logic";
import {
  buildProgressTable,
  doneCellLabel,
  formatKgShort,
} from "./progression";

const REL = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // Sempre < 10 nel dominio (e1RM/peso), ma l'invariante useGrouping
  // resta greppabile su ogni NumberFormat it-IT (sweep run-09).
  useGrouping: "always",
});

export function ProgressTable({
  sets,
  dateBySession,
  weightByDate,
}: {
  /** Tutti i set dell'esercizio (qualsiasi ordine). */
  sets: readonly GymSet[];
  /** session_id → giorno civile (le sedute fuori mappa restano fuori). */
  dateBySession: ReadonlyMap<string, string>;
  /**
   * Giorno → peso corporeo (run-07 P4): accende la riga "Forza Rel."
   * (e1RM / peso del giorno della seduta; trattino dove manca).
   */
  weightByDate?: ReadonlyMap<string, number>;
}) {
  const table = buildProgressTable(sets, dateBySession);
  if (table.columns.length === 0) {
    return (
      <p className="em-body-sm text-[var(--em-text-3)]">
        Ancora nessuna seduta con questo esercizio: la tabella parte dalla
        prima.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto pb-1" role="region" aria-label="Progressi per seduta" tabIndex={0}>
      <table className="w-max border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="em-eyebrow sticky left-0 bg-[var(--em-surface)] py-1.5 pr-3 text-left font-medium text-[var(--em-text-3)]">
              Seduta
            </th>
            {table.columns.map((col) => (
              <th
                key={col.sessionId}
                scope="col"
                className="em-body-sm whitespace-nowrap px-3 py-1.5 text-left font-semibold text-[var(--em-text)]"
              >
                {formatDayShort(col.date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <MetaRow
            label="Volume"
            cells={table.columns.map((c) =>
              c.volumeKg > 0 ? formatKg(c.volumeKg) : "—",
            )}
          />
          <MetaRow
            label="e1RM"
            cells={table.columns.map((c) =>
              c.e1rmKg !== null ? formatKg(Math.round(c.e1rmKg * 10) / 10) : "—",
            )}
          />
          <tr>
            <RowLabel label="Δ" />
            {table.columns.map((col) => (
              <td key={col.sessionId} className="whitespace-nowrap px-3 py-1">
                <DeltaBadge deltaKg={col.deltaE1rmKg} />
              </td>
            ))}
          </tr>
          {weightByDate !== undefined ? (
            <MetaRow
              label="Forza Rel."
              cells={table.columns.map((c) => {
                const rel = relativeStrength(
                  c.e1rmKg,
                  weightByDate.get(c.date) ?? null,
                );
                return rel !== null ? `×${REL.format(rel)}` : "—";
              })}
            />
          ) : null}
          {Array.from({ length: table.maxSets }, (_, i) => (
            <tr key={`set:${i}`}>
              <RowLabel label={`Set ${i + 1}`} />
              {table.columns.map((col) => {
                const set = col.sets[i];
                return (
                  <td
                    key={col.sessionId}
                    className="em-body-sm em-num whitespace-nowrap px-3 py-1 text-[var(--em-text)]"
                  >
                    {set === undefined ? (
                      <span className="text-[var(--em-text-3)]">·</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        {doneCellLabel(set)}
                        {set.rir_done !== null ? (
                          <span className="em-eyebrow text-[var(--em-text-3)]">
                            R{set.rir_done}
                          </span>
                        ) : null}
                        {col.prFlags[i] ? (
                          <span
                            aria-label="Record di carico"
                            title="Record di carico"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--em-ember)]"
                          />
                        ) : null}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RowLabel({ label }: { label: string }) {
  return (
    <th
      scope="row"
      className="em-eyebrow sticky left-0 bg-[var(--em-surface)] py-1 pr-3 text-left font-medium text-[var(--em-text-3)]"
    >
      {label}
    </th>
  );
}

function MetaRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <RowLabel label={label} />
      {cells.map((value, i) => (
        <td
          key={i}
          className="em-body-sm em-num whitespace-nowrap px-3 py-1 text-[var(--em-text-2)]"
        >
          {value}
        </td>
      ))}
    </tr>
  );
}

function DeltaBadge({ deltaKg }: { deltaKg: number | null }) {
  if (deltaKg === null) {
    return <span className="em-body-sm text-[var(--em-text-3)]">—</span>;
  }
  const up = deltaKg > 0;
  const flat = deltaKg === 0;
  return (
    <span
      className={cx(
        "em-body-sm em-num inline-flex items-center gap-0.5 font-medium",
        flat
          ? "text-[var(--em-text-3)]"
          : up
            ? "text-[var(--em-salvia)]"
            : "text-[var(--em-segnale)]",
      )}
    >
      {flat ? "=" : up ? "▲" : "▼"}
      {flat ? "" : ` ${up ? "+" : "−"}${formatKgShort(Math.abs(deltaKg))}`}
    </span>
  );
}
