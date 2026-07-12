"use client";

/**
 * ComfortHost (run-05 prompt 6, stub 14) — il layer di comfort della
 * shell, montato nel layout del gruppo (app):
 *
 *   - palette comandi (cmd+K / ctrl+K): navigazione, "Nuovo task…",
 *     azioni tema — fuzzy della shell ui/, coi comandi RECENTI in testa
 *     (per-dispositivo, localStorage);
 *   - scorciatoie: `n` nuovo task, `g` poi `t/c/g/s` vai-a, `?` overlay
 *     delle scorciatoie (Modal Ember). MAI dentro input/textarea/select/
 *     contenteditable, mai con modificatori (tranne cmd/ctrl+K e ?);
 *   - boot del tema per-dispositivo (theme.ts) + listener di sistema.
 */

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CommandPalette, Modal, type CommandItem } from "@/ui";
import { startFocusNow } from "../focus/use-focus";
import { requestQuickAdd } from "./quick-add-bus";
import { bootTheme, setThemeMode } from "./theme";

const RECENT_KEY = "lifeos.palette.recent";
const RECENT_MAX = 4;
const CHORD_TIMEOUT_MS = 900;

/* ── Recenti (per-dispositivo, difensivo) ────────────────────────────── */

function readRecents(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is string => typeof x === "string" && x.length <= 40)
      .slice(0, RECENT_MAX);
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecents().filter((r) => r !== id)].slice(
      0,
      RECENT_MAX,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage negato: i recenti semplicemente non si ricordano.
  }
}

/* ── Destinazioni e comandi ──────────────────────────────────────────── */

const NAV_TARGETS: Array<{ id: string; label: string; href: string; keywords: string }> = [
  { id: "nav:/", label: "Oggi", href: "/", keywords: "home today dashboard" },
  { id: "nav:/tasks", label: "Task", href: "/tasks", keywords: "todo attività" },
  { id: "nav:/calendar", label: "Calendario", href: "/calendar", keywords: "agenda eventi" },
  { id: "nav:/gym", label: "Palestra", href: "/gym", keywords: "gym allenamento" },
  { id: "nav:/stats", label: "Statistiche", href: "/stats", keywords: "stats numeri streak" },
  { id: "nav:/abitudini", label: "Abitudini", href: "/abitudini", keywords: "habits anelli acqua streak" },
  { id: "nav:/settimana", label: "Settimana", href: "/settimana", keywords: "planner piano slot settimana tipo" },
  { id: "nav:/focus", label: "Focus", href: "/focus", keywords: "pomodoro timer concentrazione" },
  { id: "nav:/esami", label: "Esami", href: "/esami", keywords: "studio università capitoli" },
  { id: "nav:/spese", label: "Spese", href: "/spese", keywords: "soldi uscite finance" },
  { id: "nav:/sera", label: "Sera", href: "/sera", keywords: "diario check-in journal" },
  { id: "nav:/corpo", label: "Corpo", href: "/corpo", keywords: "peso corporeo bilancia trend" },
  { id: "nav:/impostazioni", label: "Impostazioni", href: "/impostazioni", keywords: "settings account sync tema" },
];

/** Le go-to della tastiera: `g` poi questa lettera. */
const GO_KEYS: Record<string, string> = {
  t: "/tasks",
  c: "/calendar",
  g: "/gym",
  s: "/stats",
  f: "/focus",
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function ComfortHost() {
  const router = useRouter();
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // I recenti si leggono all'APERTURA della palette (mai in render SSR).
  const [recents, setRecents] = useState<string[]>([]);

  // Tema per-dispositivo: boot una volta (lo script inline del layout ha
  // già stampato l'attributo prima del paint; qui parte il listener).
  useEffect(() => {
    bootTheme();
  }, []);

  function openQuickAdd() {
    if (pathname !== "/" && pathname !== "/tasks") {
      router.push("/tasks");
    }
    requestQuickAdd();
  }

  const items: CommandItem[] = useMemo(() => {
    const nav: CommandItem[] = NAV_TARGETS.map((t) => ({
      id: t.id,
      label: t.label,
      group: "Vai a",
      hint: t.href,
      keywords: t.keywords,
      onSelect: () => {
        pushRecent(t.id);
        router.push(t.href);
      },
    }));
    const actions: CommandItem[] = [
      {
        id: "act:new-task",
        label: "Nuovo task…",
        group: "Azioni",
        hint: "n",
        keywords: "aggiungi crea todo",
        onSelect: () => {
          pushRecent("act:new-task");
          openQuickAdd();
        },
      },
      {
        id: "act:start-focus",
        label: "Avvia focus",
        group: "Azioni",
        keywords: "pomodoro timer concentrazione parti",
        onSelect: () => {
          pushRecent("act:start-focus");
          startFocusNow();
          router.push("/focus");
        },
      },
    ];
    const theme: CommandItem[] = [
      { id: "theme:dark", label: "Tema scuro", keywords: "dark notte" },
      { id: "theme:light", label: "Tema chiaro", keywords: "light giorno" },
      { id: "theme:system", label: "Tema di sistema", keywords: "auto os" },
    ].map((t) => ({
      ...t,
      group: "Tema",
      onSelect: () => {
        pushRecent(t.id);
        setThemeMode(t.id.slice("theme:".length) as "dark" | "light" | "system");
      },
    }));

    const all = [...nav, ...actions, ...theme];
    const byId = new Map(all.map((i) => [i.id, i] as const));
    // Recenti in testa, nel loro gruppo — l'ordine dell'array comanda.
    const recentItems = recents
      .map((id) => byId.get(id))
      .filter((i): i is CommandItem => i !== undefined)
      .map((i) => ({ ...i, group: "Recenti" }));
    const recentIds = new Set(recentItems.map((i) => i.id));
    return [...recentItems, ...all.filter((i) => !recentIds.has(i.id))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recents, pathname]);

  // ── Tastiera globale ─────────────────────────────────────────────────
  useEffect(() => {
    let chordUntil = 0;

    function onKeyDown(e: KeyboardEvent) {
      // cmd+K / ctrl+K: sempre, anche dentro un input.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setHelpOpen(false);
        setRecents(readRecents());
        setPaletteOpen((o) => !o);
        return;
      }
      // Tutto il resto: mai dentro i campi, mai con modificatori
      // (shift serve per "?"), mai sopra palette/overlay aperti.
      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (paletteOpen || helpOpen) return;

      const now = Date.now();
      if (now < chordUntil) {
        chordUntil = 0;
        const href = GO_KEYS[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }

      if (e.key === "g") {
        chordUntil = now + CHORD_TIMEOUT_MS;
        return;
      }
      if (e.key === "n") {
        e.preventDefault();
        openQuickAdd();
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paletteOpen, helpOpen, pathname]);

  return (
    <>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={items}
      />
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Scorciatoie da tastiera"
      >
        <dl className="flex flex-col gap-3 pb-2">
          {[
            ["⌘K / Ctrl+K", "Palette comandi: naviga, crea, cambia tema"],
            ["n", "Nuovo task (da qualsiasi schermata)"],
            ["g poi t", "Vai a Task"],
            ["g poi c", "Vai a Calendario"],
            ["g poi g", "Vai a Palestra"],
            ["g poi s", "Vai a Statistiche"],
            ["g poi f", "Vai a Focus"],
            ["?", "Questo riepilogo"],
            ["Esc", "Chiude palette, schede e finestre"],
          ].map(([keys, desc]) => (
            <div key={keys} className="flex items-baseline gap-3">
              <dt className="em-eyebrow w-28 shrink-0 normal-case">{keys}</dt>
              <dd className="em-body-sm text-[var(--em-text-2)]">{desc}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}
