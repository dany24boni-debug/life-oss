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

// Il .catch è l'hardening P5c (run-13): il corpo che non arriva (offline
// al primo uso) degrada a null — mai la shell intera su error.tsx per
// un invito facoltativo.
const RitualBody = dynamic(
  () =>
    import("./ritual-body").catch(() => ({
      default: (() =>
        null) as unknown as (typeof import("./ritual-body"))["default"],
    })),
  {
    ssr: false,
    loading: () => null,
  },
);

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
