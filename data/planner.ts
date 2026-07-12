/**
 * Planner settimanale (run-08 prompt 3) — la logica pura:
 *
 *   1. Settimane ISO come stringhe ("2026-W28"): l'identità di una
 *      settimana è civile e senza timezone — tutta l'aritmetica gira a
 *      mezzogiorno UTC su stringhe (stessa disciplina di data/streak.ts,
 *      mai toccata dai cambi d'ora); il "adesso" entra solo da
 *      `currentIsoWeek`, che passa da civilDayInZone (Europe/Rome
 *      iniettata dal chiamante).
 *   2. `computeWeekBoard` / `computeWeekStats`: il merge slot+check di
 *      una settimana e le statistiche (completamento per settimana +
 *      classifica dei più saltati — il "task che dimentichi di più").
 *
 * NOTA streak globale: i check del planner NON alimentano activityDays
 * — spuntare l'amministrazione della vita ("07:00 Palestra" è già
 * contata dalla sessione gym; "09:00 Deep work" dai task) la
 * double-conterebbe. Scelta documentata nel report.
 */

import type { IsoDay, IsoInstant, PlanSlot, SlotCheck } from "./schemas";
import { civilDayInZone, shiftDay } from "./streak";

/* ── Settimane ISO ───────────────────────────────────────────────────── */

export type IsoWeek = string;

const MS_WEEK = 7 * 86_400_000;

/**
 * La settimana ISO 8601 di un giorno civile: settimana che inizia il
 * lunedì, numerata dall'anno del SUO giovedì (regola ISO — è ciò che
 * manda il 1° gennaio 2027 in "2026-W53", testato).
 */
export function isoWeekOf(day: IsoDay): IsoWeek {
  const d = new Date(`${day}T12:00:00.000Z`);
  const weekdayFromMonday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekdayFromMonday + 3); // il giovedì
  const year = d.getUTCFullYear();
  const week = Math.round((d.getTime() - week1Monday(year)) / MS_WEEK) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Il lunedì (ms UTC a mezzogiorno) della settimana 1 dell'anno ISO. */
function week1Monday(isoYear: number): number {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4, 12));
  const weekdayFromMonday = (jan4.getUTCDay() + 6) % 7;
  jan4.setUTCDate(jan4.getUTCDate() - weekdayFromMonday);
  return jan4.getTime();
}

/** I 7 giorni civili (lun -> dom) della settimana ISO data. */
export function isoWeekDays(week: IsoWeek): IsoDay[] {
  const [y, w] = week.split("-W");
  const monday = new Date(
    week1Monday(Number(y)) + (Number(w) - 1) * MS_WEEK,
  )
    .toISOString()
    .slice(0, 10);
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

/** Settimana ISO +- n (attraversa i confini d'anno per costruzione). */
export function shiftIsoWeek(week: IsoWeek, n: number): IsoWeek {
  return isoWeekOf(shiftDay(isoWeekDays(week)[0], n * 7));
}

/** La settimana ISO di "adesso" nel fuso iniettato (Europe/Rome). */
export function currentIsoWeek(
  instant: IsoInstant | Date,
  timeZone: string,
): IsoWeek {
  return isoWeekOf(civilDayInZone(instant, timeZone));
}

/* ── Board della settimana ───────────────────────────────────────────── */

export type SlotState = "done" | "skipped" | null;

export type WeekSlotEntry = {
  slot: PlanSlot;
  check: SlotCheck | null;
  /** Lo stato effettivo (null = non ancora toccato questa settimana). */
  state: SlotState;
};

export type WeekBoardDay = {
  /** 1 = lunedì … 7 = domenica. */
  weekday: number;
  /** Il giorno civile di QUESTA settimana ISO. */
  date: IsoDay;
  slots: WeekSlotEntry[];
};

/**
 * Il merge puro: 7 giorni lun->dom con gli slot del piano (per orario,
 * poi sort_order, poi created_at) e il check di questa settimana.
 */
export function computeWeekBoard(
  slots: readonly PlanSlot[],
  checks: readonly SlotCheck[],
  isoWeek: IsoWeek,
): WeekBoardDay[] {
  const checkBySlot = new Map(checks.map((c) => [c.slot_id, c]));
  const days = isoWeekDays(isoWeek);
  return days.map((date, i) => {
    const weekday = i + 1;
    const daySlots = slots
      .filter((s) => s.weekday === weekday)
      .sort(
        (a, b) =>
          a.start_hhmm.localeCompare(b.start_hhmm) ||
          a.sort_order - b.sort_order ||
          a.created_at.localeCompare(b.created_at),
      )
      .map((slot) => {
        const check = checkBySlot.get(slot.id) ?? null;
        return { slot, check, state: check?.state ?? null };
      });
    return { weekday, date, slots: daySlots };
  });
}

/* ── Statistiche: completamento e "salti più spesso" ─────────────────── */

export type WeekStatsRow = {
  isoWeek: IsoWeek;
  /** Slot del piano che esistevano già in quella settimana. */
  total: number;
  done: number;
  /** Saltati: "saltato" esplicito + mai toccati nelle settimane CHIUSE. */
  skipped: number;
};

export type SkippedSlotRow = {
  slot: PlanSlot;
  /** Volte saltato (esplicito o silenzioso) nelle settimane chiuse. */
  missed: number;
  done: number;
  /** Settimane chiuse in cui lo slot esisteva. */
  weeks: number;
};

export type WeekStats = {
  /** Le ultime N settimane fino alla corrente inclusa, più vecchia prima. */
  weeks: WeekStatsRow[];
  /** Classifica dei più saltati (missed desc, poi titolo). */
  mostSkipped: SkippedSlotRow[];
};

/**
 * Statistiche pure sulle ultime N settimane (corrente inclusa):
 *   - per-settimana: fatti / totale (solo gli slot già esistenti allora
 *     — uno slot creato ieri non "manca" nelle settimane in cui non
 *     c'era); i salti della settimana CORRENTE contano solo se
 *     espliciti (la settimana non è finita);
 *   - classifica: sulle settimane CHIUSE, saltato = "saltato" esplicito
 *     O mai toccato — è il "task che dimentichi di più".
 */
export function computeWeekStats(
  slots: readonly PlanSlot[],
  checks: readonly SlotCheck[],
  currentWeek: IsoWeek,
  lastNWeeks: number,
): WeekStats {
  const weeksList: IsoWeek[] = [];
  for (let i = lastNWeeks - 1; i >= 0; i--) {
    weeksList.push(shiftIsoWeek(currentWeek, -i));
  }
  const checkBy = new Map(
    checks.map((c) => [`${c.slot_id}:${c.iso_week}`, c]),
  );

  const weeks: WeekStatsRow[] = weeksList.map((isoWeek) => {
    const sunday = isoWeekDays(isoWeek)[6];
    const existing = slots.filter((s) => s.created_at.slice(0, 10) <= sunday);
    const closed = isoWeek < currentWeek;
    let done = 0;
    let skipped = 0;
    for (const slot of existing) {
      const state = checkBy.get(`${slot.id}:${isoWeek}`)?.state ?? null;
      if (state === "done") done += 1;
      else if (state === "skipped" || (state === null && closed)) skipped += 1;
    }
    return { isoWeek, total: existing.length, done, skipped };
  });

  const rows = new Map<string, SkippedSlotRow>();
  for (const isoWeek of weeksList) {
    if (isoWeek >= currentWeek) continue; // solo settimane chiuse
    const sunday = isoWeekDays(isoWeek)[6];
    for (const slot of slots) {
      if (slot.created_at.slice(0, 10) > sunday) continue;
      const row = rows.get(slot.id) ?? { slot, missed: 0, done: 0, weeks: 0 };
      row.weeks += 1;
      const state = checkBy.get(`${slot.id}:${isoWeek}`)?.state ?? null;
      if (state === "done") row.done += 1;
      else row.missed += 1;
      rows.set(slot.id, row);
    }
  }
  const mostSkipped = [...rows.values()]
    .filter((r) => r.missed > 0)
    .sort(
      (a, b) =>
        b.missed - a.missed ||
        a.done - b.done ||
        a.slot.title.localeCompare(b.slot.title, "it"),
    );

  return { weeks, mostSkipped };
}
