"use client";

/**
 * Hook di schermo condivisi dal modulo Task: il giorno civile corrente
 * (con rollover a mezzanotte e al ritorno in foreground) e il breakpoint
 * per scegliere BottomSheet (touch) o Modal (desktop).
 */

import { useEffect, useState } from "react";
import type { DayString } from "@/ui/calendar-core";
import { APP_TIME_ZONE, todayInZone } from "./logic";

/**
 * "Oggi" nel fuso dell'app, aggiornato al cambio giorno: controllo ogni
 * minuto e a ogni ritorno di visibilità (l'app resta aperta per giorni
 * sul telefono in standby — il tab non deve svegliarsi su ieri).
 */
export function useToday(): DayString {
  const [today, setToday] = useState<DayString>(() =>
    todayInZone(new Date(), APP_TIME_ZONE),
  );

  useEffect(() => {
    const tick = () =>
      setToday((prev) => {
        const next = todayInZone(new Date(), APP_TIME_ZONE);
        return next === prev ? prev : next;
      });
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return today;
}

/**
 * true da md (768px) in su. Parte false anche sul server: al primo paint
 * desktop può comparire il layout touch per un frame — accettabile, evita
 * ogni mismatch di idratazione.
 */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return desktop;
}
