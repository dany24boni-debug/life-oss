"use client";

/**
 * Tema per-DISPOSITIVO (run-05 prompt 6, stub 14 / D5): scuro, chiaro o
 * sistema, applicato dal layer di token Ember — la css attiva la variante
 * chiara su [data-ember-theme="light"] su <html>, lo scuro è il default
 * senza attributo. Persistenza in localStorage, MAI sincronizzata: il
 * tema è una preferenza del dispositivo (l'OLED del telefono e il monitor
 * della scrivania hanno esigenze diverse), non dell'account — decisione
 * documentata; il campo `theme` di Settings (0019) resta inerte.
 *
 * Default: SCURO (D5 "dark remains the default") — chi non sceglie non
 * vede cambiare nulla. Il flash-of-wrong-theme è evitato dallo script
 * inline nel layout della shell, che stampa l'attributo prima del paint;
 * qui vive il resto: set/subscribe, il listener di sistema quando la
 * modalità è "system", e il meta theme-color che segue il tema risolto.
 */

export type ThemeMode = "dark" | "light" | "system";

export const THEME_KEY = "lifeos.theme";

const DARK_META = "#15171C";
const LIGHT_META = "#F4F3EF";

export function parseThemeMode(raw: string | null | undefined): ThemeMode {
  return raw === "light" || raw === "system" ? raw : "dark";
}

let mode: ThemeMode = "dark";
let booted = false;
const listeners = new Set<() => void>();
let systemMql: MediaQueryList | null = null;

function resolved(m: ThemeMode): "dark" | "light" {
  if (m === "system") {
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }
  return m;
}

/** Stampa l'attributo sul root e allinea i meta theme-color. */
function applyDom() {
  const r = resolved(mode);
  if (r === "light") {
    document.documentElement.setAttribute("data-ember-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-ember-theme");
  }

  // I due meta media-based del prompt 2: quando il tema è FORZATO devono
  // smettere di seguire l'OS; in "system" tornano ai loro valori.
  const metas = document.querySelectorAll<HTMLMetaElement>(
    'meta[name="theme-color"]',
  );
  metas.forEach((meta) => {
    if (mode === "system") {
      const media = meta.getAttribute("media") ?? "";
      meta.content = media.includes("light") ? LIGHT_META : DARK_META;
    } else {
      meta.content = r === "light" ? LIGHT_META : DARK_META;
    }
  });
}

function onSystemChange() {
  if (mode === "system") {
    applyDom();
    listeners.forEach((l) => l());
  }
}

/** Da chiamare una volta nella shell: legge il dispositivo e applica. */
export function bootTheme() {
  if (booted) return;
  booted = true;
  try {
    mode = parseThemeMode(window.localStorage.getItem(THEME_KEY));
  } catch {
    mode = "dark";
  }
  systemMql = window.matchMedia("(prefers-color-scheme: light)");
  systemMql.addEventListener("change", onSystemChange);
  applyDom();
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  try {
    window.localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage negato: il tema vale per la sessione corrente.
  }
  applyDom();
  listeners.forEach((l) => l());
}

export function getThemeMode(): ThemeMode {
  return mode;
}

/** Snapshot server: il default scuro (nessun attributo). */
export function getServerThemeMode(): ThemeMode {
  return "dark";
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
