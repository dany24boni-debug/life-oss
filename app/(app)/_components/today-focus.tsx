"use client";

/**
 * Mini-launcher Focus su Oggi (run-08 prompt 5): fermo = un bottone
 * "Avvia focus" con la durata configurata; in corsa/in pausa = tempo
 * che manca, fase e Pausa/Riprendi inline. Monta lo stesso hook di
 * /focus: il rollover (chime + log) suona anche restando su Oggi.
 */

import Link from "next/link";
import { Button, cx } from "@/ui";
import {
  formatRemaining,
  phaseLabel,
  remainingMs,
} from "@/lib/focus/engine";
import { IconChevronRight } from "./icons";
import { useFocusTimer } from "../focus/use-focus";

export function TodayFocus() {
  const { state, nowMs, actions } = useFocusTimer();

  // SSR/caricamento: niente scheletro per una card così piccola.
  if (state === null) return null;

  const idle = !state.running && state.elapsed_ms === 0 && state.cycle === 1 && state.phase === "work";

  return (
    <section aria-label="Focus" className="em-card p-5">
      <Link
        href="/focus"
        className="group flex items-center justify-between gap-2"
      >
        <p className="em-eyebrow">Focus</p>
        <IconChevronRight className="text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] group-hover:text-[var(--em-text)]" />
      </Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        {idle ? (
          <>
            <p className="em-body-sm text-[var(--em-text-3)]">
              {state.config.work_min} minuti di lavoro, poi pausa.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={actions.startPause}
            >
              Avvia focus
            </Button>
          </>
        ) : (
          <>
            <p className="em-body flex items-center gap-2 text-[var(--em-text)]">
              <span className="em-num font-semibold tabular-nums">
                {formatRemaining(remainingMs(state, nowMs))}
              </span>
              <span
                className={cx(
                  "em-body-sm",
                  state.running
                    ? "text-[var(--em-text-2)]"
                    : "text-[var(--em-text-3)]",
                )}
              >
                {phaseLabel(state.phase)}
                {state.running ? "" : " · in pausa"}
              </span>
              {state.running ? (
                <span className="em-dot em-dot--live" aria-hidden="true" />
              ) : null}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={actions.startPause}
            >
              {state.running ? "Pausa" : "Riprendi"}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
