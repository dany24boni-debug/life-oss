"use client";

/**
 * Store per-dispositivo dello stato del rituale (run-11 P2): una chiave
 * localStorage per giorno (`lifeos.ritual.<YYYY-MM-DD>`), potata alla
 * scrittura come la cache del brief. Store a livello di modulo +
 * `useSyncExternalStore` (idioma pwa-store): niente setState negli
 * effetti, SSR deterministico — lo snapshot server è `undefined`
 * ("non ancora idratato"), così la card non lampeggia mai.
 */

import { useSyncExternalStore } from "react";
import {
  parseRitualDay,
  ritualKey,
  staleRitualKeys,
  type RitualDayState,
} from "./ritual-state";

let cache: { day: string; state: RitualDayState | null } | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function read(day: string): RitualDayState | null {
  if (cache !== null && cache.day === day) return cache.state;
  let state: RitualDayState | null = null;
  try {
    state = parseRitualDay(localStorage.getItem(ritualKey(day)));
  } catch {
    state = null;
  }
  cache = { day, state };
  return state;
}

/**
 * Aggiorna (merge) lo stato del giorno e pota le chiavi degli altri
 * giorni. Storage pieno o negato: lo stato vive comunque in memoria
 * per la sessione — mai un errore all'utente.
 */
export function updateRitualDay(
  day: string,
  patch: Partial<RitualDayState>,
): void {
  const next: RitualDayState = { ...(read(day) ?? {}), ...patch };
  cache = { day, state: next };
  try {
    localStorage.setItem(ritualKey(day), JSON.stringify(next));
    const all: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k !== null) all.push(k);
    }
    for (const k of staleRitualKeys(all, day)) localStorage.removeItem(k);
  } catch {
    // Quota o storage negato: pazienza, lo stato resta in memoria.
  }
  emit();
}

/**
 * Lo stato del rituale di `day`: `undefined` finché non siamo idratati
 * (il server non conosce localStorage), poi `null` (giorno vergine) o
 * lo stato salvato.
 */
export function useRitualDay(day: string): RitualDayState | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => read(day),
    () => undefined,
  );
}
