/**
 * Stato persistente del sync engine — righe chiave/valore in `sync_meta`
 * (Dexie v2). Vive nel DB locale così sopravvive a reload e riavvii:
 *   - cursori per-tabella di push (clock client) e pull (clock server)
 *   - account collegato a questo dispositivo (guardia adozione/merge)
 *   - ultimo sync riuscito / ultimo errore (la riga quieta in Impostazioni)
 */

import type { LifeosDb } from "../db";
import type { LocalTableName } from "./tables";

export const META_LINKED_USER = "linked_user_id";
export const META_LAST_SYNC_AT = "last_sync_at";
export const META_LAST_ERROR = "last_error";

export function pushCursorKey(local: LocalTableName): string {
  return `push_cursor:${local}`;
}

export function pullCursorKey(local: LocalTableName): string {
  return `pull_cursor:${local}`;
}

export async function getMeta(
  db: LifeosDb,
  key: string,
): Promise<string | null> {
  const row = await db.sync_meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(
  db: LifeosDb,
  key: string,
  value: string,
): Promise<void> {
  await db.sync_meta.put({ key, value });
}

export async function deleteMeta(db: LifeosDb, key: string): Promise<void> {
  await db.sync_meta.delete(key);
}
