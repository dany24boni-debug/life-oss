"use client";

/**
 * Host dei promemoria (B2.2): monta lo scheduler in-app finché la shell è
 * aperta — UN interval per tutta l'app (vive nel layout del gruppo), tick
 * immediato al ritorno di visibilità. Consegna "live" = toast + breve
 * suono (se la politica autoplay lo permette); i "mentre eri via" non
 * fanno rumore: finiscono nella card di Oggi via live query. Il badge
 * dell'app (Badging API, dove esiste) conta gli scattati non riconosciuti.
 */

import { useEffect, useRef } from "react";
import { useToast } from "@/ui";
import { appRepos, useFiredReminders } from "@/data/hooks";
import type { Reminder } from "@/data/schemas";
import { createInAppScheduler } from "@/lib/reminders/scheduler";

export function RemindersHost() {
  const toast = useToast();
  const fired = useFiredReminders();

  // Il contesto del toast cambia identità a ogni render del provider: il
  // ref evita di riavviare lo scheduler quando compare un toast.
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  useEffect(() => {
    const scheduler = createInAppScheduler<Reminder>({
      listPending: (now) => appRepos().reminders.listPending(now),
      markFired: (id, at) => appRepos().reminders.markFired(id, at),
      deliver: (reminders, kind) => {
        // catchup: nessun toast a raffica — la card "Mentre eri via"
        // legge i fired-non-riconosciuti dal port.
        if (kind === "live") void deliverLive(reminders, toastRef);
      },
    });
    scheduler.start();
    const onVisible = () => {
      if (document.visibilityState === "visible") void scheduler.tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      scheduler.stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Badge = scattati non riconosciuti (esclusi gli orfani, che vengono
  // archiviati qui sotto senza disturbo).
  useEffect(() => {
    if (fired === undefined) return;
    const orphans = fired.filter(
      (f) => f.reminder.kind === "task" && f.task === null,
    );
    for (const o of orphans) {
      void appRepos().reminders.dismiss(o.reminder.id, new Date().toISOString());
    }
    setAppBadge(fired.length - orphans.length);
  }, [fired]);

  return null;
}

type ToastRef = React.RefObject<ReturnType<typeof useToast>>;

async function deliverLive(reminders: Reminder[], toastRef: ToastRef) {
  const repos = appRepos();
  let chimed = false;
  for (const reminder of reminders) {
    const task =
      reminder.kind === "task"
        ? await repos.tasks.getById(reminder.ref_id)
        : null;
    if (reminder.kind === "task" && task === null) {
      // Il task non esiste più: promemoria orfano, si archivia in silenzio.
      void repos.reminders.dismiss(reminder.id, new Date().toISOString());
      continue;
    }
    if (!chimed) {
      chime();
      chimed = true;
    }
    toastRef.current.show({
      message: task ? `Promemoria: ${task.title}` : "Promemoria",
      durationMs: 8000,
      action: {
        label: "Ok",
        onClick: () =>
          void repos.reminders.dismiss(reminder.id, new Date().toISOString()),
      },
    });
  }
}

/**
 * Suono breve e basso via WebAudio — puro enhancement: se la politica
 * autoplay tiene il contesto sospeso (nessun gesto recente) si rinuncia
 * in silenzio, il toast è la consegna vera.
 */
function chime() {
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
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
  } catch {
    // Nessun audio disponibile: enhancement, non funzionalità.
  }
}

/** Badging API dove supportata (PWA installata); altrove non fa nulla. */
function setAppBadge(count: number) {
  try {
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (count > 0) {
      nav.setAppBadge?.(count)?.catch(() => undefined);
    } else {
      nav.clearAppBadge?.()?.catch(() => undefined);
    }
  } catch {
    // Badging assente: enhancement.
  }
}
