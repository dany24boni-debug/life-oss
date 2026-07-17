"use client";

/**
 * Lo schermo di /gym — dal run-10 P2 la porta d'ingresso è la SCHEDA
 * (card-manager, il modello mentale di Davide), quattro tab:
 *   - Scheda: le card dei giorni del programma attivo; aprirne una
 *     mostra la griglia storica di QUEL giorno (righe = esercizi,
 *     colonne = date) e "Logga oggi" entra nel flusso di log esistente
 *     (griglia senza countdown, run-07 — internals intoccati). La
 *     sessione libera resta come scorciatoia in coda alle card.
 *   - Storico: lista sessioni + strip mensile dei giorni di allenamento
 *     (riusa MonthHeat di /stats); una sessione passata si apre e si
 *     modifica con lo stesso runner (senza timer).
 *   - Libreria: catalogo seminato + custom, scheda con progressi e PR.
 *   - Programmi (run-07): l'authoring — programmi → giorni → slot con
 *     sezioni e prescrizioni testuali (programs-panel.tsx). I piani v1
 *     vengono convertiti UNA volta in un programma al mount
 *     (convertPlansToPrograms, idempotente) e restano leggibili.
 * Deep link: /gym?scheda=<dayId> apre direttamente quella card (è il
 * bersaglio del tile di Oggi). Semina del catalogo al primo uso
 * (idempotente). Guest-first: tutto locale; l'import legacy compare
 * solo agli autenticati.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  useBodyDay,
  useExercises,
  useGymSession,
  useGymSessionsByDay,
  useGymSessionsRange,
  useLatestBody,
} from "@/data/hooks";
import { getDb, hasIndexedDb } from "@/data/db";
import { convertPlansToPrograms } from "@/data/gym-programs";
import { seedGymExercises } from "@/data/gym-seed";
import type { GymExercise, GymSession } from "@/data/schemas";
import { monthBounds } from "../stats/logic";
import { MonthHeat } from "../stats/month-heat";
import { WeightQuickEntry } from "../corpo/corpo-screen";
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
import { BackButton, ProgramsPanel } from "./programs-panel";
import { plannedSetCount } from "./progression";
import { SchedaCards, SchedaCardView } from "./scheda-view";
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

/** Vista interna della tab Scheda: card list → card → griglia di log. */
type SchedaNav =
  | { kind: "cards" }
  | { kind: "card"; dayId: string }
  | { kind: "log"; dayId: string | null };

export function GymScreen({ authed }: { authed: boolean }) {
  const toast = useToast();
  const today = useToday();
  const todaySessions = useGymSessionsByDay(today);
  const exercises = useExercises();
  const program = useActiveProgram();
  const searchParams = useSearchParams();
  const urlScheda = searchParams.get("scheda");

  // Semina idempotente del catalogo + conversione una-tantum dei piani
  // v1 in programma (run-07; idempotente, id derivati) al primo uso.
  useEffect(() => {
    if (hasIndexedDb()) {
      const db = getDb();
      void seedGymExercises(db).then(() => convertPlansToPrograms(db));
    }
  }, []);

  const [tab, setTab] = useState("scheda");
  const [finish, setFinish] = useState<FinishSummary | null>(null);
  const [detailExercise, setDetailExercise] = useState<GymExercise | null>(null);
  const [createExercise, setCreateExercise] = useState(false);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);

  // Navigazione della tab Scheda, DERIVATA: il deep link (?scheda=) vale
  // finché l'utente non naviga; un link nuovo (param diverso) riprende
  // il comando. Niente setState negli effetti — stato derivato nel
  // render (la lezione lint dei run 07-09).
  const [nav, setNav] = useState<{
    param: string | null;
    view: SchedaNav;
  } | null>(null);
  const schedaView: SchedaNav =
    nav !== null && nav.param === urlScheda
      ? nav.view
      : urlScheda !== null
        ? { kind: "card", dayId: urlScheda }
        : { kind: "cards" };
  function go(view: SchedaNav) {
    setNav({ param: urlScheda, view });
  }

  const active =
    (todaySessions ?? []).find((s) => s.finished_at === null) ?? null;
  const freeActive =
    (todaySessions ?? []).find(
      (s) => s.finished_at === null && s.program_day_id === null,
    ) ?? null;
  // La sessione mostrata dalla griglia di log (per giorno-scheda o
  // libera): sempre dalla live query, mai tenuta in stato.
  const logSession =
    schedaView.kind === "log"
      ? ((todaySessions ?? []).find(
          (s) =>
            s.finished_at === null && s.program_day_id === schedaView.dayId,
        ) ?? null)
      : null;

  async function startFree() {
    const r = await appRepos().gym.createSession({
      date: today,
      started_at: new Date().toISOString(),
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    go({ kind: "log", dayId: null });
  }

  /** "Logga oggi" dalla card: riprende la sessione o la crea, poi griglia. */
  async function logDay(dayId: string, existing: GymSession | null) {
    if (existing === null) {
      const r = await appRepos().gym.startSessionFromDay(dayId, today);
      if (!r.ok) {
        toast.show({ message: r.error.message, tone: "error" });
        return;
      }
    }
    go({ kind: "log", dayId });
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
    // Si torna alla card, con la colonna di oggi popolata (run-10 P2);
    // il riepilogo si apre sopra come modale.
    go(
      session.program_day_id !== null
        ? { kind: "card", dayId: session.program_day_id }
        : { kind: "cards" },
    );
  }

  function renderScheda() {
    if (todaySessions === undefined) {
      return <Skeleton className="h-24 w-full" />;
    }
    if (schedaView.kind === "log" && logSession !== null) {
      const backToCard = logSession.program_day_id;
      return (
        <div className="flex flex-col gap-3">
          <BackButton
            label={backToCard !== null ? "Scheda" : "Schede"}
            onClick={() =>
              go(
                backToCard !== null
                  ? { kind: "card", dayId: backToCard }
                  : { kind: "cards" },
              )
            }
          />
          <SessionGrid
            session={logSession}
            onFinish={() => void finishSession(logSession)}
          />
        </div>
      );
    }
    const cardDayId =
      schedaView.kind === "card"
        ? schedaView.dayId
        : schedaView.kind === "log"
          ? schedaView.dayId
          : null;
    if (cardDayId !== null) {
      return (
        <SchedaCardView
          dayId={cardDayId}
          activeToday={active}
          onBack={() => go({ kind: "cards" })}
          onLog={(existing) => void logDay(cardDayId, existing)}
          onResumeActive={(session) =>
            go({ kind: "log", dayId: session.program_day_id })
          }
          onOpenExercise={setDetailExercise}
          onOpenSession={setHistorySessionId}
        />
      );
    }
    return (
      <SchedaCards
        program={program}
        freeActive={freeActive}
        onOpenCard={(day) => go({ kind: "card", dayId: day.id })}
        onResumeFree={() => go({ kind: "log", dayId: null })}
        onStartFree={() => void startFree()}
        onGoProgrammi={() => setTab("programmi")}
        importPrompt={authed ? <EmptyHistoryImportPrompt /> : null}
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        items={[
          { value: "scheda", label: "Scheda" },
          { value: "storico", label: "Storico" },
          { value: "libreria", label: "Libreria" },
          { value: "programmi", label: "Programmi" },
        ]}
        value={tab}
        onChange={setTab}
      >
        {(activeTab) => (
          <div>
            {activeTab === "scheda" ? renderScheda() : null}

            {activeTab === "storico" ? (
              <HistoryPanel
                authed={authed}
                onOpen={setHistorySessionId}
              />
            ) : null}

            {activeTab === "libreria" ? (
              <LibraryPanel
                exercises={exercises}
                onOpen={setDetailExercise}
                onCreate={() => setCreateExercise(true)}
              />
            ) : null}

            {activeTab === "programmi" ? <ProgramsPanel /> : null}
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
                  ? "em-body-sm em-num grid h-11 w-9 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-ember-tint)] font-semibold text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)] transition-colors duration-[var(--em-dur-tap)]"
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

      {/* La colonna "Peso corp." del foglio (run-07 P4): la pesata del
          giorno si registra QUI, a fine seduta — scrive un BodyEntry. */}
      <FinishWeightField />
    </div>
  );
}

function FinishWeightField() {
  const today = useToday();
  const entry = useBodyDay(today);
  const latest = useLatestBody();
  if (entry === undefined || latest === undefined) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-[var(--em-hairline)] pt-3">
      <p className="em-eyebrow">Peso di oggi</p>
      <WeightQuickEntry
        date={today}
        current={entry}
        fallbackKg={latest?.weight_kg ?? 80}
        compact
      />
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
                ? "em-body-sm h-11 rounded-full bg-[var(--em-ember-tint)] px-3 font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)] transition-colors duration-[var(--em-dur-tap)]"
                : "em-body-sm h-11 rounded-full bg-[var(--em-surface-2)] px-3 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
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

