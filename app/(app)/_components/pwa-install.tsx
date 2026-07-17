"use client";

/**
 * Superfici dell'install UX (run-05 prompt 2, stub 13):
 *
 *   - InstallSection: card quieta in Impostazioni — bottone "Installa
 *     LifeOS" (prompt nativo dove esiste) o coaching iOS via BottomSheet
 *     ("Condividi → Aggiungi alla schermata Home").
 *   - InstallTodayCard: card gentile su Oggi dopo qualche visita,
 *     congedabile per sempre con un tap.
 *
 * Tutto sparisce in display-mode standalone (già installata) e sulle
 * piattaforme dove non esiste una strada (né prompt né iOS): mai
 * promettere quello che il browser non può fare.
 */

import { useState, useSyncExternalStore } from "react";
import { BottomSheet, Button } from "@/ui";
import {
  getPwaInstallServerSnapshot,
  getPwaInstallSnapshot,
  promptInstall,
  subscribePwaInstall,
} from "./pwa-store";
import {
  detectIos,
  parseDismissed,
  parseVisits,
  PWA_CARD_DISMISSED_KEY,
  PWA_VISITS_KEY,
  shouldShowInstallCard,
} from "./pwa-logic";

type InstallEnv = {
  ready: boolean;
  standalone: boolean;
  isIos: boolean;
};

const emptySubscribe = () => () => {};

/** false in SSR e durante l'idratazione, poi true (stesso idioma di ui/). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Rilevazioni solo-client, lette al render una volta idratati (valori
 * stabili per la sessione: niente stato-in-effect, niente mismatch SSR).
 */
function useInstallEnv(): InstallEnv {
  const hydrated = useHydrated();
  if (!hydrated) return { ready: false, standalone: false, isIos: false };
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator &&
      (window.navigator as { standalone?: boolean }).standalone === true);
  const isIos = detectIos(
    window.navigator.userAgent,
    window.navigator.platform ?? "",
    window.navigator.maxTouchPoints ?? 0,
  );
  return { ready: true, standalone, isIos };
}

/** Lettura difensiva di visite + congedo (localStorage non fidato). */
function readInstallCardStorage(): { visits: number; dismissed: boolean } {
  try {
    return {
      visits: parseVisits(window.localStorage.getItem(PWA_VISITS_KEY)),
      dismissed: parseDismissed(
        window.localStorage.getItem(PWA_CARD_DISMISSED_KEY),
      ),
    };
  } catch {
    // Storage negato: comportati come se la card fosse stata congedata.
    return { visits: 0, dismissed: true };
  }
}

function usePwaInstallSnapshot() {
  return useSyncExternalStore(
    subscribePwaInstall,
    getPwaInstallSnapshot,
    getPwaInstallServerSnapshot,
  );
}

/* ── Coaching iOS ────────────────────────────────────────────────────── */

function IosCoachSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Installa LifeOS">
      <ol className="flex flex-col gap-3 pb-2">
        <li className="em-body text-[var(--em-text-2)]">
          <span className="em-eyebrow mr-2">1</span>
          Tocca <span className="font-semibold">Condividi</span> nella barra
          di Safari (il quadrato con la freccia verso l&rsquo;alto).
        </li>
        <li className="em-body text-[var(--em-text-2)]">
          <span className="em-eyebrow mr-2">2</span>
          Scorri l&rsquo;elenco e scegli{" "}
          <span className="font-semibold">Aggiungi alla schermata Home</span>.
        </li>
        <li className="em-body text-[var(--em-text-2)]">
          <span className="em-eyebrow mr-2">3</span>
          Conferma con <span className="font-semibold">Aggiungi</span>:
          LifeOS si aprirà a schermo intero, come un&rsquo;app.
        </li>
      </ol>
    </BottomSheet>
  );
}

/* ── Impostazioni ────────────────────────────────────────────────────── */

export function InstallSection() {
  const env = useInstallEnv();
  const snap = usePwaInstallSnapshot();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!env.ready || env.standalone || snap.installed) return null;
  if (!snap.canPrompt && !env.isIos) return null;

  return (
    <section aria-label="Installa l'app" className="em-card p-5">
      <p className="em-eyebrow">App</p>
      <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
        Installa LifeOS su questo dispositivo: si apre a schermo intero
        dalla Home e, una volta caricata, funziona anche offline.
      </p>
      <div className="mt-3">
        <Button
          type="button"
          onClick={() => {
            if (snap.canPrompt) void promptInstall();
            else setSheetOpen(true);
          }}
        >
          Installa LifeOS
        </Button>
      </div>
      <IosCoachSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </section>
  );
}

/* ── Card gentile su Oggi ────────────────────────────────────────────── */

export function InstallTodayCard() {
  const env = useInstallEnv();
  const snap = usePwaInstallSnapshot();
  const [sheetOpen, setSheetOpen] = useState(false);
  // Il congedo del click vive nello stato; il resto si legge al render
  // (valori stabili per la sessione, l'idratazione li sblocca).
  const [dismissedNow, setDismissedNow] = useState(false);

  if (!env.ready) return null;
  const stored = readInstallCardStorage();
  const show = shouldShowInstallCard({
    visits: stored.visits,
    dismissed: stored.dismissed || dismissedNow,
    standalone: env.standalone || snap.installed,
    canPrompt: snap.canPrompt,
    isIos: env.isIos,
  });
  if (!show) return null;

  function dismissForever() {
    setDismissedNow(true);
    try {
      window.localStorage.setItem(PWA_CARD_DISMISSED_KEY, "1");
    } catch {
      // Se non si può scrivere, pazienza: ricomparirà.
    }
  }

  return (
    <section
      aria-label="Installa LifeOS"
      className="rounded-[var(--em-r-lg)] border border-dashed border-[var(--em-hairline-strong)] p-5"
    >
      <p className="em-body text-[var(--em-text)]">
        LifeOS può vivere sulla tua Home.
      </p>
      <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
        Installata si apre a schermo intero e funziona anche offline.
      </p>
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          onClick={() => {
            if (snap.canPrompt) void promptInstall();
            else setSheetOpen(true);
          }}
        >
          Installa LifeOS
        </Button>
        <Button type="button" variant="ghost" onClick={dismissForever}>
          Non ora
        </Button>
      </div>
      <IosCoachSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </section>
  );
}
