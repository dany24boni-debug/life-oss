/**
 * Registro dell'engine attivo nella scheda. Serve a chi deve fermarlo da
 * fuori dal ciclo di vita di SyncHost — il caso concreto è "Svuota questo
 * dispositivo" in Impostazioni: prima si ferma l'engine, POI si svuota il
 * Dexie, altrimenti un ciclo in corsa ripopolerebbe le tabelle dal pull.
 */

import type { SyncEngine } from "./engine";

let current: SyncEngine | null = null;

export function setCurrentEngine(engine: SyncEngine | null): void {
  current = engine;
}

export function getCurrentEngine(): SyncEngine | null {
  return current;
}
