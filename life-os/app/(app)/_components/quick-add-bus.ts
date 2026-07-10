"use client";

/**
 * Bus minimale del "Nuovo task…" (run-05 prompt 6): palette e scorciatoia
 * `n` chiedono l'apertura del quick-add da QUALSIASI schermata; le
 * superfici task (Oggi e /tasks) si iscrivono e rispondono. Il flag
 * `pending` sopravvive alla navigazione (stato di modulo): chi monta dopo
 * un router.push lo consuma — niente richieste perse, niente query param.
 */

let pending = false;
const listeners = new Set<() => void>();

export function requestQuickAdd(): void {
  pending = true;
  listeners.forEach((l) => l());
}

/** True una sola volta per richiesta (consumo al mount). */
export function consumeQuickAddRequest(): boolean {
  const p = pending;
  pending = false;
  return p;
}

export function onQuickAddRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
