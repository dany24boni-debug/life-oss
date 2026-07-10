"use client";

/**
 * Azioni condivise del modulo Task: ogni mutazione passa dal port, mostra
 * l'errore col Toast (mai throw verso l'utente, B3.7) e — per le azioni
 * reversibili — offre l'undo nel toast per 5s invece di un dialogo di
 * conferma (B2.1). Il rollback è intrinseco: liveQuery riflette solo le
 * scritture riuscite, quindi un Result ko non lascia mai stato fantasma.
 */

import { useToast } from "@/ui";
import type { DayString } from "@/ui/calendar-core";
import { appRepos } from "@/data/hooks";
import type { Result } from "@/data/result";
import type { Task, TaskPatch } from "@/data/schemas";
import { dayHeading, SNOOZE_LABELS, snoozeDate, type SnoozeOption } from "./logic";

const SNOOZE_TOAST: Record<SnoozeOption, string> = {
  stasera: "Spostato a stasera",
  domani: "Spostato a domani",
  weekend: "Spostato al weekend",
  prossima_settimana: "Spostato alla prossima settimana",
};

export type TaskActions = ReturnType<typeof useTaskActions>;

export function useTaskActions() {
  const toast = useToast();

  /** Esegue una mutazione; su ko mostra il toast d'errore. */
  async function run<T>(op: () => Promise<Result<T>>): Promise<boolean> {
    const r = await op();
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    return r.ok;
  }

  async function complete(task: Task): Promise<boolean> {
    const done = await run(() => appRepos().tasks.complete(task.id));
    if (done) {
      toast.show({
        message: `Fatto: ${task.title}`,
        tone: "success",
        action: {
          label: "Annulla",
          onClick: () => void run(() => appRepos().tasks.uncomplete(task.id)),
        },
      });
    }
    return done;
  }

  async function uncomplete(task: Task): Promise<boolean> {
    return run(() => appRepos().tasks.uncomplete(task.id));
  }

  async function remove(task: Task): Promise<boolean> {
    const done = await run(() => appRepos().tasks.softDelete(task.id));
    if (done) {
      toast.show({
        message: `Eliminato: ${task.title}`,
        action: {
          label: "Annulla",
          onClick: () => void run(() => appRepos().tasks.restore(task.id)),
        },
      });
    }
    return done;
  }

  /** Snooze a un'opzione del menu oppure a un giorno esplicito. */
  async function snooze(
    task: Task,
    target: SnoozeOption | { day: DayString },
    today: DayString,
  ): Promise<boolean> {
    const day = typeof target === "string" ? snoozeDate(target, today) : target.day;
    const message =
      typeof target === "string"
        ? SNOOZE_TOAST[target]
        : `Spostato a ${dayHeading(day, today).toLowerCase()}`;
    const previous = task.date;
    const done = await run(() => appRepos().tasks.update(task.id, { date: day }));
    if (done) {
      toast.show({
        message,
        action: {
          label: "Annulla",
          onClick: () =>
            void run(() => appRepos().tasks.update(task.id, { date: previous })),
        },
      });
    }
    return done;
  }

  /** "Sposta tutte a oggi" del blocco In ritardo, con undo cumulativo. */
  async function moveAllToToday(tasks: Task[], today: DayString): Promise<void> {
    const moved: Array<{ id: string; previous: DayString | null }> = [];
    let failed = false;
    for (const t of tasks) {
      const r = await appRepos().tasks.update(t.id, { date: today });
      if (r.ok) moved.push({ id: t.id, previous: t.date });
      else failed = true;
    }
    if (failed) {
      toast.show({
        message: "Non ho potuto spostare tutti i task. Riprova.",
        tone: "error",
      });
      return;
    }
    if (moved.length === 0) return;
    toast.show({
      message:
        moved.length === 1 ? "1 task spostato a oggi" : `${moved.length} task spostati a oggi`,
      action: {
        label: "Annulla",
        onClick: () => {
          void (async () => {
            for (const m of moved) {
              await run(() => appRepos().tasks.update(m.id, { date: m.previous }));
            }
          })();
        },
      },
    });
  }

  /** Patch silenziosa (scheda dettaglio): errore a toast, successo muto. */
  async function patch(id: string, value: TaskPatch): Promise<boolean> {
    return run(() => appRepos().tasks.update(id, value));
  }

  /** Riordino manuale: nessun toast (gesto, non transazione). */
  async function reorder(orderedIds: string[]): Promise<boolean> {
    return run(() => appRepos().tasks.reorder(orderedIds));
  }

  return {
    complete,
    uncomplete,
    remove,
    snooze,
    moveAllToToday,
    patch,
    reorder,
    snoozeLabels: SNOOZE_LABELS,
  };
}
