"use client";

/**
 * SyncHost (prompt 08) — il ciclo di vita del sync engine, montato una
 * volta nel layout della shell come RemindersHost. Non rende nulla.
 *
 *   - utente autenticato → crea l'engine (Dexie locale + RemoteStore
 *     Supabase) e lo avvia; lo stato fluisce nello store letto dal dot
 *     della shell e da Impostazioni.
 *   - ospite / sign-out → nessun engine, stato spento. I dati locali NON
 *     si toccano qui: restano o si svuotano solo dal modal di uscita.
 *   - primo sync di un account su questo dispositivo (adozione o merge,
 *     B3.2) → toast "Importati…" con i conteggi reali.
 */

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDb, hasIndexedDb } from "@/data/db";
import { SyncEngine, type FirstSyncSummary } from "@/data/sync/engine";
import { SupabaseRemote } from "@/data/sync/remote-supabase";
import { publishSyncState, resetSyncState } from "@/data/sync/status";
import { setCurrentEngine } from "@/data/sync/runtime";
import { useToast } from "@/ui";

const TABLE_LABELS: Array<{ key: keyof FirstSyncSummary["byTable"]; label: string }> = [
  { key: "tasks", label: "task" },
  { key: "events", label: "eventi" },
  { key: "gym_sessions", label: "allenamenti" },
  { key: "gym_sets", label: "serie" },
  { key: "gym_exercises", label: "esercizi" },
  { key: "gym_plans", label: "piani" },
  { key: "reminders", label: "promemoria" },
];

function firstSyncMessage(summary: FirstSyncSummary): string {
  const parts = TABLE_LABELS.filter(({ key }) => (summary.byTable[key] ?? 0) > 0)
    .map(({ key, label }) => `${summary.byTable[key]} ${label}`);
  if (parts.length === 0) return "Sincronizzazione attiva su questo account.";
  return `Importati: ${parts.join(", ")}. Tutto sincronizzato.`;
}

export function SyncHost() {
  // `show` è stabile (useCallback in ToastProvider): l'effetto gira una volta.
  const { show } = useToast();

  useEffect(() => {
    if (!hasIndexedDb()) return;
    const supabase = createClient();
    let engine: SyncEngine | null = null;
    let currentUserId: string | null = null;
    let disposed = false;

    const boot = (userId: string | null) => {
      if (disposed || userId === currentUserId) return;
      currentUserId = userId;
      engine?.stop();
      engine = null;
      setCurrentEngine(null);
      resetSyncState();
      if (!userId) return;
      engine = new SyncEngine({
        db: getDb(),
        remote: new SupabaseRemote(supabase),
        userId,
        onState: publishSyncState,
        onFirstSync: (summary) => {
          show({
            message: firstSyncMessage(summary),
            tone: "success",
            durationMs: 8000,
          });
        },
      });
      setCurrentEngine(engine);
      engine.start();
    };

    void supabase.auth
      .getSession()
      .then(({ data }) => boot(data.session?.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) =>
      boot(session?.user?.id ?? null),
    );

    return () => {
      disposed = true;
      sub.subscription.unsubscribe();
      engine?.stop();
      setCurrentEngine(null);
      resetSyncState();
    };
  }, [show]);

  return null;
}
