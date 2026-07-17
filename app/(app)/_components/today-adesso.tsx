"use client";

/**
 * Gli hook condivisi della home sul piano del giorno e sull'orologio
 * (run-08 prompt 4, rifuso dal run-11 P3): la card "Adesso" è CONFLUITA
 * nella timeline di Oggi (`today-timeline.tsx`, CROSS-05) — qui restano
 * `useTodayPlanSlots` (gli slot di oggi del piano attivo, condiviso da
 * timeline, brief e tile "Piano": stessa query, mai due verità) e
 * `useNowHhmm` (l'orologio al minuto, condiviso col rituale).
 */

import { isoWeekOf } from "@/data/planner";
import type { WeekSlotEntry } from "@/data/planner";
import { useActiveWeekPlan, useWeekBoard } from "@/data/hooks";
import { hhmmInZone } from "../settimana/logic";
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

/** Orologio al minuto della home (condiviso col rituale, run-11 P2). */
export function useNowHhmm(): string {
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

