"use client";

/**
 * Lo stato VIVO del timer focus: il motore puro (lib/focus/engine) +
 * localStorage + un battito ogni mezzo secondo mentre corre. Il tempo
 * mostrato è sempre la differenza persistita→adesso: reload, blocco
 * schermo e cambio tab non perdono niente per costruzione (l'engine è
 * testato coi fake timer; qui c'è solo il cablaggio).
 *
 * Alla fine di una fase: chime (toni distinti lavoro/pausa, pattern
 * WebAudio dei promemoria), toast, badge se la pagina è nascosta, e —
 * per le fasi di LAVORO — una riga FocusSession vera (conta nella
 * streak globale).
 */

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { useToast } from "@/ui";
import { appRepos } from "@/data/hooks";
import {
  initialState,
  parseState,
  pause,
  reset,
  start,
  tick,
  withConfig,
  adjustMinutes,
  advance,
  type FocusConfig,
  type FocusState,
  type PhaseEnd,
} from "@/lib/focus/engine";
import { APP_TIME_ZONE, todayInZone } from "../_components/tasks/logic";

const STORAGE_KEY = "lifeos.focus.state";

export function readFocusState(): FocusState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return initialState();
    return parseState(JSON.parse(raw)) ?? initialState();
  } catch {
    return initialState();
  }
}

export function writeFocusState(state: FocusState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage negato: il timer vive solo in memoria, onestamente.
  }
}

/* ── Store esterno (idioma useSyncExternalStore, come pwa-store):
      la verità vive nel modulo + localStorage; i componenti montati
      (schermo /focus, launcher di Oggi) leggono la stessa. ─────────── */

let cache: FocusState | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): FocusState {
  if (cache === null) cache = readFocusState();
  return cache;
}

function getServerSnapshot(): FocusState | null {
  return null; // SSR: lo stato non esiste, la UI mostra il caricamento
}

function subscribeStore(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function publish(next: FocusState): void {
  cache = next;
  writeFocusState(next);
  for (const l of [...listeners]) l();
}

/** Avvio secco da fuori (palette comandi): parte se non sta già correndo. */
export function startFocusNow(): void {
  const state = getSnapshot();
  if (!state.running) publish(start(state, Date.now()));
}

export function useFocusTimer() {
  const toast = useToast();
  const state = useSyncExternalStore(
    subscribeStore,
    getSnapshot,
    getServerSnapshot,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());

  const apply = useCallback((next: FocusState) => {
    publish(next);
    setNowMs(Date.now());
  }, []);

  const handleEnded = useCallback(
    (ended: PhaseEnd) => {
      playChime(ended.phase === "work" ? "work" : "break");
      if (document.hidden) flashBadge();
      if (ended.phase === "work" && ended.minutes >= 1) {
        void appRepos().focus.add({
          date: todayInZone(new Date(), APP_TIME_ZONE),
          minutes: ended.minutes,
        });
        toast.show({
          message: `Focus: ${ended.minutes} minuti fatti. Pausa.`,
          tone: "success",
        });
      } else if (ended.phase !== "work") {
        toast.show({ message: "Pausa finita: si torna al lavoro." });
      }
    },
    [toast],
  );

  /** Un giro d'orologio: rollover se serve, altrimenti solo il battito. */
  const syncFromClock = useCallback(() => {
    const current = getSnapshot();
    const { state: next, ended } = tick(current, Date.now());
    if (ended) {
      apply(next);
      handleEnded(ended);
    } else {
      setNowMs(Date.now());
    }
  }, [apply, handleEnded]);

  // Mount: recupera il tempo perso (reload/lock) al primo giro di event
  // loop — mai setState sincroni nel corpo dell'effetto (lint run-07).
  useEffect(() => {
    const t = setTimeout(syncFromClock, 0);
    const onVis = () => {
      if (!document.hidden) {
        clearBadge();
        syncFromClock();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [syncFromClock]);

  // Il battito, solo mentre corre.
  useEffect(() => {
    if (state === null || !state.running) return;
    const iv = setInterval(syncFromClock, 500);
    return () => clearInterval(iv);
  }, [state, syncFromClock]);

  const actions = {
    startPause() {
      const s = getSnapshot();
      apply(s.running ? pause(s, Date.now()) : start(s, Date.now()));
    },
    /** Salta alla fase successiva: minuti VERI loggati, prossima in pausa. */
    skip() {
      const s = getSnapshot();
      const r = advance(s, Date.now(), { forcePaused: true });
      apply(r.state);
      if (r.ended.phase === "work" && r.ended.minutes >= 1) {
        void appRepos().focus.add({
          date: todayInZone(new Date(), APP_TIME_ZONE),
          minutes: r.ended.minutes,
        });
        toast.show({
          message: `Fase saltata: ${r.ended.minutes} minuti contati.`,
        });
      }
    },
    resetAll() {
      apply(reset(getSnapshot().config));
    },
    adjust(deltaMin: number) {
      apply(adjustMinutes(getSnapshot(), deltaMin, Date.now()));
    },
    setConfig(config: FocusConfig) {
      // Da fermo all'inizio di una fase la nuova durata vale subito.
      const next = withConfig(getSnapshot(), config);
      if (!next.running && next.elapsed_ms === 0) {
        apply(reset(next.config));
      } else {
        apply(next);
      }
    },
  };

  return { state, nowMs, actions };
}

/* ── Chime: toni distinti lavoro/pausa (pattern dei promemoria) ──────── */

function playChime(kind: "work" | "break"): void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    if (ctx.state !== "running") {
      void ctx.close();
      return;
    }
    // Lavoro finito: due note discendenti (si stacca); pausa finita:
    // una nota sola più alta (si riparte).
    const notes = kind === "work" ? [880, 587] : [784];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const at = ctx.currentTime + i * 0.22;
      osc.start(at);
      osc.stop(at + 0.18);
      if (i === notes.length - 1) osc.onended = () => void ctx.close();
    });
  } catch {
    // Nessun audio disponibile: enhancement, non funzionalità.
  }
}

/* ── Badging API (pagina nascosta): si pulisce al ritorno ────────────── */

type BadgeNavigator = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** true solo se il badge l'abbiamo acceso NOI: quello dei promemoria
 *  (reminders-host) non si tocca mai. */
let badgeFlashed = false;

function flashBadge(): void {
  try {
    (navigator as BadgeNavigator).setAppBadge?.(1)?.catch(() => undefined);
    badgeFlashed = true;
  } catch {
    // Badging assente: enhancement.
  }
}

function clearBadge(): void {
  if (!badgeFlashed) return;
  badgeFlashed = false;
  try {
    (navigator as BadgeNavigator).clearAppBadge?.()?.catch(() => undefined);
  } catch {
    // Badging assente: enhancement.
  }
}
