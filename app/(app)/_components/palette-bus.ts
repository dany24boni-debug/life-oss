"use client";

/**
 * Bus del ⌘K dal rail (run-13 P4b): il bottone sul rail desktop chiede
 * l'apertura della palette; ComfortHost — che possiede lo stato e il
 * corpo lazy — risponde. Stesso disegno di quick-add-bus ma senza
 * `pending`: rail e host vivono nello stesso layout, nessuna richiesta
 * può precedere il mount del listener.
 */

const listeners = new Set<() => void>();

export function requestPalette(): void {
  listeners.forEach((l) => l());
}

export function onPaletteRequest(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
