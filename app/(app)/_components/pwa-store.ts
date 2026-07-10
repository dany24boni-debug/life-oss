"use client";

/**
 * Store client del prompt d'installazione PWA (run-05 prompt 2).
 * `beforeinstallprompt` arriva UNA volta, presto, su Chromium/Android:
 * PwaHost lo cattura qui; le superfici (Impostazioni, card su Oggi) lo
 * consumano via useSyncExternalStore. Fuori da React per sopravvivere ai
 * mount/unmount delle superfici.
 */

/** Il tipo non è nelle lib DOM standard (API solo-Chromium). */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type PwaInstallSnapshot = {
  /** beforeinstallprompt catturato e non ancora consumato. */
  canPrompt: boolean;
  /** appinstalled visto in questa sessione. */
  installed: boolean;
};

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
let snapshot: PwaInstallSnapshot = { canPrompt: false, installed: false };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { canPrompt: deferred !== null, installed };
  listeners.forEach((l) => l());
}

export function setDeferredPrompt(e: BeforeInstallPromptEvent) {
  deferred = e;
  emit();
}

export function markInstalled() {
  deferred = null;
  installed = true;
  emit();
}

/**
 * Mostra il prompt nativo di installazione (Chromium). L'evento si
 * consuma in ogni caso: il browser non permette un secondo prompt()
 * sulla stessa istanza.
 */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  const e = deferred;
  if (!e) return "unavailable";
  deferred = null;
  emit();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    if (choice.outcome === "accepted") markInstalled();
    return choice.outcome;
  } catch {
    return "unavailable";
  }
}

export function subscribePwaInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaInstallSnapshot(): PwaInstallSnapshot {
  return snapshot;
}

/** Snapshot server (SSR): mai un prompt, mai installata. */
const SERVER_SNAPSHOT: PwaInstallSnapshot = {
  canPrompt: false,
  installed: false,
};

export function getPwaInstallServerSnapshot(): PwaInstallSnapshot {
  return SERVER_SNAPSHOT;
}
