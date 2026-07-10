/**
 * RemindersScheduler (B2.2, B3.4) — l'interfaccia è pronta per il push
 * (prompt 17 fornirà un'implementazione server-driven con la stessa
 * firma); qui la v1 in-app: UN solo interval in foreground che consegna i
 * promemoria scaduti, più un tick immediato al ritorno di visibilità.
 *
 * Onestà del canale: questo scheduler esiste SOLO ad app aperta. La
 * classificazione live/catchup dice al layer UI COME consegnare: "live" =
 * appena scaduto (toast + suono), "catchup" = scaduto mentre eri via
 * (nessun toast a raffica: finisce nella card "Mentre eri via", che legge
 * i promemoria fired-non-dismissed dal port).
 *
 * Anti doppio-scatto: markFired viene chiamato PRIMA della consegna e
 * listPending esclude i fired — un promemoria scatta una volta sola anche
 * con tick ravvicinati. Puro rispetto all'ambiente: clock, interval e
 * repo sono iniettati (testato con fake timers).
 */

export type SchedulerReminder = {
  id: string;
  fire_at: string;
};

export type DeliveryKind = "live" | "catchup";

export type SchedulerDeps<R extends SchedulerReminder> = {
  /** Scaduti mai gestiti (fire_at <= now, né fired né dismissed). */
  listPending: (nowIso: string) => Promise<R[]>;
  /** Timbra il promemoria come scattato; un esito ko esclude la consegna. */
  markFired: (id: string, atIso: string) => Promise<{ ok: boolean }>;
  /** Consegna al layer UI, già classificata. */
  deliver: (reminders: R[], kind: DeliveryKind) => void;
  /** Iniettabili nei test. */
  now?: () => Date;
  /** Passo dell'interval (default 30s). */
  intervalMs?: number;
  /**
   * Età oltre la quale uno scaduto non è più "appena successo" ma
   * "mentre eri via" (default 90s: due tick di margine).
   */
  catchupAfterMs?: number;
  setInterval?: typeof globalThis.setInterval;
  clearInterval?: typeof globalThis.clearInterval;
};

export interface RemindersScheduler {
  /** Avvia l'interval (idempotente) ed esegue subito un tick. */
  start(): void;
  stop(): void;
  /** Un passaggio esplicito: usato da start, dall'interval e dal focus. */
  tick(): Promise<void>;
}

export function createInAppScheduler<R extends SchedulerReminder>(
  deps: SchedulerDeps<R>,
): RemindersScheduler {
  const now = deps.now ?? (() => new Date());
  const intervalMs = deps.intervalMs ?? 30_000;
  const catchupAfterMs = deps.catchupAfterMs ?? 90_000;
  const setIv = deps.setInterval ?? globalThis.setInterval.bind(globalThis);
  const clearIv =
    deps.clearInterval ?? globalThis.clearInterval.bind(globalThis);

  let handle: ReturnType<typeof globalThis.setInterval> | null = null;
  let ticking = false;

  async function tick(): Promise<void> {
    if (ticking) return; // un tick lento non si accavalla col successivo
    ticking = true;
    try {
      const at = now();
      const pending = await deps.listPending(at.toISOString());
      if (pending.length === 0) return;

      const live: R[] = [];
      const catchup: R[] = [];
      for (const reminder of pending) {
        const stamped = await deps.markFired(reminder.id, at.toISOString());
        if (!stamped.ok) continue; // già gestito altrove: niente consegna
        const age = at.getTime() - Date.parse(reminder.fire_at);
        (age <= catchupAfterMs ? live : catchup).push(reminder);
      }
      if (live.length > 0) deps.deliver(live, "live");
      if (catchup.length > 0) deps.deliver(catchup, "catchup");
    } finally {
      ticking = false;
    }
  }

  return {
    start() {
      if (handle !== null) return;
      handle = setIv(() => void tick(), intervalMs);
      void tick();
    },
    stop() {
      if (handle !== null) {
        clearIv(handle);
        handle = null;
      }
    },
    tick,
  };
}
