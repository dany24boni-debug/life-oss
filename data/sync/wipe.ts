/**
 * "Svuota questo dispositivo" (B3.2) — l'unico punto del codice che cancella
 * dati locali in blocco, e SOLO su scelta esplicita dell'utente nel modal
 * di uscita. Ferma prima l'engine (altrimenti un ciclo in corsa
 * ripopolerebbe dal pull), poi svuota ogni tabella E sync_meta: il
 * dispositivo torna vergine, scollegato da qualsiasi account.
 */

import type { LifeosDb } from "../db";
import { getCurrentEngine, setCurrentEngine } from "./runtime";

export async function wipeLocalDevice(db: LifeosDb): Promise<void> {
  getCurrentEngine()?.stop();
  setCurrentEngine(null);
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}
