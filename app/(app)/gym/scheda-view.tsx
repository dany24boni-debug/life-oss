"use client";

/**
 * La vista scheda-centrica di /gym (run-10 P2) — la porta d'ingresso è
 * il quaderno delle schede, come l'Excel di Davide:
 *
 *   - SchedaCards: una card per giorno-scheda del programma attivo —
 *     nome, riepilogo sezioni, ultima esecuzione, chip "suggerita"
 *     (stessa rotazione next-up di sempre). La sessione libera resta
 *     come scorciatoia in coda, mai come front door.
 *   - SchedaCardView: il cuore — la griglia storica del giorno, righe =
 *     esercizi nell'ordine della scheda (gruppi di sezione), colonne =
 *     date delle esecuzioni (oggi per prima quando esiste), celle =
 *     "peso × reps" per serie. "Logga oggi" vive QUI e entra nel flusso
 *     di log esistente; il tap sul nome apre la scheda esercizio coi
 *     progressi. Prima colonna sticky, scroll orizzontale sul resto:
 *     mobile ~2-3 colonne, desktop quante ne entrano.
 *
 * Le query passano SOLO dagli hook esistenti (fence P2: data/**
 * intoccato): le righe caricano i set del proprio esercizio con
 * useSetsByExercise — un hook per riga, numero stabile per istanza (il
 * pattern della ricorsione dieta, run-09).
 */

import { Fragment, useMemo } from "react";
import { Button, EmptyState, Skeleton, cx, useToast } from "@/ui";
import {
  useExercises,
  useNextUpDay,
  useProgramDay,
  useProgramDays,
  useProgramSlots,
  useSessionsByProgramDay,
  useSetsByExercise,
} from "@/data/hooks";
import { getDb, hasIndexedDb } from "@/data/db";
import { seedTorsoA } from "@/data/gym-programs";
import type {
  GymExercise,
  GymProgram,
  GymProgramDay,
  GymProgramSlot,
  GymSession,
} from "@/data/schemas";
import { formatDayShort } from "@/ui/calendar-core";
import { useToday } from "../_components/tasks/screen-hooks";
import {
  historyColumns,
  lastDoneDate,
  sectionSummary,
  setsBySessionForExercise,
  type HistoryColumn,
} from "./card-history";
import { weightPrSetIds } from "./pr";
import { doneCellLabel, verdictForSlot, verdictLabel } from "./progression";
import { sectionGroups, slotSummary } from "./program-parse";
import { BackButton } from "./programs-panel";

/* ── La lista delle card ─────────────────────────────────────────────── */

export function SchedaCards({
  program,
  freeActive,
  onOpenCard,
  onResumeFree,
  onStartFree,
  onGoProgrammi,
  importPrompt,
}: {
  /** Programma attivo (null = nessuno; undefined = caricamento). */
  program: GymProgram | null | undefined;
  /** Sessione libera in corso oggi (senza giorno-scheda), se esiste. */
  freeActive: GymSession | null;
  onOpenCard: (day: GymProgramDay) => void;
  onResumeFree: () => void;
  onStartFree: () => void;
  onGoProgrammi: () => void;
  /** Prompt di import legacy (solo autenticati, storico vuoto). */
  importPrompt: React.ReactNode;
}) {
  const toast = useToast();
  const today = useToday();
  const nextUp = useNextUpDay();
  const days = useProgramDays(program?.id ?? null);

  async function importTorsoA() {
    if (!hasIndexedDb()) return;
    const inserted = await seedTorsoA(getDb());
    toast.show({
      message:
        inserted > 0
          ? "Importata: Torso A, la tua scheda d'esempio."
          : "Torso A è già qui — niente doppioni.",
      tone: inserted > 0 ? "success" : "neutral",
    });
  }

  if (program === undefined || (program !== null && days === undefined)) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (program === null) {
    return (
      <EmptyState
        heading="Nessun programma attivo"
        text="La scheda è la porta d'ingresso: crea il programma (o importa l'esempio) e ogni giorno diventa una card con la sua storia."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onGoProgrammi}
            >
              Vai a Programmi
            </Button>
            <Button type="button" size="sm" onClick={() => void importTorsoA()}>
              Importa esempio: Torso A
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {freeActive ? (
        <div className="flex items-center justify-between gap-3 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-3 shadow-[0_0_0_1px_var(--em-hairline)]">
          <p className="em-body-sm min-w-0 text-[var(--em-text-2)]">
            Sessione libera in corso
            <span className="em-dot em-dot--live ml-2" aria-hidden="true" />
          </p>
          <Button type="button" size="sm" variant="primary" onClick={onResumeFree}>
            Riprendi
          </Button>
        </div>
      ) : null}

      {(days ?? []).length === 0 ? (
        <EmptyState
          compact
          heading="Il programma attivo non ha giorni"
          text="Aggiungi un giorno («Torso A», «Gambe»…) dal builder."
          action={
            <Button type="button" size="sm" variant="primary" onClick={onGoProgrammi}>
              Apri il builder
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3 lg:grid lg:grid-cols-2">
          {(days ?? []).map((day) => (
            <SchedaCardItem
              key={day.id}
              day={day}
              suggested={nextUp?.id === day.id}
              today={today}
              onOpen={() => onOpenCard(day)}
            />
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={onStartFree}>
          Sessione libera
        </Button>
      </div>
      {importPrompt}
    </div>
  );
}

function SchedaCardItem({
  day,
  suggested,
  today,
  onOpen,
}: {
  day: GymProgramDay;
  suggested: boolean;
  today: string;
  onOpen: () => void;
}) {
  const slots = useProgramSlots(day.id);
  const sessions = useSessionsByProgramDay(day.id);
  const last = lastDoneDate(sessions ?? []);
  const inProgress = (sessions ?? []).some(
    (s) => s.date === today && s.finished_at === null,
  );

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="em-card flex min-h-11 w-full flex-col gap-1 p-4 text-left transition-shadow duration-[var(--em-dur-control)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
      >
        <span className="flex items-center gap-2">
          <span className="em-body min-w-0 truncate font-semibold text-[var(--em-text)]">
            {day.name}
          </span>
          {inProgress ? (
            <span className="em-dot em-dot--live shrink-0" aria-hidden="true" />
          ) : null}
          {suggested ? (
            <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-ember-text)]">
              suggerita
            </span>
          ) : null}
        </span>
        {day.subtitle ? (
          <span className="em-body-sm truncate text-[var(--em-text-3)]">
            {day.subtitle}
          </span>
        ) : null}
        <span className="em-body-sm flex flex-wrap items-center gap-x-2 text-[var(--em-text-2)]">
          <span className="truncate">
            {slots === undefined ? "…" : sectionSummary(slots)}
          </span>
          <span className="em-eyebrow text-[var(--em-text-3)]">
            {sessions === undefined
              ? ""
              : inProgress
                ? "in corso"
                : last !== null
                  ? `ultima: ${formatDayShort(last)}`
                  : "mai eseguita"}
          </span>
        </span>
      </button>
    </li>
  );
}

/* ── La vista card: header + griglia storica ─────────────────────────── */

export function SchedaCardView({
  dayId,
  activeToday,
  onBack,
  onLog,
  onResumeActive,
  onOpenExercise,
  onOpenSession,
}: {
  dayId: string;
  /** La sessione di oggi NON conclusa, di qualunque giorno (o libera). */
  activeToday: GymSession | null;
  onBack: () => void;
  /** Avvia (o riprende) il log DI QUESTO giorno: entra nella griglia. */
  onLog: (existing: GymSession | null) => void;
  /** Riprende la sessione attiva che appartiene ad ALTRO (giorno o libera). */
  onResumeActive: (session: GymSession) => void;
  onOpenExercise: (exercise: GymExercise) => void;
  /** Apre l'editor storico di una seduta conclusa (modale esistente). */
  onOpenSession: (sessionId: string) => void;
}) {
  const today = useToday();
  const day = useProgramDay(dayId);
  const slots = useProgramSlots(dayId);
  const sessions = useSessionsByProgramDay(dayId);
  const exercises = useExercises();

  const byId = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id, e] as const)),
    [exercises],
  );

  if (
    day === undefined ||
    slots === undefined ||
    sessions === undefined ||
    exercises === undefined
  ) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (day === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BackButton label="Schede" onClick={onBack} />
        <p className="em-body-sm text-[var(--em-text-3)]">
          Questa scheda non c&apos;è più.
        </p>
      </div>
    );
  }

  const columns = historyColumns(sessions, today);
  const mineToday =
    sessions.find((s) => s.date === today && s.finished_at === null) ?? null;
  const doneToday =
    sessions.find((s) => s.date === today && s.finished_at !== null) ?? null;
  const activeElsewhere =
    activeToday !== null && activeToday.program_day_id !== dayId
      ? activeToday
      : null;
  // Verdetto: l'ultima seduta CONCLUSA (mai quella in corso).
  const verdictSessionId =
    sessions.find((s) => s.finished_at !== null)?.id ?? null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <BackButton label="Schede" onClick={onBack} />
        {activeElsewhere ? (
          <Button
            type="button"
            size="sm"
            onClick={() => onResumeActive(activeElsewhere)}
          >
            Riprendi la sessione in corso
          </Button>
        ) : mineToday ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => onLog(mineToday)}
          >
            Riprendi
          </Button>
        ) : doneToday === null ? (
          <Button type="button" variant="primary" onClick={() => onLog(null)}>
            Logga oggi
          </Button>
        ) : null}
      </div>

      <div>
        <h2 className="em-title font-semibold text-[var(--em-text)]">
          {day.name}
        </h2>
        <p className="em-body-sm text-[var(--em-text-3)]">
          {day.subtitle ? `${day.subtitle} · ` : ""}
          {sectionSummary(slots)}
        </p>
        {doneToday ? (
          <p className="em-body-sm mt-1 text-[var(--em-text-2)]">
            Fatta oggi.{" "}
            <button
              type="button"
              onClick={() => onOpenSession(doneToday.id)}
              className="underline decoration-[var(--em-hairline-strong)] underline-offset-4 transition-colors duration-[var(--em-dur-control)] hover:text-[var(--em-text)]"
            >
              Rivedi la seduta
            </button>
          </p>
        ) : null}
      </div>

      {slots.length === 0 ? (
        <EmptyState
          compact
          heading="Scheda senza esercizi"
          text="Le righe si scrivono nel builder (tab Programmi)."
        />
      ) : (
        <CardHistoryGrid
          dayName={day.name}
          slots={slots}
          columns={columns}
          verdictSessionId={verdictSessionId}
          nameOf={(id) => byId.get(id)?.name ?? "Esercizio rimosso"}
          onOpenExercise={(id) => {
            const exercise = byId.get(id);
            if (exercise) onOpenExercise(exercise);
          }}
        />
      )}

      {columns.length === 0 ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Ancora nessuna esecuzione: la prima colonna nasce con «Logga oggi».
        </p>
      ) : null}
    </div>
  );
}

/* ── La griglia storica (Excel-style) ────────────────────────────────── */

function CardHistoryGrid({
  dayName,
  slots,
  columns,
  verdictSessionId,
  nameOf,
  onOpenExercise,
}: {
  dayName: string;
  slots: GymProgramSlot[];
  columns: HistoryColumn[];
  verdictSessionId: string | null;
  nameOf: (exerciseId: string) => string;
  onOpenExercise: (exerciseId: string) => void;
}) {
  return (
    <div
      className="em-card overflow-x-auto p-4"
      role="region"
      aria-label={`Storico della scheda ${dayName}`}
      tabIndex={0}
    >
      <table className="w-max min-w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="em-eyebrow sticky left-0 z-10 bg-[var(--em-surface)] py-1.5 pr-3 text-left font-medium text-[var(--em-text-3)]">
              Esercizio
            </th>
            {columns.map((col) => (
              <th
                key={col.sessionId}
                scope="col"
                className={cx(
                  "em-body-sm whitespace-nowrap px-3 py-1.5 text-left font-semibold",
                  col.isToday
                    ? "text-[var(--em-ember-text)]"
                    : "text-[var(--em-text)]",
                )}
              >
                {col.isToday ? "Oggi" : formatDayShort(col.date)}
              </th>
            ))}
            {columns.length === 0 ? (
              <th className="em-body-sm px-3 py-1.5 text-left font-normal text-[var(--em-text-3)]">
                —
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {sectionGroups(slots).map((group, gi) => (
            <Fragment key={`g:${gi}`}>
              {group.section !== null ? (
                <tr>
                  <th
                    scope="rowgroup"
                    className="em-eyebrow sticky left-0 z-10 bg-[var(--em-surface)] pb-1 pr-3 pt-3 text-left font-medium text-[var(--em-ember-text)]"
                  >
                    {group.section}
                  </th>
                  <td colSpan={Math.max(columns.length, 1)} aria-hidden="true" />
                </tr>
              ) : null}
              {group.slots.map((slot) => (
                <CardExerciseRow
                  key={slot.id}
                  slot={slot}
                  columns={columns}
                  verdictSessionId={verdictSessionId}
                  name={nameOf(slot.exercise_id)}
                  onOpen={() => onOpenExercise(slot.exercise_id)}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Una riga = un esercizio della scheda. Carica la SUA storia con l'hook
 * esistente (numero di hook stabile per istanza) e distribuisce i set
 * sulle colonne; il nome apre la scheda esercizio (progressi e1RM/Δ/PR).
 */
function CardExerciseRow({
  slot,
  columns,
  verdictSessionId,
  name,
  onOpen,
}: {
  slot: GymProgramSlot;
  columns: HistoryColumn[];
  verdictSessionId: string | null;
  name: string;
  onOpen: () => void;
}) {
  const sets = useSetsByExercise(slot.exercise_id, 500);
  const bySession = useMemo(
    () => setsBySessionForExercise(sets ?? [], columns),
    [sets, columns],
  );
  // Run-12 (PROP-gym-04): i set che ERANO record quando furono fatti —
  // il momento PR resta visibile nella storia, non solo nel toast.
  const prIds = useMemo(() => weightPrSetIds(sets ?? []), [sets]);
  const verdict =
    verdictSessionId !== null && sets !== undefined
      ? verdictForSlot(slot, bySession.get(verdictSessionId) ?? [])
      : null;

  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 max-w-56 bg-[var(--em-surface)] py-1.5 pr-3 text-left align-top font-normal"
      >
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${name}: apri progressi`}
          className="min-h-11 text-left"
        >
          <span className="em-body-sm flex items-center gap-1.5 font-medium text-[var(--em-text)]">
            <span className="min-w-0 truncate">{name}</span>
            {verdict ? (
              <span
                title="Suggerimento, non un ordine."
                className={cx(
                  "em-eyebrow shrink-0 rounded-full px-1.5 py-0.5",
                  verdict === "aumenta"
                    ? "bg-[var(--em-ember-tint)] text-[var(--em-ember-text)]"
                    : "bg-[var(--em-surface-2)] text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)]",
                )}
              >
                {verdictLabel(verdict, slot.bodyweight)}
              </span>
            ) : null}
          </span>
          <span className="em-eyebrow block truncate text-[var(--em-text-3)]">
            {slot.variant ? `${slot.variant} · ` : ""}
            {slotSummary(slot)}
          </span>
        </button>
      </th>
      {columns.map((col) => {
        const own = bySession.get(col.sessionId) ?? [];
        return (
          <td
            key={col.sessionId}
            className="whitespace-nowrap px-3 py-1.5 align-top"
          >
            {sets === undefined ? (
              <Skeleton className="h-4 w-12" />
            ) : own.length === 0 ? (
              <span className="em-body-sm text-[var(--em-text-3)]">·</span>
            ) : (
              <span className="flex flex-col gap-0.5">
                {own.map((s) => (
                  <span
                    key={s.id}
                    className="em-body-sm em-num text-[var(--em-text)]"
                  >
                    {doneCellLabel(s)}
                    {prIds.has(s.id) ? (
                      <span
                        title="Record personale al momento del set"
                        className="em-eyebrow ml-1 text-[var(--em-ember-text)]"
                      >
                        PR
                      </span>
                    ) : null}
                  </span>
                ))}
              </span>
            )}
          </td>
        );
      })}
      {columns.length === 0 ? (
        <td className="em-body-sm px-3 py-1.5 text-[var(--em-text-3)]">·</td>
      ) : null}
    </tr>
  );
}
