"use client";

/**
 * Lo schermo di /calendar (B2.4): mese Ember con puntini di densità
 * (eventi locali + task aperti + Google), quick-add NL, agenda del giorno
 * selezionato con voci source-linked, blocco Google read-only per gli
 * account. Il giorno selezionato parte da ?giorno= (deep-link dalla
 * strip di Oggi) o da oggi.
 *
 * Dati: le query locali coprono una finestra larga [-6 mesi, +12 mesi] —
 * il Calendar naviga i mesi con stato interno e i markers devono avere
 * una risposta per qualsiasi giorno visibile senza rifare query. A scala
 * personale è una manciata di righe; liveQuery le tiene fresche.
 */

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Button, Calendar, EmptyState, Skeleton } from "@/ui";
import {
  addMonths,
  formatDayFull,
  todayLocal,
  type DayString,
} from "@/ui/calendar-core";
import { useEventsRange, useTasks, useUpcomingTasks } from "@/data/hooks";
import { AgendaList } from "../_components/agenda-list";
import { useTaskActions } from "../_components/tasks/actions";
import { useToday } from "../_components/tasks/screen-hooks";
import { TaskDetailSheet } from "../_components/tasks/task-detail";
import { disconnectGoogleAccount, syncGoogleCalendars } from "./actions";
import {
  buildDayAgenda,
  buildDensityMap,
  type GoogleAgendaEvent,
} from "./agenda";
import { EventDetailSheet } from "./event-detail";
import { EventQuickAdd } from "./event-quick-add";
import { CalendarImportButton } from "./import-button";

/** Vista serializzabile del blocco Google (dal server, via RSC). */
export type GoogleBlockView = {
  accounts: Array<{
    id: string;
    email: string;
    lastSyncedAt: string | null;
    lastSyncError: string | null;
  }>;
  events: GoogleAgendaEvent[];
};

export function CalendarScreen({
  initialDay,
  google,
}: {
  initialDay: DayString | null;
  /** null = ospite: il blocco Google non esiste proprio. */
  google: GoogleBlockView | null;
}) {
  const today = useToday();
  const [selected, setSelected] = useState<DayString>(
    initialDay ?? todayLocal(),
  );
  const actions = useTaskActions();

  const [detailEventId, setDetailEventId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Finestra larga per markers e agenda (vedi commento di testa).
  const rangeFrom = useMemo(() => addMonths(today, -6), [today]);
  const rangeTo = useMemo(() => addMonths(today, 12), [today]);
  const events = useEventsRange(rangeFrom, rangeTo);
  const rangeTasks = useUpcomingTasks(rangeFrom, rangeTo);
  const dayTasks = useTasks(selected);

  const googleEvents = useMemo(
    () => google?.events ?? [],
    [google],
  );

  const density = useMemo(
    () =>
      buildDensityMap({
        events: events ?? [],
        tasks: rangeTasks ?? [],
        google: googleEvents,
      }),
    [events, rangeTasks, googleEvents],
  );

  const agenda = useMemo(
    () =>
      buildDayAgenda(selected, {
        events: events ?? [],
        tasks: dayTasks ?? [],
        google: googleEvents,
      }),
    [selected, events, dayTasks, googleEvents],
  );

  const loading = events === undefined || dayTasks === undefined;

  return (
    // Run-12 P5b (PROP-cal-02): da lg due pannelli — mese a sinistra,
    // agenda del giorno a destra (il "peek" dei prodotti craft) — e la
    // superficie diventa "wide". Su mobile i tre wrapper sono pile
    // flex identiche a prima: ordine e spaziatura byte-uguali.
    <div
      className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start"
      data-page-width="wide"
    >
      <div className="flex flex-col gap-6">
        <section className="em-card p-5" aria-label="Mese">
          <Calendar
            value={selected}
            onChange={setSelected}
            markers={(day) => density.get(day) ?? 0}
          />
        </section>

        <EventQuickAdd today={today} defaultDate={selected} />
      </div>

      <section
        aria-label="Agenda del giorno"
        className="em-card p-5 lg:row-span-2"
      >
        <p className="em-eyebrow">{formatDayFull(selected)}</p>
        {loading ? (
          <div className="mt-3 flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : agenda.length > 0 ? (
          <div className="mt-2">
            <AgendaList
              items={agenda}
              onOpenEvent={setDetailEventId}
              onOpenTask={setDetailTaskId}
            />
          </div>
        ) : (
          <EmptyState
            compact
            heading="Niente in agenda"
            text="Aggiungi un evento qui sopra, o un task con orario."
          />
        )}
      </section>

      {google !== null ? (
        <div className="flex flex-col gap-6">
          {/* Prompt inline dell'import legacy (run-05 prompt 1): solo utenti
              autenticati (google !== null) con zero eventi locali nella
              finestra — i dati della vecchia /agenda vivono sul server. */}
          {events !== undefined && events.length === 0 ? (
            <section
              aria-label="Importa dalla vecchia agenda"
              className="rounded-[var(--em-r-lg)] border border-dashed border-[var(--em-hairline-strong)] p-5"
            >
              <p className="em-body-sm text-[var(--em-text-3)]">
                Qui non ci sono ancora eventi, ma quelli della vecchia Agenda
                non si perdono: importali quando vuoi.
              </p>
              <div className="mt-3">
                <CalendarImportButton compact />
              </div>
            </section>
          ) : null}

          <GoogleBlock google={google} />
        </div>
      ) : null}

      <EventDetailSheet
        eventId={detailEventId}
        onClose={() => setDetailEventId(null)}
      />
      <TaskDetailSheet
        taskId={detailTaskId}
        today={today}
        actions={actions}
        onClose={() => setDetailTaskId(null)}
      />
    </div>
  );
}

/* ── Blocco Google (solo account) ────────────────────────────────────── */

const SYNC_ERROR_LABELS: Record<string, string> = {
  token_refresh_failed:
    "Non ho potuto rinnovare l'accesso a Google. Riconnetti l'account.",
  db_upsert_failed: "Non ho potuto salvare gli eventi. Riprova.",
  google_api_error: "Google non ha risposto. Riprova tra poco.",
  account_missing: "Account non trovato. Riconnetti Google.",
  sync_failed: "Sincronizzazione non riuscita. Riprova.",
};

function relativeTimeIt(iso: string | null, now = new Date()): string {
  if (!iso) return "mai";
  const min = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return "adesso";
  if (min < 60) return `${min} min fa`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h fa`;
  return `${Math.floor(hr / 24)} g fa`;
}

function GoogleBlock({ google }: { google: GoogleBlockView }) {
  return (
    <section aria-label="Google Calendar" className="em-card p-5">
      <p className="em-eyebrow">Google Calendar</p>
      {google.accounts.length === 0 ? (
        <div className="mt-3 flex flex-col gap-3">
          <p className="em-body-sm text-[var(--em-text-3)]">
            Collega Google Calendar per vedere qui i tuoi eventi, in sola
            lettura accanto a task ed eventi locali.
          </p>
          <Link
            href="/api/auth/google/start"
            className="inline-flex h-[var(--em-control-h-md)] w-fit items-center justify-center rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] px-4 text-[length:var(--em-fs-body)] font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline)] transition-shadow duration-[var(--em-dur-control)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          >
            Connetti Google
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {google.accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="em-body truncate text-[var(--em-text)]">
                  {account.email}
                </p>
                <p className="em-body-sm mt-0.5 text-[var(--em-text-3)]">
                  Sola lettura · ultima sincronizzazione:{" "}
                  {relativeTimeIt(account.lastSyncedAt)}
                </p>
                {account.lastSyncError ? (
                  <p className="em-body-sm mt-1 text-[var(--em-segnale)]">
                    {SYNC_ERROR_LABELS[account.lastSyncError] ??
                      SYNC_ERROR_LABELS.sync_failed}
                  </p>
                ) : null}
              </div>
              {/* Disconnessione PER-ACCOUNT (run-05 prompt 1): revoca
                  server-side portata dalla /agenda legacy; con più account
                  se ne stacca uno solo. */}
              <form action={disconnectGoogleAccount.bind(null, account.id)}>
                <DisconnectButton />
              </form>
            </div>
          ))}
          <form action={syncGoogleCalendars}>
            <SyncButton />
          </form>
        </div>
      )}
    </section>
  );
}

function SyncButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending}>
      Sincronizza
    </Button>
  );
}

function DisconnectButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" size="sm" loading={pending}>
      Disconnetti
    </Button>
  );
}
