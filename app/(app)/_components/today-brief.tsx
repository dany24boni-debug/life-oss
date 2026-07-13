"use client";

/**
 * La riga del buongiorno su Oggi (run-09 prompt 4): UNA frase quieta,
 * senza chrome, composta da dati VERI (composeBrief, deterministica e
 * testata). Con zero dati non rende nulla.
 *
 * Rifinitura LLM facoltativa (solo con account E chiave server):
 * una chiamata al giorno a /api/brief con lo snapshot aggregato (mai
 * dump di tabelle), cache per-giorno in localStorage, fallback
 * SILENZIOSO alla frase deterministica su qualunque intoppo — la
 * frase deterministica è il prodotto, l'LLM è condimento.
 */

import { useEffect, useRef, useState } from "react";
import { composeBrief, type BriefSnapshot } from "@/data/brief";
import { WATER_HABIT_ID } from "@/data/habits";
import {
  useDayDiet,
  useGymSessionsByDay,
  useHabitBoard,
  useNextUpDay,
  useOverdueTasks,
  useStreak,
  useTasksSummary,
} from "@/data/hooks";
import { adessoEntry, hhmmInZone } from "../settimana/logic";
import { APP_TIME_ZONE } from "./tasks/logic";
import { useToday } from "./tasks/screen-hooks";
import { useTodayPlanSlots } from "./today-adesso";

const CACHE_PREFIX = "lifeos.brief.";
const MAX_LINE_CHARS = 200;

export function TodayBrief({ authed }: { authed: boolean }) {
  const today = useToday();
  const summary = useTasksSummary(today);
  const overdue = useOverdueTasks(today);
  const nextUp = useNextUpDay();
  const sessions = useGymSessionsByDay(today);
  const { hasPlan, entries } = useTodayPlanSlots();
  const board = useHabitBoard(today);
  const streak = useStreak(today, APP_TIME_ZONE);
  const dayDiet = useDayDiet(today);
  // Basta l'ora del mount: la riga è del mattino, non un orologio.
  const [nowHhmm] = useState(() => hhmmInZone(new Date(), APP_TIME_ZONE));

  const loaded =
    summary !== undefined &&
    overdue !== undefined &&
    nextUp !== undefined &&
    sessions !== undefined &&
    hasPlan !== undefined &&
    entries !== undefined &&
    board !== undefined &&
    streak !== undefined &&
    dayDiet !== undefined;

  let snapshot: BriefSnapshot | null = null;
  if (loaded) {
    const adesso =
      hasPlan === true && entries.length > 0
        ? adessoEntry(entries, nowHhmm)
        : null;
    const water = board.find((e) => e.habit.id === WATER_HABIT_ID) ?? null;
    snapshot = {
      date: today,
      tasksOpen: Math.max(0, summary.total - summary.done),
      tasksOverdue: overdue.length,
      gymNextUp: nextUp?.name ?? null,
      gymDoneToday: sessions.some((s) => s.finished_at !== null),
      planSlot: adesso
        ? {
            title: adesso.entry.slot.title,
            start_hhmm: adesso.entry.slot.start_hhmm,
            now: adesso.kind === "current",
          }
        : null,
      meals:
        dayDiet.meals.length > 0
          ? {
              eaten: dayDiet.meals.filter((m) => m.eaten).length,
              total: dayDiet.meals.length,
            }
          : null,
      water: water
        ? { ml: water.value, targetMl: water.target }
        : null,
      streak: { current: streak.current, todayCounts: streak.todayCounts },
    };
  }

  const deterministic = snapshot ? composeBrief(snapshot) : null;
  const polished = usePolishedLine(authed, today, snapshot, deterministic);

  const line = polished ?? deterministic;
  if (line === null) return null;
  return (
    <p className="em-body-sm mt-2 text-[var(--em-text-2)]">{line}</p>
  );
}

/**
 * La rifinitura: una chiamata al giorno, cache per-giorno, fallback
 * silenzioso. Qualsiasi risposta strana (vuota, troppo lunga, non
 * stringa) viene ignorata: la frase deterministica resta il prodotto.
 */
/** La riga del giorno già in cache (SSR-safe, privacy-mode-safe). */
function readCachedLine(today: string): string | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(`${CACHE_PREFIX}${today}`);
  } catch {
    return null;
  }
}

function usePolishedLine(
  authed: boolean,
  today: string,
  snapshot: BriefSnapshot | null,
  deterministic: string | null,
): string | null {
  // La cache del giorno si legge nell'initializer (mai setState sincroni
  // negli effetti — l'idioma dei run 07/08).
  const [polished, setPolished] = useState<string | null>(() =>
    readCachedLine(today),
  );
  const requested = useRef(false);

  useEffect(() => {
    if (!authed || deterministic === null || snapshot === null) return;
    if (polished !== null || requested.current) return;
    requested.current = true;

    const key = `${CACHE_PREFIX}${today}`;
    try {
      // Le righe dei giorni passati non servono più: si potano.
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX) && k !== key) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // localStorage indisponibile (privacy mode): si vive di deterministico.
    }

    void fetch("/api/brief", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { line?: unknown } | null) => {
        const line = data?.line;
        if (
          typeof line === "string" &&
          line.trim() !== "" &&
          line.length <= MAX_LINE_CHARS
        ) {
          setPolished(line.trim());
          try {
            localStorage.setItem(key, line.trim());
          } catch {
            // Senza cache chiamerà di nuovo domani: accettabile.
          }
        }
      })
      .catch(() => {
        // Fallback silenzioso: la frase deterministica è già a schermo.
      });
  }, [authed, deterministic, snapshot, today, polished]);

  return polished;
}
