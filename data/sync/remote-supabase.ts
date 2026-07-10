/**
 * RemoteStore su Supabase (prompt 08). Il partner server è la migrazione
 * 0019: tabelle lo_* con RLS per-utente, trigger server_updated_at e la
 * RPC lo_push (upsert con guardia LWW atomica).
 *
 *   - push: una chiamata RPC per lotto; il ritorno è il numero di righe
 *     davvero scritte (insert + update vinti; i rimbalzi valgono 0).
 *   - pull: SELECT paginata su (user_id, server_updated_at) — l'RLS
 *     restringe all'utente della sessione, qui non serve filtrare.
 *
 * Normalizzazione al confine (unico posto che sa di PostgREST):
 *   - via `user_id` e `server_updated_at` dalla riga (non esistono negli
 *     schemi locali; il secondo torna a parte come cursore);
 *   - i timestamptz tornano come "…+00:00": le colonne istante vengono
 *     riportate alla forma "…Z" di Date.toISOString(), che è ciò che gli
 *     schemi zod accettano e su cui il confronto LWW per stringa è sano.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PulledRow, RemoteStore } from "./remote";
import { specByRemote, type RemoteTableName, type SyncRow } from "./tables";

const PAGE = 500;

function toIsoZ(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? value : new Date(ms).toISOString();
}

function normalizePulled(
  table: RemoteTableName,
  raw: Record<string, unknown>,
): PulledRow {
  const spec = specByRemote(table);
  const row: Record<string, unknown> = { ...raw };
  delete row.user_id;
  const serverUpdatedAt = toIsoZ(raw.server_updated_at) as string;
  delete row.server_updated_at;
  for (const col of spec?.instantColumns ?? []) {
    if (row[col] != null) row[col] = toIsoZ(row[col]);
  }
  return { row, serverUpdatedAt };
}

export class SupabaseRemote implements RemoteStore {
  constructor(private readonly client: SupabaseClient) {}

  async pushUpsert(table: RemoteTableName, rows: SyncRow[]): Promise<number> {
    if (rows.length === 0) return 0;
    const { data, error } = await this.client.rpc("lo_push", {
      p_table: table,
      p_rows: rows,
    });
    if (error) throw new Error(`lo_push ${table}: ${error.message}`);
    return typeof data === "number" ? data : 0;
  }

  async pullSince(
    table: RemoteTableName,
    since: string | null,
  ): Promise<PulledRow[]> {
    const out: PulledRow[] = [];
    for (let offset = 0; ; offset += PAGE) {
      let query = this.client
        .from(table)
        .select("*")
        .order("server_updated_at", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + PAGE - 1);
      if (since !== null) query = query.gte("server_updated_at", since);
      const { data, error } = await query;
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      const rows = (data ?? []) as Record<string, unknown>[];
      for (const raw of rows) out.push(normalizePulled(table, raw));
      if (rows.length < PAGE) break;
    }
    return out;
  }
}
