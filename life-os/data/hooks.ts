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
import { getDb } from "./db";
import { createLocalRepos } from "./local";
import type { Repos } from "./ports";
import type {
  GymSession,
  IsoDay,
  LocalEvent,
  Settings,
  Task,
} from "./schemas";
import type { StreakSummary } from "./streak";

let repos: Repos | null = null;

/**
 * Fascio di repos dell'app (client-only: la prima chiamata istanzia il
 * database). Punto unico da cui — in futuro — uscirà l'adapter synced.
 */
export function appRepos(): Repos {
  if (!repos) repos = createLocalRepos(getDb());
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
