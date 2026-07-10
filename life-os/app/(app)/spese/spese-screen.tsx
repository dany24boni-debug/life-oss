"use client";

/**
 * Lo schermo di /spese (run-05 prompt 4): vista mese (totale + barre per
 * categoria, fatte a mano), aggiunta rapida (importo, chip categoria
 * seminati dalle dieci legacy + campo libero, DatePicker default oggi,
 * nota), lista del mese con scheda modifica/elimina+undo, link quieto
 * all'archivio legacy /finance. Niente parsing NL: qui non serve.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  DatePicker,
  EmptyState,
  Field,
  Input,
  Skeleton,
  StatCard,
  cx,
  useToast,
} from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos, useSpeseMonth } from "@/data/hooks";
import type { Expense } from "@/data/schemas";
import { CATEGORIES } from "@/lib/finance/auto-classify";
import { useToday } from "../_components/tasks/screen-hooks";
import { ExpenseDetailSheet } from "./expense-detail";
import { SpeseImportButton } from "./import-button";
import {
  formatCents,
  formatEuro,
  formatMonthIt,
  monthBreakdown,
  monthOf,
  parseEuroAmount,
  shiftMonth,
} from "./logic";

export function SpeseScreen({ authed }: { authed: boolean }) {
  const today = useToday();
  const [month, setMonth] = useState(() => monthOf(today));
  const expenses = useSpeseMonth(month);
  const [detailId, setDetailId] = useState<string | null>(null);

  const breakdown = useMemo(
    () => monthBreakdown(expenses ?? []),
    [expenses],
  );
  const loading = expenses === undefined;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Vista mese ── */}
      <section aria-label="Mese" className="em-card p-5">
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mese precedente"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </Button>
          <p className="em-body font-medium capitalize text-[var(--em-text)]">
            {formatMonthIt(month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Mese successivo"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <StatCard
            label="Totale mese"
            value={loading ? undefined : formatCents(breakdown.totalCents)}
            loading={loading}
          />
          <StatCard
            label="Movimenti"
            value={loading ? undefined : breakdown.count}
            loading={loading}
          />
        </div>

        {!loading && breakdown.slices.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2" aria-label="Per categoria">
            {breakdown.slices.map((s) => (
              <li key={s.category}>
                <div className="flex items-baseline justify-between">
                  <span className="em-body-sm text-[var(--em-text-2)]">
                    {s.category}
                  </span>
                  <span className="em-body-sm tabular-nums text-[var(--em-text-3)]">
                    {formatCents(s.cents)} · {s.pct}%
                  </span>
                </div>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-[var(--em-r-full)] bg-[var(--em-surface-2)]"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-[var(--em-r-full)] bg-[var(--em-ember)] transition-[width] duration-[var(--em-dur-card)]"
                    style={{ width: `${Math.max(2, s.pct)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <QuickAdd today={today} onAdded={(day) => setMonth(monthOf(day))} />

      {/* ── Lista del mese ── */}
      <section aria-label="Spese del mese" className="em-card p-5">
        <p className="em-eyebrow">Spese di {formatMonthIt(month)}</p>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="mt-1">
            <EmptyState
              compact
              heading="Nessuna spesa questo mese"
              text="Aggiungi la prima qui sopra: bastano importo e categoria."
            />
            {authed ? (
              <div className="mt-2 border-t border-[var(--em-hairline)] pt-4">
                <p className="em-body-sm text-[var(--em-text-3)]">
                  Le spese registrate nella vecchia pagina non si perdono:
                  importale quando vuoi.
                </p>
                <div className="mt-3">
                  <SpeseImportButton compact />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <ul className="mt-2 flex flex-col">
            {expenses.map((e) => (
              <ExpenseRow key={e.id} expense={e} onOpen={() => setDetailId(e.id)} />
            ))}
          </ul>
        )}
      </section>

      <p className="em-body-sm text-[var(--em-text-3)]">
        <Link
          href="/finance"
          className="underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
        >
          Archivio movimenti (vecchia pagina)
        </Link>
      </p>

      <ExpenseDetailSheet
        expenseId={detailId}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}

/* ── Aggiunta rapida ─────────────────────────────────────────────────── */

/** Le dieci categorie legacy come chip; "altro…" apre il campo libero. */
const CHIP_CATEGORIES: readonly string[] = CATEGORIES;

function QuickAdd({
  today,
  onAdded,
}: {
  today: DayString;
  onAdded: (day: DayString) => void;
}) {
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>("cibo");
  const [freeCategory, setFreeCategory] = useState("");
  const [freeMode, setFreeMode] = useState(false);
  const [date, setDate] = useState<DayString | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const parsedAmount = parseEuroAmount(amount);
  const effectiveCategory = freeMode ? freeCategory.trim() : category;
  const canSubmit = parsedAmount !== null && effectiveCategory !== "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount === null || effectiveCategory === "") return;
    setBusy(true);
    try {
      const day = date ?? today;
      const r = await appRepos().spese.create({
        amount: parsedAmount,
        category: effectiveCategory.toLowerCase(),
        date: day,
        note: note.trim() === "" ? null : note.trim(),
      });
      if (!r.ok) {
        toast.show({ message: r.error.message, tone: "error" });
        return;
      }
      setAmount("");
      setNote("");
      setDate(null);
      onAdded(day);
      toast.show({
        message: `Spesa di ${formatEuro(parsedAmount)} aggiunta.`,
        durationMs: 3000,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="em-card p-5">
      <p className="em-eyebrow">Nuova spesa</p>
      <div className="mt-3 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importo" required hint="es. 12,50">
            {(p) => (
              <Input
                {...p}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            )}
          </Field>
          <Field label="Giorno" hint="Vuoto = oggi">
            {(p) => (
              <DatePicker
                id={p.id}
                value={date}
                onChange={setDate}
                placeholder="Oggi"
              />
            )}
          </Field>
        </div>

        <div>
          <p className="em-eyebrow">Categoria</p>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Categoria">
            {CHIP_CATEGORIES.map((c) => {
              const active = !freeMode && category === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setFreeMode(false);
                    setCategory(c);
                  }}
                  className={cx(
                    "min-h-9 rounded-[var(--em-r-full)] px-3 text-[length:var(--em-fs-body-sm)] transition-colors duration-[var(--em-dur-control)]",
                    active
                      ? "bg-[var(--em-ember-tint)] font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-ember)]"
                      : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
                  )}
                >
                  {c}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={freeMode}
              onClick={() => setFreeMode(true)}
              className={cx(
                "min-h-9 rounded-[var(--em-r-full)] px-3 text-[length:var(--em-fs-body-sm)] transition-colors duration-[var(--em-dur-control)]",
                freeMode
                  ? "bg-[var(--em-ember-tint)] font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-ember)]"
                  : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
              )}
            >
              altra…
            </button>
          </div>
          {freeMode ? (
            <div className="mt-2">
              <Input
                value={freeCategory}
                onChange={(e) => setFreeCategory(e.target.value)}
                maxLength={40}
                placeholder="categoria libera (es. viaggi)"
                aria-label="Categoria libera"
              />
            </div>
          ) : null}
        </div>

        <Field label="Nota" hint="Opzionale">
          {(p) => (
            <Input
              {...p}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="es. pizza con Anna"
            />
          )}
        </Field>

        <Button type="submit" loading={busy} disabled={!canSubmit}>
          Aggiungi spesa
        </Button>
      </div>
    </form>
  );
}

/* ── Riga spesa ──────────────────────────────────────────────────────── */

function formatDayIt(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function ExpenseRow({
  expense,
  onOpen,
}: {
  expense: Expense;
  onOpen: () => void;
}) {
  return (
    <li className="border-b border-[var(--em-hairline)] last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left transition-colors duration-[var(--em-dur-control)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
      >
        <span className="min-w-0">
          <span className="em-body block truncate text-[var(--em-text)]">
            {expense.category}
            {expense.note ? (
              <span className="text-[var(--em-text-3)]"> · {expense.note}</span>
            ) : null}
          </span>
          <span className="em-body-sm block text-[var(--em-text-3)]">
            {formatDayIt(expense.date)}
          </span>
        </span>
        <span className="em-body shrink-0 tabular-nums font-medium text-[var(--em-text)]">
          {formatEuro(expense.amount)}
        </span>
      </button>
    </li>
  );
}
