"use client";

/**
 * Card "Adesso" su Oggi (run-08 prompt 4): lo slot in corso del piano
 * attivo — o il prossimo — col suo check inline (tap = fatto, gesto
 * lungo = saltato). Quieta per costruzione: senza piano attivo o senza
 * slot oggi non rende nulla. `useTodayPlanSlots` è condiviso col tile
 * "Piano" dei TodayTiles (stessa query, mai due verità).
 */

import Link from "next/link";
import { isoWeekOf } from "@/data/planner";
import type { WeekSlotEntry } from "@/data/planner";
import { useActiveWeekPlan, useWeekBoard } from "@/data/hooks";
import { adessoEntry, hhmmInZone, remainingCount } from "../settimana/logic";
import { SlotRow } from "../settimana/week-board";
import { IconChevronRight } from "./icons";
import { APP_TIME_ZONE } from "./tasks/logic";
import { useToday } from "./tasks/screen-hooks";
import { useEffect, useState } from "react";

/** Gli slot di OGGI del piano attivo (undefined = caricamento). */
export function useTodayPlanSlots(): {
  isoWeek: string;
  hasPlan: boolean | undefined;
  entries: WeekSlotEntry[] | undefined;
} {
  const today = useToday();
  const isoWeek = isoWeekOf(today);
  const plan = useActiveWeekPlan();
  const board = useWeekBoard(plan?.id ?? null, isoWeek);
  const entries =
    plan === undefined || (plan !== null && board === undefined)
      ? undefined
      : plan === null
        ? []
        : (board?.find((d) => d.date === today)?.slots ?? []);
  return {
    isoWeek,
    hasPlan: plan === undefined ? undefined : plan !== null,
    entries,
  };
}

function useNowHhmm(): string {
  const [now, setNow] = useState(() => hhmmInZone(new Date(), APP_TIME_ZONE));
  useEffect(() => {
    const tick = () => setNow(hhmmInZone(new Date(), APP_TIME_ZONE));
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return now;
}

export function TodayAdesso() {
  const { isoWeek, hasPlan, entries } = useTodayPlanSlots();
  const nowHhmm = useNowHhmm();

  // Quieta: niente piano o niente slot oggi = nessuna card.
  if (hasPlan !== true || entries === undefined || entries.length === 0) {
    return null;
  }

  const adesso = adessoEntry(entries, nowHhmm);
  const remaining = remainingCount(entries);

  return (
    <section aria-label="Adesso" className="em-card p-5">
      <Link
        href="/settimana"
        className="group flex items-center justify-between gap-2"
      >
        <p className="em-eyebrow">Adesso</p>
        <IconChevronRight className="text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-control)] group-hover:text-[var(--em-text)]" />
      </Link>
      <div className="mt-2">
        {adesso === null ? (
          <p className="em-body-sm text-[var(--em-text-3)]">
            {remaining === 0
              ? "Piano di oggi completo."
              : `Slot di oggi finiti: ${remaining} senza esito.`}
          </p>
        ) : (
          <>
            {adesso.kind === "next" ? (
              <p className="em-body-sm mb-1 text-[var(--em-text-3)]">
                Tra poco:
              </p>
            ) : null}
            <ul className="flex flex-col">
              <SlotRow
                entry={adesso.entry}
                isoWeek={isoWeek}
                current={adesso.kind === "current"}
                editable
              />
            </ul>
            {remaining > 1 ? (
              <p className="em-body-sm mt-1 text-[var(--em-text-3)]">
                E altri {remaining - 1} slot oggi.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
