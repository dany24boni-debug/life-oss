/**
 * RemoteStore — il contratto minimo che il sync engine chiede al remoto
 * (prompt 08). Due sole operazioni, entrambe "row mirror":
 *
 *   - `pushUpsert`: upsert di righe intere con GUARDIA LWW lato server
 *     (una riga con updated_at non più nuovo di quella remota non scrive
 *     nulla). Ritorna quante righe sono state davvero scritte — è il numero
 *     che alimenta il riepilogo della prima sincronizzazione.
 *   - `pullSince`: le righe con server_updated_at >= since (null = tutte),
 *     ordinate per server_updated_at crescente. `since` è sul CLOCK DEL
 *     SERVER, non su updated_at: un cursore sul clock client perderebbe le
 *     righe pushate in ritardo da un dispositivo rimasto offline.
 *
 * Implementazioni: `remote-supabase.ts` (vera, RLS per-utente) e
 * `fake-remote.ts` (doppio di test in-memory con la stessa semantica).
 */

import type { RemoteTableName, SyncRow } from "./tables";

export type PulledRow = {
  /** Riga così com'era stata pushata (senza user_id/server_updated_at). */
  row: unknown;
  /** Istante ISO (forma "Z") del clock server: avanza il cursore di pull. */
  serverUpdatedAt: string;
};

export interface RemoteStore {
  pushUpsert(table: RemoteTableName, rows: SyncRow[]): Promise<number>;
  pullSince(
    table: RemoteTableName,
    since: string | null,
  ): Promise<PulledRow[]>;
}
