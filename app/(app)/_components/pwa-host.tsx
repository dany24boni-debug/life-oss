"use client";

/**
 * PwaHost (run-05 prompt 2, stub 13) — vive nel layout della shell:
 *
 *   - registra /sw.js SOLO nei build di produzione (dev intatto), scope /;
 *   - flusso di aggiornamento update-safe: nuovo SW in waiting → toast
 *     Ember "Nuova versione disponibile — Aggiorna" → SKIP_WAITING →
 *     controllerchange → reload. Il reload scatta SOLO nella tab che ha
 *     chiesto l'aggiornamento (flag): mai ricaricare sotto i piedi.
 *   - controlla gli aggiornamenti a ogni ritorno in foreground
 *     (visibilitychange), oltre al check nativo per-navigazione;
 *   - cattura beforeinstallprompt / appinstalled per l'install UX;
 *   - incrementa il contatore visite per la card gentile su Oggi.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/ui";
import {
  markInstalled,
  setDeferredPrompt,
  type BeforeInstallPromptEvent,
} from "./pwa-store";
import { parseVisits, PWA_VISITS_KEY } from "./pwa-logic";

export function PwaHost() {
  const toast = useToast();
  const toastShownRef = useRef(false);

  // Install UX + contatore visite: anche in dev (nessun effetto rete).
  useEffect(() => {
    try {
      const visits = parseVisits(window.localStorage.getItem(PWA_VISITS_KEY));
      window.localStorage.setItem(PWA_VISITS_KEY, String(visits + 1));
    } catch {
      // localStorage pieno o negato: la card semplicemente non comparirà.
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => markInstalled();
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Service worker: solo produzione.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let wantsReload = false;

    const showUpdateToast = (waiting: ServiceWorker) => {
      if (toastShownRef.current) return;
      toastShownRef.current = true;
      toast.show({
        message: "Nuova versione disponibile.",
        action: {
          label: "Aggiorna",
          onClick: () => {
            wantsReload = true;
            waiting.postMessage("SKIP_WAITING");
          },
        },
        durationMs: 600_000,
      });
    };

    const onControllerChange = () => {
      if (!wantsReload) return; // primo install o update da un'altra tab
      wantsReload = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        registration = reg;
        // Update già in attesa (es. deploy avvenuto mentre eravamo via).
        if (reg.waiting && navigator.serviceWorker.controller) {
          showUpdateToast(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (
              incoming.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              showUpdateToast(incoming);
            }
          });
        });
      })
      .catch(() => {
        // Registrazione fallita: l'app resta una web app normale.
      });

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        registration?.update().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
    };
  }, [toast]);

  return null;
}
