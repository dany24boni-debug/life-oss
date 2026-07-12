"use client";

/**
 * Hook live-query per le UI client (blueprint B3.1: le UI leggono i port
 * tramite un sottile strato di hook).
 *
 * Meccanismo scelto: `dexie-react-hooks` (useLiveQuery). Verificato prima
 * dell'adozione: il pacchetto è SSR-safe (la valutazione sincrona è dietro
 * `typeof window !== "undefined"` e la sottoscrizione vive in useEffect,
 * che sul server non gira), i peer coprono React 19 (react >=16) ed è
 * versionato in lockstep con Dexie 4. Durante il prerender server di un
 * client component gli hook restituiscono `undefined` — lo stato "sto
 * caricando" che le UI rendono come skeleton.
 *
 * Gli hook parlano coi PORT (localRepos), non con Dexie: quando il prompt
 * 08 introdurrà l'adapter synced, il cambio avverrà qui dentro senza
 * toccare le UI. liveQuery traccia le letture Dexie anche attraverso lo
 * strato repo, quindi la reattività è preservata.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { useSyncExternalStore } from "react";
import { getDb } from "./db";
import { createLocalRepos } from "./local";
import type { HabitBoardEntry, Repos } from "./ports";
import type {
  BodyEntry,
  EveningCheckin,
  Exam,
  Expense,
  GymExercise,
  GymPlan,
  GymProgram,
  GymProgramDay,
  GymProgramSlot,
  GymSession,
  GymSet,
  Habit,
  HabitLog,
  IsoDay,
  IsoInstant,
  LocalEvent,
  MuscleGroup,
  PlanSlot,
  Reminder,
  Settings,
  Task,
  WeekPlan,
} from "./schemas";
import type { IsoWeek, WeekBoardDay, WeekStats } from "./planner";
import type { StreakSummary } from "./streak";
import type { SyncState } from "./sync/engine";
import { META_LAST_ERROR, META_LAST_SYNC_AT, getMeta } from "./sync/meta";
import { withMutationSignal } from "./sync/signal";
import {
  getServerSyncState,
  getSyncState,
  subscribeSyncState,
} from "./sync/status";

let repos: Repos | null = null;

/**
 * Fascio di repos dell'app (client-only: la prima chiamata istanzia il
 * database). Punto unico dello swap previsto da B3.1: da run-04 il fascio
 * locale è decorato dal segnale di mutazione — ogni scrittura riuscita
 * sveglia (debounced) il sync engine, quando c'è. La UI non se ne accorge.
 */
export function appRepos(): Repos {
  if (!repos) repos = withMutationSignal(createLocalRepos(getDb()));
  return repos;
}

/** Task del giorno (aperti e fatti), ordinati per sort_order. */
export function useTasks(day: IsoDay): Task[] | undefined {
  return useLiveQuery(() => appRepos().tasks.listByDay(day), [day]);
}

/** Singolo task per id (scheda dettaglio); null se assente o tombstone. */
export function useTask(id: string | null): Task | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().tasks.getById(id) : Promise.resolve(null)),
    [id],
  );
}

/**
 * Archivio Fatti, più recenti prima. La paginazione UI è "carica altri":
 * il chiamante alza `limit` e la live query si riesegue.
 */
export function useDoneTasks(limit: number): Task[] | undefined {
  return useLiveQuery(() => appRepos().tasks.listDone({ limit }), [limit]);
}

/** Task aperti in ritardo rispetto a `today`. */
export function useOverdueTasks(today: IsoDay): Task[] | undefined {
  return useLiveQuery(() => appRepos().tasks.listOverdue(today), [today]);
}

/** Inbox: task senza data. */
export function useInboxTasks(): Task[] | undefined {
  return useLiveQuery(() => appRepos().tasks.listInbox(), []);
}

/** Task nel range di giorni (vista Prossimi). */
export function useUpcomingTasks(
  from: IsoDay,
  to: IsoDay,
): Task[] | undefined {
  return useLiveQuery(() => appRepos().tasks.listUpcoming(from, to), [from, to]);
}

/** Eventi locali nel range di giorni. */
export function useEventsRange(
  from: IsoDay,
  to: IsoDay,
): LocalEvent[] | undefined {
  return useLiveQuery(
    () => appRepos().events.listRange(from, to),
    [from, to],
  );
}

/** Singolo evento per id (scheda dettaglio); null se assente o tombstone. */
export function useEvent(id: string | null): LocalEvent | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().events.getById(id) : Promise.resolve(null)),
    [id],
  );
}

/** Tutti gli esami vivi, per data crescente (run-05 prompt 3). */
export function useEsami(): Exam[] | undefined {
  return useLiveQuery(() => appRepos().esami.listAll(), []);
}

/** Spese vive del mese "YYYY-MM", giorno decrescente (run-05 prompt 4). */
export function useSpeseMonth(month: string): Expense[] | undefined {
  return useLiveQuery(() => appRepos().spese.listMonth(month), [month]);
}

/** Singola spesa per id (scheda dettaglio); null se assente o tombstone. */
export function useExpense(id: string | null): Expense | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().spese.getById(id) : Promise.resolve(null)),
    [id],
  );
}

/** Check-in del giorno (run-05 prompt 5); null se non ancora scritto. */
export function useCheckin(date: IsoDay): EveningCheckin | null | undefined {
  return useLiveQuery(async () => {
    const row = await appRepos().sera.getByDay(date);
    return row ?? null;
  }, [date]);
}

/** Storico check-in prima di `before`, dal più recente, al massimo limit. */
export function useCheckinHistory(
  before: IsoDay,
  limit: number,
): EveningCheckin[] | undefined {
  return useLiveQuery(
    () => appRepos().sera.listRecent(before, limit),
    [before, limit],
  );
}

/* ── Corpo (run-07 prompt 4) ─────────────────────────────────────────── */

/** La pesata del giorno; null se non registrata. */
export function useBodyDay(date: IsoDay): BodyEntry | null | undefined {
  return useLiveQuery(async () => {
    const row = await appRepos().body.getByDay(date);
    return row ?? null;
  }, [date]);
}

/** L'ultima pesata viva; null senza dati. */
export function useLatestBody(): BodyEntry | null | undefined {
  return useLiveQuery(() => appRepos().body.latest(), []);
}

/** Pesate nel range, per giorno crescente (grafico del trend). */
export function useBodyRange(
  from: IsoDay,
  to: IsoDay,
): BodyEntry[] | undefined {
  return useLiveQuery(() => appRepos().body.listRange(from, to), [from, to]);
}

/** Storico pesate fino a `before` incluso, dalla più recente. */
export function useBodyRecent(
  before: IsoDay,
  limit: number,
): BodyEntry[] | undefined {
  return useLiveQuery(
    () => appRepos().body.listRecent(before, limit),
    [before, limit],
  );
}

/* ── Abitudini (run-08 prompt 1) ─────────────────────────────────────── */

/** Abitudini vive per sort_order; archiviate incluse solo su richiesta. */
export function useHabits(includeArchived?: boolean): Habit[] | undefined {
  return useLiveQuery(
    () => appRepos().habits.listAll(includeArchived ? { includeArchived: true } : undefined),
    [includeArchived],
  );
}

/** Singola abitudine per id; null se assente o tombstone. */
export function useHabit(id: string | null): Habit | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().habits.getById(id) : Promise.resolve(null)),
    [id],
  );
}

/** La board del giorno: abitudini previste + log + obiettivo effettivo. */
export function useHabitBoard(date: IsoDay): HabitBoardEntry[] | undefined {
  return useLiveQuery(() => appRepos().habits.dayBoard(date), [date]);
}

/** Log vivi dell'abitudine nel range (month heat della scheda). */
export function useHabitLogsRange(
  habitId: string | null,
  from: IsoDay,
  to: IsoDay,
): HabitLog[] | undefined {
  return useLiveQuery(
    () =>
      habitId
        ? appRepos().habits.listLogsRange(habitId, from, to)
        : Promise.resolve([]),
    [habitId, from, to],
  );
}

/** Streak per-abitudine (giorni protetti e non previsti fanno ponte). */
export function useHabitStreak(
  habitId: string | null,
  today: IsoDay,
): StreakSummary | undefined {
  return useLiveQuery(
    () =>
      habitId
        ? appRepos().habits.habitStreak(habitId, { today })
        : Promise.resolve({ current: 0, best: 0, todayCounts: false }),
    [habitId, today],
  );
}

/* ── Planner settimanale (run-08 prompt 3) ───────────────────────────── */

/** Piani vivi: l'attivo per primo, poi per nome. */
export function useWeekPlans(): WeekPlan[] | undefined {
  return useLiveQuery(() => appRepos().planner.listPlans(), []);
}

/** Il piano attivo (al più uno); null se nessuno. */
export function useActiveWeekPlan(): WeekPlan | null | undefined {
  return useLiveQuery(() => appRepos().planner.activePlan(), []);
}

/** Slot vivi del piano (weekday, orario, sort_order). */
export function usePlanSlots(planId: string | null): PlanSlot[] | undefined {
  return useLiveQuery(
    () =>
      planId ? appRepos().planner.listSlots(planId) : Promise.resolve([]),
    [planId],
  );
}

/** La board lun->dom della settimana ISO data (slot + check). */
export function useWeekBoard(
  planId: string | null,
  isoWeek: IsoWeek,
): WeekBoardDay[] | undefined {
  return useLiveQuery(
    () =>
      planId
        ? appRepos().planner.weekBoard(planId, isoWeek)
        : Promise.resolve([]),
    [planId, isoWeek],
  );
}

/** Statistiche delle ultime N settimane (completamento + più saltati). */
export function useWeekStats(
  planId: string | null,
  lastNWeeks: number,
  currentWeek: IsoWeek,
): WeekStats | undefined {
  return useLiveQuery(
    () =>
      planId
        ? appRepos().planner.weekStats(planId, lastNWeeks, currentWeek)
        : Promise.resolve({ weeks: [], mostSkipped: [] }),
    [planId, lastNWeeks, currentWeek],
  );
}

/** Singolo esame per id (scheda dettaglio); null se assente o tombstone. */
export function useExam(id: string | null): Exam | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().esami.getById(id) : Promise.resolve(null)),
    [id],
  );
}

/** Sessioni gym nel range di giorni. */
export function useGymSessionsRange(
  from: IsoDay,
  to: IsoDay,
): GymSession[] | undefined {
  return useLiveQuery(
    () => appRepos().gym.listSessionsRange(from, to),
    [from, to],
  );
}

/* ── Gym (B2.3, run-04 prompt 10) ────────────────────────────────────── */

/** Libreria esercizi ordinata per nome; filtro gruppo opzionale. */
export function useExercises(group?: MuscleGroup): GymExercise[] | undefined {
  return useLiveQuery(
    () => appRepos().gym.listExercises(group ? { group } : undefined),
    [group],
  );
}

/** Piani ordinati per nome. */
export function usePlans(): GymPlan[] | undefined {
  return useLiveQuery(() => appRepos().gym.listPlans(), []);
}

/* ── Programmi (run-07) ──────────────────────────────────────────────── */

/** Programmi vivi: l'attivo per primo, poi per nome. */
export function usePrograms(): GymProgram[] | undefined {
  return useLiveQuery(() => appRepos().gym.listPrograms(), []);
}

/** Il programma attivo (al più uno); null se nessuno. */
export function useActiveProgram(): GymProgram | null | undefined {
  return useLiveQuery(() => appRepos().gym.activeProgram(), []);
}

/** Giorni vivi del programma, per sort_order. */
export function useProgramDays(
  programId: string | null,
): GymProgramDay[] | undefined {
  return useLiveQuery(
    () =>
      programId
        ? appRepos().gym.listProgramDays(programId)
        : Promise.resolve([]),
    [programId],
  );
}

/** Slot vivi del giorno, per sort_order (le righe della tabella-foglio). */
export function useProgramSlots(
  dayId: string | null,
): GymProgramSlot[] | undefined {
  return useLiveQuery(
    () =>
      dayId ? appRepos().gym.listProgramSlots(dayId) : Promise.resolve([]),
    [dayId],
  );
}

/** Singolo giorno di programma; null se assente o tombstone. */
export function useProgramDay(
  id: string | null,
): GymProgramDay | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().gym.getProgramDayById(id) : Promise.resolve(null)),
    [id],
  );
}

/** Il prossimo giorno del programma attivo (rotazione last-done). */
export function useNextUpDay(): GymProgramDay | null | undefined {
  return useLiveQuery(() => appRepos().gym.nextUpDay(), []);
}

/** Sessioni nate da un giorno di programma, più recenti prima. */
export function useSessionsByProgramDay(
  dayId: string | null,
): GymSession[] | undefined {
  return useLiveQuery(
    () =>
      dayId
        ? appRepos().gym.listSessionsByProgramDay(dayId)
        : Promise.resolve([]),
    [dayId],
  );
}

/** I giorni del programma attivo, ognuno coi suoi slot (per sort_order). */
export function useActiveProgramSlots():
  | Array<{ day: GymProgramDay; slots: GymProgramSlot[] }>
  | undefined {
  return useLiveQuery(async () => {
    const gym = appRepos().gym;
    const program = await gym.activeProgram();
    if (!program) return [];
    const days = await gym.listProgramDays(program.id);
    return Promise.all(
      days.map(async (day) => ({
        day,
        slots: await gym.listProgramSlots(day.id),
      })),
    );
  }, []);
}

/** Sessioni del giorno (di solito zero o una). */
export function useGymSessionsByDay(day: IsoDay): GymSession[] | undefined {
  return useLiveQuery(() => appRepos().gym.listSessionsByDay(day), [day]);
}

/** Singola sessione per id; null se assente o tombstone. */
export function useGymSession(
  id: string | null,
): GymSession | null | undefined {
  return useLiveQuery(
    () => (id ? appRepos().gym.getSessionById(id) : Promise.resolve(null)),
    [id],
  );
}

/** Set della sessione, ordinati per esercizio e numero. */
export function useSetsBySession(
  sessionId: string | null,
): GymSet[] | undefined {
  return useLiveQuery(
    () =>
      sessionId
        ? appRepos().gym.listSetsBySession(sessionId)
        : Promise.resolve([]),
    [sessionId],
  );
}

/** Storico set per esercizio, più recenti prima (PR, sparkline). */
export function useSetsByExercise(
  exerciseId: string | null,
  limit?: number,
): GymSet[] | undefined {
  return useLiveQuery(
    () =>
      exerciseId
        ? appRepos().gym.listSetsByExercise(
            exerciseId,
            limit !== undefined ? { limit } : undefined,
          )
        : Promise.resolve([]),
    [exerciseId, limit],
  );
}

/** Sessioni e volume nel range (tile di Oggi, frame di /stats). */
export function useGymVolume(
  from: IsoDay,
  to: IsoDay,
): { sessions: number; totalVolumeKg: number } | undefined {
  return useLiveQuery(
    () => appRepos().stats.gymVolumeInRange(from, to),
    [from, to],
  );
}

/** Impostazioni locali (default mai-persistiti se la riga non esiste). */
export function useSettings(): Settings | undefined {
  return useLiveQuery(() => appRepos().settings.get(), []);
}

/* ── Stats (B2.5, run-03): tile e schermata Statistiche ─────────────── */

/** Conteggio task del giorno per il tile "oggi". */
export function useTasksSummary(
  day: IsoDay,
): { total: number; done: number } | undefined {
  return useLiveQuery(() => appRepos().stats.tasksSummary(day), [day]);
}

/** Completamento per giorno nel range (barre settimanali). */
export function useCompletionByDay(
  from: IsoDay,
  to: IsoDay,
): Array<{ date: IsoDay; total: number; done: number }> | undefined {
  return useLiveQuery(
    () => appRepos().stats.completionByDay(from, to),
    [from, to],
  );
}

/** Streak con giorni protetti; si aggiorna con task, gym e impostazioni. */
export function useStreak(
  today: IsoDay,
  timeZone: string,
): StreakSummary | undefined {
  return useLiveQuery(
    () => appRepos().stats.streak({ today, timeZone }),
    [today, timeZone],
  );
}

/** Giorni attivi nel range (strip mensile della schermata Statistiche). */
export function useActivityDays(
  from: IsoDay,
  to: IsoDay,
  timeZone: string,
): IsoDay[] | undefined {
  return useLiveQuery(
    () => appRepos().stats.activityDays(from, to, timeZone),
    [from, to, timeZone],
  );
}

/* ── Reminders (B2.2, run-03): scheduler in-app e superfici di Oggi ──── */

/** Promemoria + task risolto (titolo per toast, card e rail). */
export type ReminderWithTask = { reminder: Reminder; task: Task | null };

async function withTasks(reminders: Reminder[]): Promise<ReminderWithTask[]> {
  const repos = appRepos();
  return Promise.all(
    reminders.map(async (reminder) => ({
      reminder,
      task:
        reminder.kind === "task"
          ? await repos.tasks.getById(reminder.ref_id)
          : null,
    })),
  );
}

/** Il promemoria del task (v1: al più uno), per la scheda dettaglio. */
export function useTaskReminder(
  taskId: string | null,
): Reminder | null | undefined {
  return useLiveQuery(async () => {
    if (!taskId) return null;
    const rows = await appRepos().reminders.listByRef(taskId);
    return rows[0] ?? null;
  }, [taskId]);
}

/** Scattati e mai riconosciuti: card "Mentre eri via" + badge. */
export function useFiredReminders(): ReminderWithTask[] | undefined {
  return useLiveQuery(
    () => appRepos().reminders.listFiredUndismissed().then(withTasks),
    [],
  );
}

/** In arrivo nel range di istanti (rail "Prossimi" di Oggi). */
export function useUpcomingReminders(
  from: IsoInstant,
  to: IsoInstant,
): ReminderWithTask[] | undefined {
  return useLiveQuery(
    () => appRepos().reminders.listUpcoming(from, to).then(withTasks),
    [from, to],
  );
}

/* ── Sync (prompt 08, run-04): dot della shell e riga in Impostazioni ── */

/** Stato vivo dell'engine (guest: enabled=false). SSR: stato spento. */
export function useSyncStatus(): SyncState {
  return useSyncExternalStore(
    subscribeSyncState,
    getSyncState,
    getServerSyncState,
  );
}

/**
 * Ultimo sync riuscito / ultimo errore, LETTI DA sync_meta: durevoli,
 * quindi giusti anche appena riaperta l'app (l'engine non ha ancora
 * girato) o da ospiti (entrambi null).
 */
export function useSyncInfo():
  | { lastSyncAt: string | null; lastError: string | null }
  | undefined {
  return useLiveQuery(async () => {
    const db = getDb();
    const [lastSyncAt, lastError] = await Promise.all([
      getMeta(db, META_LAST_SYNC_AT),
      getMeta(db, META_LAST_ERROR),
    ]);
    return { lastSyncAt, lastError };
  }, []);
}
