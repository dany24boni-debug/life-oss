"use client";

/**
 * Lo schermo di /corpo — tre superfici quiete:
 *   1. Peso di oggi: stepper ±0,1 prefillato dall'ultima pesata,
 *      salvataggio esplicito (una pesata è un dato, non un gesto).
 *   2. Trend: finestre 7/30/90 giorni, polyline + banda min-max reale.
 *   3. Storico: le ultime pesate, scheda di modifica con nota e
 *      eliminazione con undo.
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  ChartFrame,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  cx,
  useToast,
} from "@/ui";
import {
  appRepos,
  useBodyDay,
  useBodyRange,
  useBodyRecent,
  useLatestBody,
} from "@/data/hooks";
import type { BodyEntry } from "@/data/schemas";
import { addDays, formatDayShort } from "@/ui/calendar-core";
import { useIsDesktop, useToday } from "../_components/tasks/screen-hooks";
import {
  buildWeightChart,
  formatBodyDelta,
  formatBodyKg,
  stepBodyWeight,
} from "./logic";

export function CorpoScreen() {
  const today = useToday();
  const [detail, setDetail] = useState<BodyEntry | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <TodayEntryCard today={today} />
      <TrendCard today={today} />
      <HistoryCard today={today} onOpen={setDetail} />
      <EntrySheet entry={detail} onClose={() => setDetail(null)} />
    </div>
  );
}

/* ── Peso di oggi ────────────────────────────────────────────────────── */

function TodayEntryCard({ today }: { today: string }) {
  const toast = useToast();
  const entry = useBodyDay(today);
  const latest = useLatestBody();

  if (entry === undefined || latest === undefined) {
    return (
      <section aria-label="Peso di oggi" className="em-card p-5">
        <p className="em-eyebrow">Peso di oggi</p>
        <div className="mt-3" aria-busy="true">
          <Skeleton className="h-11 w-2/3" />
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Peso di oggi" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Peso di oggi</p>
        {entry ? (
          <span className="em-eyebrow rounded-full bg-[var(--em-salvia-tint,var(--em-surface-2))] px-2 py-0.5 text-[var(--em-text-3)]">
            registrato
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <WeightQuickEntry
          date={today}
          current={entry}
          fallbackKg={latest?.weight_kg ?? 80}
          onSaved={(saved) =>
            toast.show({
              message: `Peso di oggi: ${formatBodyKg(saved.weight_kg)}.`,
              tone: "success",
            })
          }
        />
      </div>
      {latest && latest.date !== today ? (
        <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
          Ultima pesata: {formatBodyKg(latest.weight_kg)} ·{" "}
          {formatDayShort(latest.date)}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Stepper ±0,1 + salvataggio esplicito. Riusato dalla schermata di fine
 * allenamento (prompt 4, "Peso di oggi" del foglio).
 */
export function WeightQuickEntry({
  date,
  current,
  fallbackKg,
  onSaved,
  compact = false,
}: {
  date: string;
  current: BodyEntry | null;
  /** Prefill quando il giorno è ancora vuoto (ultima pesata, o 80). */
  fallbackKg: number;
  onSaved?: (entry: BodyEntry) => void;
  compact?: boolean;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? current?.weight_kg ?? fallbackKg;
  const dirty = draft !== null && draft !== (current?.weight_kg ?? null);

  async function save() {
    const r = await appRepos().body.upsertDay(date, { weight_kg: value });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    setDraft(null);
    onSaved?.(r.data);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <StepBtn
          ariaLabel="Meno 0,1 kg"
          onClick={() => setDraft(stepBodyWeight(value, -1))}
        >
          −
        </StepBtn>
        <span
          className={cx(
            "em-num text-center font-semibold text-[var(--em-text)]",
            compact ? "em-body w-24" : "em-title w-28",
          )}
        >
          {formatBodyKg(value)}
        </span>
        <StepBtn
          ariaLabel="Più 0,1 kg"
          onClick={() => setDraft(stepBodyWeight(value, 1))}
        >
          +
        </StepBtn>
      </div>
      <Button
        type="button"
        variant={current && !dirty ? "ghost" : "primary"}
        size={compact ? "sm" : "md"}
        onClick={() => void save()}
        disabled={current !== null && !dirty}
      >
        {current ? (dirty ? "Aggiorna" : "Salvato") : "Salva"}
      </Button>
    </div>
  );
}

function StepBtn({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}

/* ── Trend ───────────────────────────────────────────────────────────── */

const WINDOWS = [7, 30, 90] as const;

function TrendCard({ today }: { today: string }) {
  const [windowDays, setWindowDays] = useState<(typeof WINDOWS)[number]>(30);
  const from = addDays(today, -(windowDays - 1));
  const entries = useBodyRange(from, today);
  const chart = buildWeightChart(entries ?? [], 280, 64);

  return (
    <section aria-label="Trend del peso" className="em-card p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Trend</p>
        <div className="flex gap-1" role="group" aria-label="Finestra del trend">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={windowDays === w}
              onClick={() => setWindowDays(w)}
              className={cx(
                "em-hit em-body-sm em-num h-8 rounded-full px-2.5 font-medium transition-colors duration-[var(--em-dur-tap)]",
                windowDays === w
                  ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                  : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
              )}
            >
              {w}g
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3">
        <ChartFrame
          label="Peso"
          title={`Ultimi ${windowDays} giorni`}
          state={
            entries === undefined
              ? "loading"
              : chart !== null
                ? "ready"
                : "empty"
          }
          emptyText="Nessuna pesata in questa finestra: il trend parte dalla prima."
          minHeight={88}
          caption={
            chart
              ? `Banda: min ${formatBodyKg(chart.minKg)} · max ${formatBodyKg(chart.maxKg)}`
              : undefined
          }
        >
          {chart ? (
            <svg
              viewBox="0 0 280 64"
              className="h-16 w-full"
              role="img"
              aria-label={`Peso da ${formatBodyKg(chart.first.weight_kg)} (${formatDayShort(chart.first.date)}) a ${formatBodyKg(chart.last.weight_kg)} (${formatDayShort(chart.last.date)})`}
            >
              <rect
                x="0"
                y={chart.bandTopY}
                width="280"
                height={Math.max(1, chart.bandBottomY - chart.bandTopY)}
                fill="var(--em-ember)"
                opacity="0.08"
              />
              <polyline
                points={chart.path}
                fill="none"
                stroke="var(--em-ember)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : null}
        </ChartFrame>
      </div>
    </section>
  );
}

/* ── Storico ─────────────────────────────────────────────────────────── */

function HistoryCard({
  today,
  onOpen,
}: {
  today: string;
  onOpen: (entry: BodyEntry) => void;
}) {
  const [limit, setLimit] = useState(14);
  const entries = useBodyRecent(today, limit);

  return (
    <section aria-label="Storico pesate" className="em-card p-5">
      <p className="em-eyebrow">Storico</p>
      <div className="mt-2">
        {entries === undefined ? (
          <div aria-busy="true">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            compact
            heading="Ancora nessuna pesata"
            text="La prima pesata inaugura il trend — anche dalla schermata di fine allenamento."
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {entries.map((entry, i) => {
                const previous = entries[i + 1];
                const delta =
                  previous !== undefined
                    ? Math.round((entry.weight_kg - previous.weight_kg) * 10) /
                      10
                    : null;
                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(entry)}
                      className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
                    >
                      <span className="em-body em-num w-20 shrink-0 font-medium text-[var(--em-text)]">
                        {formatDayShort(entry.date)}
                      </span>
                      <span className="em-body em-num shrink-0 text-[var(--em-text)]">
                        {formatBodyKg(entry.weight_kg)}
                      </span>
                      {delta !== null ? (
                        <span
                          className={cx(
                            "em-body-sm em-num shrink-0",
                            delta < 0
                              ? "text-[var(--em-salvia-text)]"
                              : "text-[var(--em-text-3)]",
                          )}
                        >
                          {formatBodyDelta(delta)}
                        </span>
                      ) : null}
                      <span className="em-body-sm min-w-0 flex-1 truncate text-right text-[var(--em-text-3)]">
                        {entry.note ?? ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {entries.length === limit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setLimit((l) => l + 14)}
              >
                Mostra altre pesate
              </Button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/* ── Scheda pesata (modifica + elimina con undo) ─────────────────────── */

function EntrySheet({
  entry,
  onClose,
}: {
  entry: BodyEntry | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const open = entry !== null;
  const body = entry ? (
    <EntrySheetBody key={entry.id} entry={entry} onClose={onClose} />
  ) : null;
  const title = entry ? `Pesata · ${formatDayShort(entry.date)}` : "Pesata";

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body ?? <span />}
    </BottomSheet>
  );
}

function EntrySheetBody({
  entry,
  onClose,
}: {
  entry: BodyEntry;
  onClose: () => void;
}) {
  const toast = useToast();
  const [weight, setWeight] = useState(entry.weight_kg);

  async function patch(input: { weight_kg?: number; note?: string | null }) {
    const r = await appRepos().body.upsertDay(entry.date, input);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function remove() {
    const r = await appRepos().body.softDeleteDay(entry.date);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `Pesata del ${formatDayShort(entry.date)} eliminata.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().body.restoreDay(entry.date),
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <span className="em-eyebrow">Peso</span>
        <div className="flex items-center gap-1">
          <StepBtn
            ariaLabel="Meno 0,1 kg"
            onClick={() => {
              const next = stepBodyWeight(weight, -1);
              setWeight(next);
              void patch({ weight_kg: next });
            }}
          >
            −
          </StepBtn>
          <span className="em-body em-num w-24 text-center font-semibold text-[var(--em-text)]">
            {formatBodyKg(weight)}
          </span>
          <StepBtn
            ariaLabel="Più 0,1 kg"
            onClick={() => {
              const next = stepBodyWeight(weight, 1);
              setWeight(next);
              void patch({ weight_kg: next });
            }}
          >
            +
          </StepBtn>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nota</span>
        <Input
          defaultValue={entry.note ?? ""}
          placeholder="A digiuno, dopo cena…"
          maxLength={500}
          onBlur={(e) => {
            const v = e.target.value.trim();
            void patch({ note: v === "" ? null : v });
          }}
        />
      </label>

      <div className="flex justify-end">
        <Button type="button" variant="ghost" onClick={() => void remove()}>
          Elimina pesata
        </Button>
      </div>
    </div>
  );
}
