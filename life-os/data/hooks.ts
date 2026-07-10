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
import type { Repos } from "./ports";
import type {
  GymSession,
  IsoDay,
  IsoInstant,
  LocalEvent,
  Reminder,
  Settings,
  Task,
} from "./schemas";
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
