"use client";

/**
 * Shell del rituale del mattino (run-11 P2): SOLO i gate di visibilità
 * — idratazione, congedo del giorno, giornata già pianificata — e il
 * corpo caricato on-demand con `next/dynamic`. È il compromesso del
 * budget di Oggi: la home paga ~1 kB per la shell, i ~10 kB dei quattro
 * passi arrivano solo nelle giornate in cui la card esiste davvero.
 * Prima sezione di Oggi ma mai un cancello: qualunque cosa succeda qui,
 * il resto della home rende identico.
 */

import dynamic from "next/dynamic";
import type { GoogleAgendaEvent } from "../../calendar/agenda";
import { useToday } from "../tasks/screen-hooks";
import { useRitualDay } from "./ritual-store";

const RitualBody = dynamic(() => import("./ritual-body"), {
  ssr: false,
  loading: () => null,
});

export function TodayRitual({
  google,
}: {
  google: readonly GoogleAgendaEvent[];
}) {
  const today = useToday();
  const ritual = useRitualDay(today);

  // undefined = non ancora idratati (il server non conosce localStorage).
  if (ritual === undefined) return null;
  if (ritual?.dismissed === true || ritual?.planned_at !== undefined) {
    return null;
  }
  return <RitualBody today={today} google={google} />;
}
