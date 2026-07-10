/**
 * Doppio di test in-memory del RemoteStore — STESSA semantica del server
 * vero (0019): guardia LWW sull'upsert (updated_at strettamente maggiore
 * scrive, il resto è no-op), server_updated_at monotono assegnato qui,
 * pull ordinato per server_updated_at con `since` inclusivo (>=).
 *
 * Usato solo dai test (engine.test.ts): nessun import dall'app.
 * Instrumentato: conta chiamate e righe per verificare cursori e rimbalzi.
 */

import type { PulledRow, RemoteStore } from "./remote";
import type { RemoteTableName, SyncRow } from "./tables";

type StoredRow = { row: SyncRow; serverUpdatedAt: string };

const BASE_MS = Date.parse("2030-01-01T00:00:00.000Z");

export class FakeRemote implements RemoteStore {
  private tables = new Map<RemoteTableName, Map<string, StoredRow>>();
  private tick = 0;

  /** Se valorizzato, ogni chiamata lancia (simula rete giù / errore API). */
  failWith: Error | null = null;

  /** Se valorizzato, fallisce SOLO il push di quella tabella (interruzioni). */
  failPushFor: RemoteTableName | null = null;

  pushCalls: Array<{ table: RemoteTableName; rows: number }> = [];
  pullCalls = 0;
  totalWritten = 0;

  private nextServerInstant(): string {
    this.tick += 1;
    return new Date(BASE_MS + this.tick * 1000).toISOString();
  }

  private tableMap(table: RemoteTableName): Map<string, StoredRow> {
    let m = this.tables.get(table);
    if (!m) {
      m = new Map();
      this.tables.set(table, m);
    }
    return m;
  }

  /** Righe vive sul server (ispezione nei test). */
  rowsOf(table: RemoteTableName): SyncRow[] {
    return [...this.tableMap(table).values()].map((s) => s.row);
  }

  async pushUpsert(table: RemoteTableName, rows: SyncRow[]): Promise<number> {
    if (this.failWith) throw this.failWith;
    if (this.failPushFor === table) throw new Error(`push negato: ${table}`);
    this.pushCalls.push({ table, rows: rows.length });
    const m = this.tableMap(table);
    let written = 0;
    for (const raw of rows) {
      const row = structuredClone(raw);
      const current = m.get(row.id);
      if (current && current.row.updated_at >= row.updated_at) continue;
      m.set(row.id, { row, serverUpdatedAt: this.nextServerInstant() });
      written += 1;
    }
    this.totalWritten += written;
    return written;
  }

  async pullSince(
    table: RemoteTableName,
    since: string | null,
  ): Promise<PulledRow[]> {
    if (this.failWith) throw this.failWith;
    this.pullCalls += 1;
    return [...this.tableMap(table).values()]
      .filter((s) => since === null || s.serverUpdatedAt >= since)
      .sort(
        (a, b) =>
          a.serverUpdatedAt.localeCompare(b.serverUpdatedAt) ||
          a.row.id.localeCompare(b.row.id),
      )
      .map((s) => ({
        row: structuredClone(s.row),
        serverUpdatedAt: s.serverUpdatedAt,
      }));
  }
}
