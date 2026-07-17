"use client";

/**
 * Lo schermo di /sera (run-05 prompt 5): il check-in di OGGI come
 * superficie primaria — energia (radiogroup orizzontale 1..5), umore,
 * note e diario con salvataggio continuo sul port locale (debounce +
 * blur) — poi il blocco export Drive (per stato reale: pronto / scope
 * mancante / non connesso / ospite) e uno storico corto paginato che
 * carica ESATTAMENTE ciò che rende. Nessuna sezione promessa-e-assente.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  BottomSheet,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  Skeleton,
  Textarea,
  cx,
  useToast,
} from "@/ui";
import {
  appRepos,
  useCheckin,
  useCheckinHistory,
} from "@/data/hooks";
import type { CheckinPatch, EveningCheckin } from "@/data/schemas";
import { useIsDesktop, useToday } from "../_components/tasks/screen-hooks";
import { saveDiaryEntry } from "./actions";
import { SeraImportButton } from "./import-button";
import { SeraRecap } from "./sera-recap";

export type DriveState = "guest" | "none" | "scope_missing" | "ready";

const HISTORY_PAGE = 7;

export function SeraScreen({
  authed,
  drive,
}: {
  authed: boolean;
  drive: DriveState;
}) {
  const today = useToday();
  const checkin = useCheckin(today);
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);
  const history = useCheckinHistory(today, historyLimit);
  const [openDay, setOpenDay] = useState<EveningCheckin | null>(null);

  const nothingYet =
    checkin === null && history !== undefined && history.length === 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Il recap della giornata (run-11 P4): i fatti prima del come è
          andata — e "Prepara domani" per il rituale di domattina. */}
      <SeraRecap today={today} />

      {checkin === undefined ? (
        <div className="em-card p-5" aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <TodayCheckin today={today} checkin={checkin} drive={drive} />
      )}

      {/* Prompt inline dell'import (authed, modulo completamente vuoto). */}
      {authed && nothingYet ? (
        <section
          aria-label="Importa i vecchi check-in"
          className="rounded-[var(--em-r-lg)] border border-dashed border-[var(--em-hairline-strong)] p-5"
        >
          <p className="em-body-sm text-[var(--em-text-3)]">
            I check-in della vecchia Sera non si perdono: importali quando
            vuoi. (I diari già esportati restano su Drive.)
          </p>
          <div className="mt-3">
            <SeraImportButton compact />
          </div>
        </section>
      ) : null}

      <section aria-label="Sere passate" className="em-card p-5">
        <p className="em-eyebrow">Sere passate</p>
        {history === undefined ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : history.length === 0 ? (
          <EmptyState
            compact
            heading="Ancora nessuna sera qui"
            text="Il check-in di stasera sarà il primo della lista."
          />
        ) : (
          <>
            <ul className="mt-2 flex flex-col">
              {history.map((row) => (
                <HistoryRow
                  key={row.id}
                  row={row}
                  onOpen={() => setOpenDay(row)}
                />
              ))}
            </ul>
            {history.length === historyLimit ? (
              <div className="mt-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}
                >
                  Mostra altre sere
                </Button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <HistorySheet row={openDay} onClose={() => setOpenDay(null)} />
    </div>
  );
}

/* ── Check-in di oggi ────────────────────────────────────────────────── */

const SAVE_DEBOUNCE_MS = 800;

function TodayCheckin({
  today,
  checkin,
  drive,
}: {
  today: string;
  checkin: EveningCheckin | null;
  drive: DriveState;
}) {
  const toast = useToast();
  const [mood, setMood] = useState(checkin?.mood ?? "");
  const [notes, setNotes] = useState(checkin?.notes ?? "");
  const [journal, setJournal] = useState(checkin?.journal ?? "");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // La riga live può cambiare da sync/import: si segue SOLO quando i campi
  // locali non hanno modifiche in volo (l'utente vince sempre).
  const dirtyRef = useRef(false);
  const rowKey = `${checkin?.id ?? "-"}:${checkin?.updated_at ?? "-"}`;
  const lastRowKey = useRef(rowKey);
  useEffect(() => {
    if (lastRowKey.current !== rowKey && !dirtyRef.current) {
      lastRowKey.current = rowKey;
      setMood(checkin?.mood ?? "");
      setNotes(checkin?.notes ?? "");
      setJournal(checkin?.journal ?? "");
    }
    lastRowKey.current = rowKey;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowKey]);

  async function save(patch: CheckinPatch) {
    const r = await appRepos().sera.upsertDay(today, patch);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    dirtyRef.current = false;
    setSavedAt(new Date().toISOString());
  }

  function scheduleJournalSave(value: string) {
    dirtyRef.current = true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void save({ journal: value.trim() === "" ? null : value });
    }, SAVE_DEBOUNCE_MS);
  }

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  async function exportToDrive() {
    const fd = new FormData();
    fd.set("date", today);
    fd.set("content", journal);
    if (mood.trim() !== "") fd.set("mood", mood.trim());
    const res = await saveDiaryEntry(fd);
    if (res.ok) {
      toast.show({ message: "Diario salvato su Drive.", tone: "success" });
    } else {
      const labels: Record<string, string> = {
        account_missing: "Nessun account Google collegato. Collegalo dal Calendario.",
        scope_missing: "Serve il permesso Drive: autorizzalo qui sotto.",
        drive_api_error: "Drive non ha risposto. Riprova tra poco.",
        content_too_large: "Il diario supera il limite di 100.000 caratteri.",
        bad_input: "Non ho potuto salvare: contenuto vuoto o data non valida.",
      };
      toast.show({
        message: labels[res.error] ?? "Non ho potuto salvare su Drive. Riprova.",
        tone: "error",
      });
    }
  }

  return (
    <section aria-label="Check-in di stasera" className="em-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="em-eyebrow">Stasera</p>
        <p
          className="em-body-sm text-[var(--em-text-3)]"
          role="status"
          aria-live="polite"
        >
          {savedAt ? "Salvato" : ""}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <EnergyPicker
          value={checkin?.energy_1_5 ?? null}
          onChange={(n) => void save({ energy_1_5: n })}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Umore" hint="Una parola basta">
            {(p) => (
              <Input
                {...p}
                value={mood}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setMood(e.target.value);
                }}
                onBlur={() =>
                  void save({ mood: mood.trim() === "" ? null : mood.trim() })
                }
                maxLength={80}
                placeholder="es. sereno"
              />
            )}
          </Field>
          <Field label="Note della serata">
            {(p) => (
              <Input
                {...p}
                value={notes}
                onChange={(e) => {
                  dirtyRef.current = true;
                  setNotes(e.target.value);
                }}
                onBlur={() =>
                  void save({
                    notes: notes.trim() === "" ? null : notes.trim(),
                  })
                }
                maxLength={280}
                placeholder="es. cena fuori, poco studio"
              />
            )}
          </Field>
        </div>

        <Field label="Diario" hint="Si salva da solo su questo dispositivo">
          {(p) => (
            <Textarea
              {...p}
              value={journal}
              onChange={(e) => {
                setJournal(e.target.value);
                scheduleJournalSave(e.target.value);
              }}
              onBlur={() => {
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current);
                  debounceRef.current = null;
                }
                void save({
                  journal: journal.trim() === "" ? null : journal,
                });
              }}
              maxLength={100_000}
              rows={8}
              placeholder="Com'è andata oggi?"
            />
          )}
        </Field>

        <DriveBlock
          drive={drive}
          canExport={journal.trim() !== ""}
          onExport={() => void exportToDrive()}
        />
      </div>
    </section>
  );
}

/* ── Energia 1..5 (radiogroup orizzontale, target 44px) ──────────────── */

function EnergyPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="em-eyebrow" id="energy-label">
        Energia
      </p>
      <div
        role="radiogroup"
        aria-labelledby="energy-label"
        className="mt-2 flex gap-2"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          const current = value ?? 0;
          const next =
            e.key === "ArrowRight"
              ? Math.min(5, current + 1)
              : Math.max(1, current - 1);
          if (next !== current) onChange(next);
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Energia ${n} su 5`}
              tabIndex={active || (value === null && n === 1) ? 0 : -1}
              onClick={() => onChange(n)}
              className={cx(
                "flex h-11 w-11 items-center justify-center rounded-[var(--em-r-full)] text-[length:var(--em-fs-body)] tabular-nums transition-all duration-[var(--em-dur-tap)]",
                active
                  ? "bg-[var(--em-ember)] font-semibold text-[var(--em-on-ember)]"
                  : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Blocco Drive (stato onesto) ─────────────────────────────────────── */

function DriveBlock({
  drive,
  canExport,
  onExport,
}: {
  drive: DriveState;
  canExport: boolean;
  onExport: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (drive === "guest") return null; // da ospiti il blocco non esiste

  if (drive === "none") {
    return (
      <p className="em-body-sm border-t border-[var(--em-hairline)] pt-3 text-[var(--em-text-3)]">
        Il diario può finire anche su Google Drive (cartella
        Life-OS/Diario/):{" "}
        <Link
          href="/calendar"
          className="underline decoration-[var(--em-hairline-strong)] underline-offset-4"
        >
          collega Google dal Calendario
        </Link>{" "}
        e torna qui.
      </p>
    );
  }

  if (drive === "scope_missing") {
    return (
      <div className="border-t border-[var(--em-hairline)] pt-3">
        <p className="em-body-sm text-[var(--em-text-3)]">
          Il diario su Drive vuole un permesso in più (drive.file: vediamo
          solo i file creati dall&apos;app, non il resto del tuo Drive).
        </p>
        <a
          href="/api/auth/google/start?upgrade=drive"
          className="em-body-sm mt-2 inline-flex h-[var(--em-control-h-sm)] items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-3 font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline)] transition-shadow duration-[var(--em-dur-control)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
        >
          Autorizza Drive
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-t border-[var(--em-hairline)] pt-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={!canExport}
        onClick={() => {
          setBusy(true);
          Promise.resolve(onExport()).finally(() => setBusy(false));
        }}
      >
        Esporta su Drive
      </Button>
      <p className="em-body-sm text-[var(--em-text-3)]">
        Stessa cartella di sempre: Life-OS/Diario/.
      </p>
    </div>
  );
}

/* ── Storico ─────────────────────────────────────────────────────────── */

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

function HistoryRow({
  row,
  onOpen,
}: {
  row: EveningCheckin;
  onOpen: () => void;
}) {
  const snippet =
    row.journal !== null
      ? row.journal.split("\n")[0].slice(0, 80)
      : (row.notes ?? "");
  return (
    <li className="border-b border-[var(--em-hairline)] last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left transition-colors duration-[var(--em-dur-control)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
      >
        <span className="min-w-0">
          <span className="em-body block text-[var(--em-text)]">
            {formatDayIt(row.date)}
            {row.mood ? (
              <span className="text-[var(--em-text-3)]"> · {row.mood}</span>
            ) : null}
          </span>
          {snippet !== "" ? (
            <span className="em-body-sm block truncate text-[var(--em-text-3)]">
              {snippet}
            </span>
          ) : null}
        </span>
        {row.energy_1_5 !== null ? (
          <span className="em-body-sm shrink-0 tabular-nums text-[var(--em-text-2)]">
            {row.energy_1_5}/5
          </span>
        ) : null}
      </button>
    </li>
  );
}

/** Lettura di una sera passata: sheet read-only (confine V1, come legacy). */
function HistorySheet({
  row,
  onClose,
}: {
  row: EveningCheckin | null;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const open = row !== null;
  const body = row === null ? null : (
    <div className="flex flex-col gap-3 pb-2">
      <p className="em-body-sm text-[var(--em-text-3)]">
        {formatDayIt(row.date)}
        {row.energy_1_5 !== null ? ` · energia ${row.energy_1_5}/5` : ""}
        {row.mood ? ` · ${row.mood}` : ""}
      </p>
      {row.notes ? (
        <p className="em-body text-[var(--em-text-2)]">{row.notes}</p>
      ) : null}
      {row.journal ? (
        <p className="em-body whitespace-pre-wrap text-[var(--em-text)]">
          {row.journal}
        </p>
      ) : (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessun diario per questa sera.
        </p>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Sera">
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Sera">
      {open ? body : <span />}
    </BottomSheet>
  );
}
