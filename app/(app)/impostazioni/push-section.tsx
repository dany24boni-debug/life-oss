"use client";

/**
 * Card "Notifiche push" (run-09 prompt 5, blueprint 17) — solo con
 * account. Onestà prima di tutto:
 *   - senza NEXT_PUBLIC_VAPID_PUBLIC_KEY la card dice "non ancora
 *     attivo su questo server" e NON mostra mai un bottone rotto;
 *   - su iOS serve la PWA installata (requisito di piattaforma,
 *     dichiarato in copy);
 *   - il permesso si chiede SOLO al gesto di attivazione, mai al mount.
 * Le categorie sono per-dispositivo; disattivare tutto cancella anche
 * la riga server (mai endpoint orfani).
 */

import { useEffect, useState } from "react";
import { Button, Skeleton, Switch, useToast } from "@/ui";
import {
  DEFAULT_PUSH_CATEGORIES,
  PUSH_CATEGORY_LABELS,
  subscriptionPayload,
  urlBase64ToUint8Array,
  type PushCategories,
} from "@/data/push";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type PushState =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "no_server_key" }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; categories: PushCategories };

export function PushSection() {
  const toast = useToast();
  const [state, setState] = useState<PushState>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  // Stato al mount: capacità del browser, permesso, subscription viva
  // e categorie salvate sul server. Tutto in effetto asincrono (mai
  // setState sincroni), tutto senza chiedere permessi.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await readPushState();
      if (!cancelled) setState(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function activate() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ kind: "denied" });
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            VAPID_PUBLIC_KEY,
          ) as BufferSource,
        }));
      const saved = await saveCategories(
        subscription,
        DEFAULT_PUSH_CATEGORIES,
      );
      if (saved) {
        setState({ kind: "on", categories: DEFAULT_PUSH_CATEGORIES });
      } else {
        toast.show({
          message:
            "Il server non ha ancora le notifiche attive (vedi la checklist di attivazione).",
          tone: "error",
        });
      }
    } catch {
      toast.show({
        message: "Non sono riuscito ad attivare le notifiche su questo dispositivo.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        }).catch(() => {});
        await subscription.unsubscribe();
      }
      setState({ kind: "off" });
    } catch {
      toast.show({ message: "Non sono riuscito a disattivare.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggleCategory(key: keyof PushCategories, on: boolean) {
    if (state.kind !== "on") return;
    const next = { ...state.categories, [key]: on };
    setState({ kind: "on", categories: next });
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const saved = await saveCategories(subscription, next);
    if (!saved) {
      toast.show({ message: "Preferenza non salvata. Riprova.", tone: "error" });
    }
  }

  return (
    <section aria-label="Notifiche push" className="em-card p-5">
      <p className="em-eyebrow">Notifiche push</p>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Notifiche vere anche ad app chiusa, su questo dispositivo. Serve un
        account; su iPhone serve LifeOS installata come app (Condividi,
        &ldquo;Aggiungi alla schermata Home&rdquo;).
      </p>

      {/* Skeleton invece del pop-in (run-10 P4, PROP-imp-01). */}
      {state.kind === "loading" ? (
        <div className="mt-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : state.kind === "unsupported" ? (
        <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
          Questo browser non supporta le notifiche push.
        </p>
      ) : state.kind === "no_server_key" ? (
        <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
          Non ancora attivo su questo server: manca la chiave di push
          (l&apos;attivazione è documentata nella checklist del progetto).
        </p>
      ) : state.kind === "denied" ? (
        <p className="em-body-sm mt-3 text-[var(--em-text-3)]">
          Le notifiche sono bloccate nelle impostazioni del browser per
          questo sito: sbloccale da lì, poi riprova.
        </p>
      ) : state.kind === "off" ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => void activate()}
          >
            Attiva su questo dispositivo
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {PUSH_CATEGORY_LABELS.map((c) => (
            <Switch
              key={c.key}
              label={c.label}
              description={c.desc}
              checked={state.categories[c.key]}
              disabled={busy}
              onChange={(on) => void toggleCategory(c.key, on)}
            />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            disabled={busy}
            onClick={() => void deactivate()}
          >
            Disattiva su questo dispositivo
          </Button>
        </div>
      )}
    </section>
  );
}

/** Lo stato reale del dispositivo, senza chiedere niente a nessuno. */
async function readPushState(): Promise<PushState> {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return { kind: "unsupported" };
  }
  if (VAPID_PUBLIC_KEY === "") return { kind: "no_server_key" };
  if (Notification.permission === "denied") return { kind: "denied" };
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return { kind: "off" };
    const r = await fetch(
      `/api/push/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`,
    );
    if (!r.ok) return { kind: "off" };
    const data = (await r.json()) as {
      subscribed?: boolean;
      categories?: PushCategories | null;
    };
    if (!data.subscribed || !data.categories) return { kind: "off" };
    return { kind: "on", categories: data.categories };
  } catch {
    return { kind: "off" };
  }
}

/** Upsert della riga server; false = server non pronto (copy onesta). */
async function saveCategories(
  subscription: PushSubscription,
  categories: PushCategories,
): Promise<boolean> {
  const payload = subscriptionPayload(subscription.toJSON(), categories);
  if (!payload) return false;
  try {
    const r = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}
