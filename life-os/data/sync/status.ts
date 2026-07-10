/**
 * Store minimale dello stato sync per la UI (useSyncExternalStore):
 * l'engine pubblica qui via onState, la shell legge il dot, Impostazioni
 * legge la riga quieta. Un modulo-singleton basta: c'è al più UN engine
 * per scheda (SyncHost), e per gli ospiti lo stato resta `disabled`.
 */

import type { SyncState } from "./engine";

const DISABLED: SyncState = {
  enabled: false,
  status: "idle",
  lastSyncAt: null,
  lastError: null,
};

let state: SyncState = DISABLED;
const subscribers = new Set<() => void>();

export function publishSyncState(next: SyncState): void {
  state = next;
  for (const cb of [...subscribers]) cb();
}

export function resetSyncState(): void {
  publishSyncState(DISABLED);
}

export function getSyncState(): SyncState {
  return state;
}

/** Snapshot per il prerender server: sempre lo stato spento. */
export function getServerSyncState(): SyncState {
  return DISABLED;
}

export function subscribeSyncState(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
