"use client";

/**
 * Lo schermo di /gym (B2.3) — quattro tab:
 *   - Allenamento: la sessione di oggi (inizia da zero o da piano,
 *     runner col timer di recupero, concludi con riepilogo volume/durata/
 *     record). Lo stato del timer vive QUI, sopra i Tabs: cambiare tab
 *     non lo azzera (i pannelli si smontano).
 *   - Storico: lista sessioni + strip mensile dei giorni di allenamento
 *     (riusa MonthHeat di /stats); una sessione passata si apre e si
 *     modifica con lo stesso runner (senza timer).
 *   - Libreria: catalogo seminato + custom, scheda con progressi e PR.
 *   - Piani: template ordinati, "inizia da piano".
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
  useExercises,
  useGymSession,
  useGymSessionsByDay,
  useGymSessionsRange,
  usePlans,
} from "@/data/hooks";
import { getDb, hasIndexedDb } from "@/data/db";
import { seedGymExercises } from "@/data/gym-seed";
import type { GymExercise, GymPlan, GymSession } from "@/data/schemas";
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
import { PlanEditorSheet } from "./plan-editor";
import { SessionRunner, type RestState } from "./session-runner";

type FinishSummary = {
  volumeKg: number;
  durationMin: number | null;
  records: NewRecord[];
  exerciseNames: Map<string, string>;
};

export function GymScreen({ authed }: { authed: boolean }) {
  const toast = useToast();
  const today = useToday();
  const todaySessions = useGymSessionsByDay(today);
  const plans = usePlans();
  const exercises = useExercises();

  // Semina idempotente del catalogo al primo uso del modulo.
  useEffect(() => {
    if (hasIndexedDb()) void seedGymExercises(getDb());
  }, []);

  // Timer di recupero sopra i Tabs (i pannelli si smontano).
  const [rest, setRest] = useState<RestState>(null);
  const [finish, setFinish] = useState<FinishSummary | null>(null);
  const [detailExercise, setDetailExercise] = useState<GymExercise | null>(null);
  const [createExercise, setCreateExercise] = useState(false);
  const [editPlan, setEditPlan] = useState<GymPlan | null>(null);
  const [createPlan, setCreatePlan] = useState(false);
  const [historySessionId, setHistorySessionId] = useState<string | null>(null);

  const active =
    (todaySessions ?? []).find((s) => s.finished_at === null) ?? null;
  const doneToday =
    (todaySessions ?? []).find((s) => s.finished_at !== null) ?? null;

  async function startSession(plan?: GymPlan) {
    const r = await appRepos().gym.createSession({
      date: today,
      started_at: new Date().toISOString(),
      ...(plan ? { plan_id: plan.id } : {}),
    });
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
    setRest(null);

    // Riepilogo: volume, durata, record battuti rispetto alla storia.
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
    setFinish({
      volumeKg: totalVolumeKg(sets),
      durationMin: sessionDurationMin(session.started_at, finishedAt),
      records: newRecords(sets, prior),
      exerciseNames: names,
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
          { value: "piani", label: "Piani" },
        ]}
      >
        {(tab) => (
          <div className="pt-4">
            {tab === "oggi" ? (
              loading ? (
                <Skeleton className="h-24 w-full" />
              ) : active ? (
                <SessionRunner
                  session={active}
                  rest={rest}
                  onRest={setRest}
                  live
                  onFinish={() => void finishSession(active)}
                />
              ) : (
                <StartPanel
                  authed={authed}
                  doneToday={doneToday}
                  plans={plans ?? []}
                  onStart={(plan) => void startSession(plan)}
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

            {tab === "piani" ? (
              <PlansPanel
                plans={plans}
                onOpen={setEditPlan}
                onCreate={() => setCreatePlan(true)}
                onStart={(plan) => void startSession(plan)}
                canStart={active === null}
              />
            ) : null}
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
      <PlanEditorSheet
        plan={editPlan}
        createOpen={createPlan}
        onClose={() => {
          setEditPlan(null);
          setCreatePlan(false);
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
        {finish ? (
          <div className="flex flex-col gap-3">
            <dl className="grid grid-cols-2 gap-3">
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
                      {finish.exerciseNames.get(r.exercise_id)} — nuovo massimo
                      di {r.kind}:{" "}
                      <span className="em-num font-semibold">
                        {r.kind === "ripetizioni"
                          ? r.value
                          : formatKg(r.value)}
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
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ── Pannello di partenza ────────────────────────────────────────────── */

function StartPanel({
  authed,
  doneToday,
  plans,
  onStart,
}: {
  authed: boolean;
  doneToday: GymSession | null;
  plans: GymPlan[];
  onStart: (plan?: GymPlan) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {doneToday ? (
        <p className="em-body text-[var(--em-text-2)]">
          Oggi ti sei già allenato. Un&apos;altra sessione? Nessuno ti ferma.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="primary" size="lg" onClick={() => onStart()}>
          Inizia allenamento
        </Button>
        {plans.map((p) => (
          <Button key={p.id} type="button" size="lg" onClick={() => onStart(p)}>
            Da piano: {p.name}
          </Button>
        ))}
      </div>
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

/** Sessione passata: stesso runner, senza timer né concludi. */
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
      {session ? (
        <SessionRunner
          session={session}
          rest={null}
          onRest={() => {}}
          live={false}
        />
      ) : null}
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

/* ── Piani ───────────────────────────────────────────────────────────── */

function PlansPanel({
  plans,
  onOpen,
  onCreate,
  onStart,
  canStart,
}: {
  plans: GymPlan[] | undefined;
  onOpen: (plan: GymPlan) => void;
  onCreate: () => void;
  onStart: (plan: GymPlan) => void;
  canStart: boolean;
}) {
  if (plans === undefined) return <Skeleton className="h-24 w-full" />;
  return (
    <div className="flex flex-col gap-3">
      {plans.length === 0 ? (
        <EmptyState
          compact
          heading="Nessun piano"
          text='Un piano è una scaletta con obiettivi "serie × ripetizioni": crea il primo.'
          action={
            <Button type="button" size="sm" variant="primary" onClick={onCreate}>
              Nuovo piano
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col">
            {plans.map((p) => (
              <li
                key={p.id}
                className="flex min-h-11 items-center gap-3 border-b border-[var(--em-hairline)] py-2.5 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => onOpen(p)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="em-body block truncate text-[var(--em-text)]">
                    {p.name}
                  </span>
                  <span className="em-body-sm text-[var(--em-text-3)]">
                    {p.entries.length}{" "}
                    {p.entries.length === 1 ? "esercizio" : "esercizi"}
                  </span>
                </button>
                {canStart ? (
                  <Button type="button" size="sm" onClick={() => onStart(p)}>
                    Inizia
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" onClick={onCreate}>
            + Nuovo piano
          </Button>
        </>
      )}
    </div>
  );
}
