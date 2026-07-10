/**
 * Sync engine (prompt 08, B3.1/B3.2) — specchio in background del Dexie
 * locale verso Supabase, SOLO per utenti autenticati. Il locale resta la
 * fonte di verità della UI; la rete è asincrona e non blocca mai niente.
 *
 * Un ciclo (`syncNow`) fa, tabella per tabella:
 *   1. PULL: righe remote con server_updated_at >= cursore (con una
 *      finestra di sovrapposizione di 60s: due push concorrenti possono
 *      committare fuori ordine rispetto a now(); ripescare l'orlo è
 *      gratis perché l'apply LWW è idempotente) → apply LWW → avanza il
 *      cursore al massimo server_updated_at visto.
 *   2. PUSH: righe locali con updated_at > cursore (indice updated_at,
 *      ordine crescente), a lotti; il server ha la sua guardia LWW, quindi
 *      un eventuale rimbalzo di righe appena pullate è un no-op contato 0.
 *      Il cursore avanza a fine lotto: un'interruzione riparte da lì.
 *
 * Adozione e merge (B3.2) sono LO STESSO percorso: quando il dispositivo
 * non è ancora collegato all'account (`linked_user_id` diverso), i cursori
 * si azzerano → push completo (i dati ospite diventano dell'account) +
 * pull completo (se l'account ha già dati, merge per UUID + LWW). Il
 * riepilogo "Importati…" conta le righe davvero scritte nei due versi.
 * Il DB locale non viene MAI svuotato qui: diventa la cache sincronizzata.
 *
 * Trigger (`start`): focus/visibilitychange/online, intervallo ~60s,
 * debounce dopo le mutazioni locali (signal.ts). Errori → stato `error`,
 * messaggio in sync_meta (Impostazioni) e retry con backoff esponenziale.
 */

import type { LifeosDb } from "../db";
import { applyRowsLww } from "./apply";
import {
  META_LAST_ERROR,
  META_LAST_SYNC_AT,
  META_LINKED_USER,
  deleteMeta,
  getMeta,
  pullCursorKey,
  pushCursorKey,
  setMeta,
} from "./meta";
import type { RemoteStore } from "./remote";
import { onLocalMutation } from "./signal";
import {
  SYNC_TABLES,
  localTable,
  type LocalTableName,
  type SyncRow,
  type SyncTableSpec,
} from "./tables";

export type SyncStatus = "idle" | "syncing" | "offline" | "error";

export type SyncState = {
  /** true = c'è un engine attivo (utente autenticato). */
  enabled: boolean;
  status: SyncStatus;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type FirstSyncSummary = {
  /**
   * Righe VIVE per tabella a primo sync completato. Dopo un primo ciclo
   * riuscito locale e server coincidono, quindi questo è "quanto c'è ora
   * sull'account" — il numero onesto anche se un tentativo di adozione
   * precedente era morto a metà (B3.2: "confirms nothing was lost").
   */
  byTable: Partial<Record<LocalTableName, number>>;
  total: number;
};

export type SyncEngineOptions = {
  db: LifeosDb;
  remote: RemoteStore;
  /** L'utente autenticato per cui l'engine gira. */
  userId: string;
  onState?: (state: SyncState) => void;
  /** Scatta UNA volta, al completamento del primo sync su questo account. */
  onFirstSync?: (summary: FirstSyncSummary) => void;
  /** Iniettabile nei test; default: navigator.onLine dove esiste. */
  isOnline?: () => boolean;
  now?: () => string;
  intervalMs?: number;
  debounceMs?: number;
};

const PUSH_BATCH = 200;
/** Sovrapposizione del cursore di pull (vedi commento di testa). */
const PULL_OVERLAP_MS = 60_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 300_000;

const ERRORE_SYNC =
  "Non ho potuto sincronizzare. Riprovo da solo tra poco; i dati restano al sicuro su questo dispositivo.";

function defaultIsOnline(): boolean {
  // Solo un `false` esplicito conta come offline: in Node (test) navigator
  // esiste ma onLine è undefined — lì "online" è la risposta giusta.
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function minusMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) - ms).toISOString();
}

export class SyncEngine {
  private readonly db: LifeosDb;
  private readonly remote: RemoteStore;
  private readonly userId: string;
  private readonly onState?: (state: SyncState) => void;
  private readonly onFirstSync?: (summary: FirstSyncSummary) => void;
  private readonly isOnline: () => boolean;
  private readonly now: () => string;
  private readonly intervalMs: number;
  private readonly debounceMs: number;

  private state: SyncState = {
    enabled: true,
    status: "idle",
    lastSyncAt: null,
    lastError: null,
  };
  private running: Promise<void> | null = null;
  private again = false;
  private started = false;
  private stopped = false;
  private errorCount = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private offSignal: (() => void) | null = null;

  constructor(opts: SyncEngineOptions) {
    this.db = opts.db;
    this.remote = opts.remote;
    this.userId = opts.userId;
    this.onState = opts.onState;
    this.onFirstSync = opts.onFirstSync;
    this.isOnline = opts.isOnline ?? defaultIsOnline;
    this.now = opts.now ?? (() => new Date().toISOString());
    this.intervalMs = opts.intervalMs ?? 60_000;
    this.debounceMs = opts.debounceMs ?? 1_500;
  }

  getState(): SyncState {
    return this.state;
  }

  /** Aggancia i trigger e fa subito un primo ciclo. */
  start(): void {
    if (this.started || this.stopped) return;
    this.started = true;
    this.offSignal = onLocalMutation(() => this.nudge());
    if (typeof window !== "undefined") {
      window.addEventListener("focus", this.onWake);
      window.addEventListener("online", this.onWake);
      document.addEventListener("visibilitychange", this.onVisible);
    }
    this.interval = setInterval(() => void this.syncNow(), this.intervalMs);
    void this.syncNow();
  }

  /** Ferma trigger e retry. L'eventuale ciclo in corso finisce da solo. */
  stop(): void {
    this.stopped = true;
    this.started = false;
    this.offSignal?.();
    this.offSignal = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("focus", this.onWake);
      window.removeEventListener("online", this.onWake);
      document.removeEventListener("visibilitychange", this.onVisible);
    }
    if (this.interval) clearInterval(this.interval);
    if (this.debounce) clearTimeout(this.debounce);
    if (this.retry) clearTimeout(this.retry);
    this.interval = this.debounce = this.retry = null;
  }

  /** Richiesta debounced (mutazione locale appena avvenuta). */
  nudge(): void {
    if (this.stopped) return;
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.syncNow(), this.debounceMs);
  }

  /**
   * Un ciclo completo, serializzato: se un ciclo è già in corso la
   * richiesta si accoda (un solo rerun pendente, non una coda infinita).
   */
  syncNow(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = this.runCycle().finally(() => {
      this.running = null;
      if (this.again && !this.stopped) {
        this.again = false;
        void this.syncNow();
      }
    });
    return this.running;
  }

  private onWake = (): void => {
    void this.syncNow();
  };

  private onVisible = (): void => {
    if (document.visibilityState === "visible") void this.syncNow();
  };

  private setState(patch: Partial<SyncState>): void {
    this.state = { ...this.state, ...patch };
    this.onState?.(this.state);
  }

  private async runCycle(): Promise<void> {
    if (this.stopped) return;
    if (!this.isOnline()) {
      this.setState({ status: "offline" });
      return;
    }
    this.setState({ status: "syncing" });
    try {
      const linked = await getMeta(this.db, META_LINKED_USER);
      const firstSync = linked !== this.userId;
      if (firstSync) await this.resetCursors();

      for (const spec of SYNC_TABLES) {
        await this.pullTable(spec);
        await this.pushTable(spec);
      }

      const at = this.now();
      await setMeta(this.db, META_LAST_SYNC_AT, at);
      await deleteMeta(this.db, META_LAST_ERROR);
      if (firstSync) {
        await setMeta(this.db, META_LINKED_USER, this.userId);
        this.onFirstSync?.(await this.summarize());
      }
      this.errorCount = 0;
      this.setState({ status: "idle", lastSyncAt: at, lastError: null });
    } catch {
      this.errorCount += 1;
      await setMeta(this.db, META_LAST_ERROR, ERRORE_SYNC).catch(() => {});
      this.setState({ status: "error", lastError: ERRORE_SYNC });
      this.scheduleRetry();
    }
  }

  /** Azzeramento cursori = prossimo ciclo full push + full pull. */
  private async resetCursors(): Promise<void> {
    for (const spec of SYNC_TABLES) {
      await deleteMeta(this.db, pushCursorKey(spec.local));
      await deleteMeta(this.db, pullCursorKey(spec.local));
    }
  }

  /** Righe vive per tabella dopo il primo ciclo riuscito (riepilogo). */
  private async summarize(): Promise<FirstSyncSummary> {
    const byTable: FirstSyncSummary["byTable"] = {};
    let total = 0;
    for (const spec of SYNC_TABLES) {
      const count = await localTable(this.db, spec)
        .filter((row) => row.deleted_at === null)
        .count();
      byTable[spec.local] = count;
      total += count;
    }
    return { byTable, total };
  }

  /** @returns righe applicate in locale. */
  private async pullTable(spec: SyncTableSpec): Promise<number> {
    const cursor = await getMeta(this.db, pullCursorKey(spec.local));
    const since = cursor === null ? null : minusMs(cursor, PULL_OVERLAP_MS);
    const pulled = await this.remote.pullSince(spec.remote, since);
    if (pulled.length === 0) return 0;

    const outcome = await applyRowsLww(
      this.db,
      spec,
      pulled.map((p) => p.row),
    );
    const maxSeen = pulled[pulled.length - 1].serverUpdatedAt;
    await setMeta(this.db, pullCursorKey(spec.local), maxSeen);
    return outcome.applied;
  }

  /** @returns righe davvero scritte dal server (i rimbalzi contano 0). */
  private async pushTable(spec: SyncTableSpec): Promise<number> {
    const cursor =
      (await getMeta(this.db, pushCursorKey(spec.local))) ?? "";
    const rows = (await localTable(this.db, spec)
      .where("updated_at")
      .above(cursor)
      .toArray()) as SyncRow[];
    if (rows.length === 0) return 0;

    let written = 0;
    for (let i = 0; i < rows.length; i += PUSH_BATCH) {
      const batch = rows.slice(i, i + PUSH_BATCH);
      written += await this.remote.pushUpsert(spec.remote, batch);
      await setMeta(
        this.db,
        pushCursorKey(spec.local),
        batch[batch.length - 1].updated_at,
      );
    }
    return written;
  }

  private scheduleRetry(): void {
    if (!this.started || this.stopped) return;
    if (this.retry) clearTimeout(this.retry);
    const delay = Math.min(
      BACKOFF_BASE_MS * 2 ** (this.errorCount - 1),
      BACKOFF_MAX_MS,
    );
    this.retry = setTimeout(() => void this.syncNow(), delay);
  }
}
