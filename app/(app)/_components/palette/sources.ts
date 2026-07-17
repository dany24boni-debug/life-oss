/**
 * Le sorgenti della palette (run-12 P4) — descrittori PURI, senza
 * closure: il corpo lazy li mappa in CommandItem cablando gli
 * onSelect. Navigazione a ogni superficie (la lista che viveva in
 * comfort-host), schede palestra PER NOME via gymCardHref, azioni
 * sicure (solo gesti che ESISTONO già con undo o reversibili).
 */

import { gymCardHref } from "../../gym/card-history";

export type NavSource = {
  id: string;
  label: string;
  group: string;
  hint?: string;
  keywords: string;
  href: string;
};

export const NAV_SOURCES: readonly NavSource[] = [
  { id: "nav:/", label: "Oggi", href: "/", keywords: "home today dashboard" },
  { id: "nav:/tasks", label: "Task", href: "/tasks", keywords: "todo attività" },
  { id: "nav:/calendar", label: "Calendario", href: "/calendar", keywords: "agenda eventi" },
  { id: "nav:/gym", label: "Palestra", href: "/gym", keywords: "gym allenamento" },
  { id: "nav:/stats", label: "Statistiche", href: "/stats", keywords: "stats numeri streak" },
  { id: "nav:/abitudini", label: "Abitudini", href: "/abitudini", keywords: "habits anelli acqua streak" },
  { id: "nav:/settimana", label: "Settimana", href: "/settimana", keywords: "planner piano slot settimana tipo" },
  { id: "nav:/focus", label: "Focus", href: "/focus", keywords: "pomodoro timer concentrazione" },
  { id: "nav:/dieta", label: "Dieta", href: "/dieta", keywords: "pasti alimenti kcal proteine piano" },
  { id: "nav:/esami", label: "Esami", href: "/esami", keywords: "studio università capitoli" },
  { id: "nav:/spese", label: "Spese", href: "/spese", keywords: "soldi uscite finance" },
  { id: "nav:/sera", label: "Sera", href: "/sera", keywords: "diario check-in journal" },
  { id: "nav:/corpo", label: "Corpo", href: "/corpo", keywords: "peso corporeo bilancia trend" },
  { id: "nav:/impostazioni", label: "Impostazioni", href: "/impostazioni", keywords: "settings account sync tema" },
].map((t) => ({ ...t, group: "Vai a", hint: t.href }));

/**
 * "tor…" → "Apri scheda: Torso A" — le card dei giorni del programma
 * attivo, deep-link alla rotta card del run-10.
 */
export function gymCardSources(
  days: ReadonlyArray<{ id: string; name: string; subtitle: string | null }>,
): NavSource[] {
  return days.map((d) => ({
    id: `gym-card:${d.id}`,
    label: `Apri scheda: ${d.name}`,
    group: "Palestra",
    keywords: `scheda card palestra gym allenamento ${d.subtitle ?? ""}`.trim(),
    href: gymCardHref(d.id),
  }));
}
