"use client";

/**
 * Lo schermo di /gym (B2.3, programmi dal run-07) — quattro tab:
 *   - Allenamento: la sessione di oggi (inizia da zero o da piano,
 *     runner col timer di recupero, concludi con riepilogo volume/durata/
 *     record). Lo stato del timer vive QUI, sopra i Tabs: cambiare tab
 *     non lo azzera (i pannelli si smontano).
 *   - Storico: lista sessioni + strip mensile dei giorni di allenamento
 *     (riusa MonthHeat di /stats); una sessione passata si apre e si
 *     modifica con lo stesso runner (senza timer).
 *   - Libreria: catalogo seminato + custom, scheda con progressi e PR.
 *   - Programmi (run-07): la scheda vera — programmi → giorni → slot
 *     con sezioni e prescrizioni testuali (programs-panel.tsx). I piani
 *     v1 vengono convertiti UNA volta in un programma al mount
 *     (convertPlansToPrograms, idempotente) e restano leggibili.
 * Semina del catalogo al primo uso (idempotente). Guest-first: tutto
 * locale; l'import legacy compare solo agli autenticati.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  Modal,
  Skeleton,
  Tabs,
  useToast,
} from "@/ui";
import {
  addMonths,
  formatDayShort,
  todayLocal,
} from "@/ui/calendar-core";
import {
  appRepos,
  useActiveProgram,
  useExercises,
  useGymSession,
  useGymSessionsByDay,
  useGymSessionsRange,
  useNextUpDay,
  useProgramDays,
} from "@/data/hooks";
import { getDb, hasIndexedDb } from "@/data/db";
import { convertPlansToPrograms } from "@/data/gym-programs";
import { seedGymExercises } from "@/data/gym-seed";
import type { GymExercise, GymProgramDay, GymSession } from "@/data/schemas";
import { monthBounds } from "../stats/logic";
import { MonthHeat } from "../stats/month-heat";
import { useToday } from "../_components/tasks/screen-hooks";
import { ExerciseDetailSheet } from "./exercise-detail";
import { groupLabel } from "./exercise-picker";
import { GymImportButton } from "./import-button";
import {
  formatKg,
  newRecords,
  sessionDurationMin,
  totalVolumeKg,
  type NewRecord,
} from "./logic";
import { ProgramsPanel } from "./programs-panel";
import { plannedSetCount } from "./progression";
import { SessionGrid } from "./session-grid";
import { SessionRunner } from "./session-runner";

type FinishSummary = {
  sessionId: string;
  volumeKg: number;
  durationMin: number | null;
  records: NewRecord[];
  exerciseNames: Map<string, string>;
  /** Serie fatte / previste; previste null per le sessioni libere. */
  doneSets: number;
  plannedSets: number | null;
};

export function GymScreen({ authed }: { authed: boolean }) {
  const toast = useToast();
  const today = useToday();
  const todaySessions = useGymSessionsByDay(today);
  const exercises = useExercises();

  // Semina idempotente del catalogo + conversione una-tantum dei piani
  // v1 in programma (run-07; idempotente, id derivati) al primo uso.
  useEffect(() => {
    if (hasIndexedDb()) {
      const db = getDb();
      void seedGymExercises(db).then(() => convertPlansToPrograms(db));
    }
  }, []);

  const [finish, setFinish] = useState<FinishSummary | null>(null);
  const [detailExercise, setDetailExercise] = useState<GymExercise | null>(null);
  const [createExercise, setCreateExercise] = useState(false);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);

  const active =
    (todaySessions ?? []).find((s) => s.finished_at === null) ?? null;
  const doneToday =
    (todaySessions ?? []).find((s) => s.finished_at !== null) ?? null;

  async function startFree() {
    const r = await appRepos().gym.createSession({
      date: today,
      started_at: new Date().toISOString(),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function startFromDay(day: GymProgramDay) {
    const r = await appRepos().gym.startSessionFromDay(day.id, today);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function finishSession(session: GymSession) {
    const repo = appRepos().gym;
    const finishedAt = new Date().toISOString();
    const r = await repo.updateSession(session.id, { finished_at: finishedAt });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }

    // Riepilogo: volume, durata, aderenza, record battuti sulla storia.
    const sets = await repo.listSetsBySession(session.id);
    const exerciseIds = [...new Set(sets.map((s) => s.exercise_id))];
    const prior = (
      await Promise.all(
        exerciseIds.map((id) => repo.listSetsByExercise(id, { limit: 500 })),
      )
    )
      .flat()
      .filter((s) => s.session_id !== session.id);
    const names = new Map<string, string>();
    for (const id of exerciseIds) {
      names.set(id, (await repo.getExerciseById(id))?.name ?? "Esercizio");
    }
    const plannedSets =
      session.program_day_id !== null
        ? plannedSetCount(await repo.listProgramSlots(session.program_day_id))
        : null;
    setFinish({
      sessionId: session.id,
      volumeKg: totalVolumeKg(sets),
      durationMin: sessionDurationMin(session.started_at, finishedAt),
      records: newRecords(sets, prior),
      exerciseNames: names,
      doneSets: sets.length,
      plannedSets,
    });
  }

  const loading = todaySessions === undefined;

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        items={[
          { value: "oggi", label: "Allenamento" },
          { value: "storico", label: "Storico" },
          { value: "libreria", label: "Libreria" },
          { value: "programmi", label: "Programmi" },
        ]}
      >
        {(tab) => (
          <div className="pt-4">
            {tab === "oggi" ? (
              loading ? (
                <Skeleton className="h-24 w-full" />
              ) : active ? (
                <SessionGrid
                  session={active}
                  onFinish={() => void finishSession(active)}
                />
              ) : (
                <StartPanel
                  authed={authed}
                  doneToday={doneToday}
                  onStartFree={() => void startFree()}
                  onStartDay={(day) => void startFromDay(day)}
                />
              )
            ) : null}

            {tab === "storico" ? (
              <HistoryPanel
                authed={authed}
                onOpen={setHistorySessionId}
              />
            ) : null}

            {tab === "libreria" ? (
              <LibraryPanel
                exercises={exercises}
                onOpen={setDetailExercise}
                onCreate={() => setCreateExercise(true)}
              />
            ) : null}

            {tab === "programmi" ? <ProgramsPanel /> : null}
          </div>
        )}
      </Tabs>

      <ExerciseDetailSheet
        exercise={detailExercise}
        createOpen={createExercise}
        onClose={() => {
          setDetailExercise(null);
          setCreateExercise(false);
        }}
      />
      <HistorySessionSheet
        sessionId={historySessionId}
        onClose={() => setHistorySessionId(null)}
      />

      <Modal
        open={finish !== null}
        onClose={() => setFinish(null)}
        title="Allenamento concluso"
        footer={
          <Button type="button" variant="primary" onClick={() => setFinish(null)}>
            Chiudi
          </Button>
        }
      >
        {finish ? <FinishBody finish={finish} /> : null}
      </Modal>
    </div>
  );
}

/* ── Schermata di fine: numeri, voto, note ───────────────────────────── */

function FinishBody({ finish }: { finish: FinishSummary }) {
  const toast = useToast();
  const session = useGymSession(finish.sessionId);
  const [notes, setNotes] = useState(session?.notes ?? "");

  async function rate(rating: number) {
    const r = await appRepos().gym.updateSession(finish.sessionId, {
      rating_1_10: session?.rating_1_10 === rating ? null : rating,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function commitNotes() {
    const value = notes.trim() === "" ? null : notes;
    if (value === (session?.notes ?? null)) return;
    const r = await appRepos().gym.updateSession(finish.sessionId, {
      notes: value,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="em-eyebrow">Volume</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {formatKg(finish.volumeKg)}
          </dd>
        </div>
        <div>
          <dt className="em-eyebrow">Durata</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {finish.durationMin !== null ? `${finish.durationMin} min` : "—"}
          </dd>
        </div>
        <div>
          <dt className="em-eyebrow">Aderenza</dt>
          <dd className="em-title em-num mt-0.5 text-[var(--em-text)]">
            {finish.plannedSets !== null
              ? `${finish.doneSets}/${finish.plannedSets}`
              : `${finish.doneSets} serie`}
          </dd>
        </div>
      </dl>

      {finish.records.length > 0 ? (
        <div>
          <p className="em-eyebrow">Record battuti</p>
          <ul className="mt-1 flex flex-col gap-1">
            {finish.records.map((r) => (
              <li
                key={`${r.exercise_id}-${r.kind}`}
                className="em-body-sm text-[var(--em-text)]"
              >
                {finish.exerciseNames.get(r.exercise_id)} — nuovo massimo di{" "}
                {r.kind}:{" "}
                <span className="em-num font-semibold">
                  {r.kind === "ripetizioni" ? r.value : formatKg(r.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessun record oggi — la costanza vale più del picco.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <p className="em-eyebrow">Voto seduta</p>
        <div
          className="flex flex-wrap gap-1"
          role="group"
          aria-label="Voto della seduta, da 1 a 10"
        >
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={session?.rating_1_10 === v}
              onClick={() => void rate(v)}
              className={
                session?.rating_1_10 === v
                  ? "em-body-sm em-num grid h-11 w-9 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-ember-tint)] font-semibold text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                  : "em-body-sm em-num grid h-11 w-9 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
              }
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="finish-notes" className="em-eyebrow">
          Note
        </label>
        <textarea
          id="finish-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void commitNotes()}
          rows={2}
          maxLength={2000}
          className="em-body mt-1.5 w-full rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-3 text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline)] outline-none transition-shadow duration-[var(--em-dur-control)] placeholder:text-[var(--em-text-3)] focus:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          placeholder="Com'è andata?"
        />
      </div>
    </div>
  );
}

/* ── Pannello di partenza ────────────────────────────────────────────── */

function StartPanel({
  authed,
  doneToday,
  onStartFree,
  onStartDay,
}: {
  authed: boolean;
  doneToday: GymSession | null;
  onStartFree: () => void;
  onStartDay: (day: GymProgramDay) => void;
}) {
  const nextUp = useNextUpDay();
  const program = useActiveProgram();
  const days = useProgramDays(program?.id ?? null);
  const others = (days ?? []).filter((d) => d.id !== nextUp?.id);

  return (
    <div className="flex flex-col gap-4">
      {doneToday ? (
        <p className="em-body text-[var(--em-text-2)]">
          Oggi ti sei già allenato. Un&apos;altra sessione? Nessuno ti ferma.
        </p>
      ) : null}

      {nextUp ? (
        <div className="flex flex-col gap-3">
          <div>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={() => onStartDay(nextUp)}
            >
              Inizia: {nextUp.name}
            </Button>
            {nextUp.subtitle ? (
              <p className="em-body-sm mt-1.5 text-[var(--em-text-3)]">
                {nextUp.subtitle}
              </p>
            ) : null}
          </div>
          {others.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="em-body-sm text-[var(--em-text-3)]">
                oppure:
              </span>
              {others.map((day) => (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => onStartDay(day)}
                  className="em-body-sm h-11 rounded-full bg-[var(--em-surface-2)] px-3.5 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
                >
                  {day.name}
                </button>
              ))}
            </div>
          ) : null}
          <div>
            <Button type="button" variant="ghost" onClick={onStartFree}>
              Sessione libera
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="primary" size="lg" onClick={onStartFree}>
            Inizia allenamento
          </Button>
        </div>
      )}
      {authed ? <EmptyHistoryImportPrompt /> : null}
    </div>
  );
}

/** Prompt inline dell'import: solo autenticati e solo a storico vuoto. */
function EmptyHistoryImportPrompt() {
  const today = todayLocal();
  const recent = useGymSessionsRange(addMonths(today, -12), today);
  if (recent === undefined || recent.length > 0) return null;
  return (
    <div className="rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-4 shadow-[0_0_0_1px_var(--em-hairline)]">
      <p className="em-body-sm text-[var(--em-text-2)]">
        Lo storico qui è vuoto, ma i tuoi allenamenti del vecchio Gym non si
        perdono: importali quando vuoi.
      </p>
      <div className="mt-3">
        <GymImportButton compact />
      </div>
    </div>
  );
}

/* ── Storico ─────────────────────────────────────────────────────────── */

function HistoryPanel({
  authed,
  onOpen,
}: {
  authed: boolean;
  onOpen: (sessionId: string) => void;
}) {
  const today = useToday();
  const month = monthBounds(today);
  const sessions = useGymSessionsRange(addMonths(today, -12), today);

  if (sessions === undefined) return <Skeleton className="h-24 w-full" />;

  const trainingDays = new Set(sessions.map((s) => s.date));
  const recent = [...sessions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="em-eyebrow">Questo mese</p>
        <div className="mt-2">
          <MonthHeat
            from={month.from}
            to={month.to}
            today={today}
            activeDays={trainingDays}
            protectedDays={new Set()}
          />
        </div>
      </div>

      {recent.length === 0 ? (
        <EmptyState
          compact
          heading="Ancora nessun allenamento"
          text="La prima sessione inaugura lo storico."
          action={authed ? <GymImportButton compact /> : undefined}
        />
      ) : (
        <ul className="flex flex-col">
          {recent.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onOpen(s.id)}
                className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
              >
                <span className="em-body em-num shrink-0 font-medium text-[var(--em-text)]">
                  {formatDayShort(s.date)}
                </span>
                <span className="em-body-sm min-w-0 flex-1 truncate text-[var(--em-text-3)]">
                  {s.finished_at === null && s.date === today
                    ? "In corso"
                    : (s.notes?.split("\n")[0] ?? "")}
                </span>
                <span className="em-eyebrow shrink-0 text-[var(--em-text-3)]">
                  apri
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sessione passata: l'editor storico (senza timer, per costruzione). */
function HistorySessionSheet({
  sessionId,
  onClose,
}: {
  sessionId: string | null;
  onClose: () => void;
}) {
  const session = useGymSession(sessionId);
  return (
    <Modal
      open={sessionId !== null}
      onClose={onClose}
      title={session ? `Sessione · ${formatDayShort(session.date)}` : "Sessione"}
    >
      {session ? <SessionRunner session={session} /> : null}
    </Modal>
  );
}

/* ── Libreria ────────────────────────────────────────────────────────── */

function LibraryPanel({
  exercises,
  onOpen,
  onCreate,
}: {
  exercises: GymExercise[] | undefined;
  onOpen: (exercise: GymExercise) => void;
  onCreate: () => void;
}) {
  const [group, setGroup] = useState<string | null>(null);
  const list = useMemo(
    () =>
      (exercises ?? []).filter(
        (e) => group === null || e.muscle_group === group,
      ),
    [exercises, group],
  );
  const groups = useMemo(
    () => [...new Set((exercises ?? []).map((e) => e.muscle_group))],
    [exercises],
  );

  if (exercises === undefined) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {groups.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={group === g}
            onClick={() => setGroup((cur) => (cur === g ? null : g))}
            className={
              group === g
                ? "em-body-sm h-8 rounded-full bg-[var(--em-ember-tint)] px-3 font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                : "em-body-sm h-8 rounded-full bg-[var(--em-surface-2)] px-3 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
            }
          >
            {groupLabel(g)}
          </button>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onCreate}
          className="ml-auto"
        >
          + Nuovo esercizio
        </Button>
      </div>
      <ul className="flex flex-col">
        {list.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onOpen(e)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body min-w-0 truncate text-[var(--em-text)]">
                {e.name}
                {e.is_custom ? (
                  <span className="em-eyebrow ml-2 text-[var(--em-text-3)]">
                    custom
                  </span>
                ) : null}
              </span>
              <span className="em-eyebrow shrink-0 text-[var(--em-text-3)]">
                {groupLabel(e.muscle_group)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

