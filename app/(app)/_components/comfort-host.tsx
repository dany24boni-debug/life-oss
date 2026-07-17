"use client";

/**
 * ComfortHost (run-05 prompt 6, stub 14) — il layer di comfort della
 * shell, montato nel layout del gruppo (app):
 *
 *   - palette comandi (cmd+K / ctrl+K): la SHELL è solo il listener e
 *     lo stato open — il corpo (sorgenti, ranking, recenti) vive in
 *     `palette/palette-body.tsx`, caricato con next/dynamic alla prima
 *     apertura (run-12 P4: il layout non paga i byte della palette);
 *   - scorciatoie: `n` nuovo task, `g` poi `t/c/g/s` vai-a, `?` overlay
 *     delle scorciatoie (Modal Ember). MAI dentro input/textarea/select/
 *     contenteditable, mai con modificatori (tranne cmd/ctrl+K e ?);
 *   - boot del tema per-dispositivo (theme.ts) + listener di sistema.
 */

import { Suspense, lazy, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/ui";
import { requestQuickAdd } from "./quick-add-bus";
import { bootTheme } from "./theme";

const CHORD_TIMEOUT_MS = 900;

/**
 * Corpo lazy della palette: chunk dedicato, montato solo da aperta.
 * React.lazy e NON next/dynamic, di proposito: un secondo consumer di
 * next/dynamic nel gruppo (app) faceva nascere lo shim di interop nel
 * chunk della home (+78 B sul congelato — misurato al P4). Il corpo
 * rende solo su gesto client (⌘K): l'SSR non lo incontra mai.
 */
const PaletteBody = lazy(() => import("./palette/palette-body"));

/** Le go-to della tastiera: `g` poi questa lettera. */
const GO_KEYS: Record<string, string> = {
  t: "/tasks",
  c: "/calendar",
  g: "/gym",
  s: "/stats",
  f: "/focus",
  d: "/dieta",
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

  // ── Tastiera globale ─────────────────────────────────────────────────
  useEffect(() => {
    let chordUntil = 0;

    function onKeyDown(e: KeyboardEvent) {
      // cmd+K / ctrl+K: sempre, anche dentro un input.
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setHelpOpen(false);
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
      {paletteOpen ? (
        <Suspense fallback={null}>
          <PaletteBody
            onClose={() => setPaletteOpen(false)}
            onQuickAdd={openQuickAdd}
          />
        </Suspense>
      ) : null}
      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Scorciatoie da tastiera"
      >
        <dl className="flex flex-col gap-3 pb-2">
          {[
            ["⌘K / Ctrl+K", "Palette comandi: naviga, apri una scheda, agisci"],
            ["n", "Nuovo task (da qualsiasi schermata)"],
            ["g poi t", "Vai a Task"],
            ["g poi c", "Vai a Calendario"],
            ["g poi g", "Vai a Palestra"],
            ["g poi s", "Vai a Statistiche"],
            ["g poi f", "Vai a Focus"],
            ["g poi d", "Vai a Dieta"],
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
