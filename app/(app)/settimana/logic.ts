/**
 * Logica pura della board settimanale — lo slot "adesso", i conteggi
 * del giorno, le etichette di settimana. Testata in logic.test.ts; la
 * UI non fa mai questa matematica.
 */

import { isoWeekDays, type IsoWeek, type WeekSlotEntry } from "@/data/planner";
import type { Hhmm } from "@/data/schemas";

/** Minuti da mezzanotte di un "HH:MM". */
export function hhmmToMinutes(hhmm: Hhmm): number {
  return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
}

/** "HH:MM" adesso nel fuso dato; fuso rotto degrada a UTC, mai un throw. */
export function hhmmInZone(now: Date, timeZone: string): Hhmm {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  };
  try {
    return new Intl.DateTimeFormat("it-IT", { ...opts, timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat("it-IT", { ...opts, timeZone: "UTC" }).format(
      now,
    );
  }
}

/**
 * Fine effettiva di uno slot in minuti: la sua end_hhmm, altrimenti
 * l'inizio dello slot successivo, altrimenti un'ora di cortesia.
 */
const DEFAULT_SLOT_MINUTES = 60;

function effectiveEnd(
  slot: WeekSlotEntry["slot"],
  nextStart: Hhmm | null,
): number {
  if (slot.end_hhmm !== null) return hhmmToMinutes(slot.end_hhmm);
  const start = hhmmToMinutes(slot.start_hhmm);
  const courtesy = start + DEFAULT_SLOT_MINUTES;
  if (nextStart === null) return courtesy;
  return Math.min(hhmmToMinutes(nextStart), courtesy);
}

export type NowSlot = {
  /** Lo slot in corso adesso (ember dot); null se nessuno. */
  currentId: string | null;
  /** Il prossimo slot di oggi non ancora iniziato; null se finiti. */
  nextId: string | null;
};

/**
 * Chi è "adesso": lo slot in corso (inizio <= ora < fine effettiva) e
 * il prossimo. Gli slot arrivano già ordinati per orario (weekBoard).
 */
export function findNowSlot(
  entries: readonly WeekSlotEntry[],
  now: Hhmm,
): NowSlot {
  const nowMin = hhmmToMinutes(now);
  let currentId: string | null = null;
  let nextId: string | null = null;
  for (let i = 0; i < entries.length; i++) {
    const slot = entries[i].slot;
    const start = hhmmToMinutes(slot.start_hhmm);
    if (start > nowMin) {
      nextId ??= slot.id;
      break;
    }
    const end = effectiveEnd(slot, entries[i + 1]?.slot.start_hhmm ?? null);
    if (nowMin < end) currentId = slot.id;
  }
  return { currentId, nextId };
}

/**
 * La voce per la card "Adesso" di Oggi: lo slot in corso, altrimenti il
 * prossimo, altrimenti null (giornata di piano finita o vuota).
 */
export function adessoEntry(
  entries: readonly WeekSlotEntry[],
  now: Hhmm,
): { kind: "current" | "next"; entry: WeekSlotEntry } | null {
  const { currentId, nextId } = findNowSlot(entries, now);
  if (currentId !== null) {
    const entry = entries.find((e) => e.slot.id === currentId);
    if (entry) return { kind: "current", entry };
  }
  if (nextId !== null) {
    const entry = entries.find((e) => e.slot.id === nextId);
    if (entry) return { kind: "next", entry };
  }
  return null;
}

/** Slot del giorno ancora senza esito (né fatti né saltati). */
export function remainingCount(entries: readonly WeekSlotEntry[]): number {
  return entries.filter((e) => e.state === null).length;
}

/** Percentuale intera fatta/totale; null senza slot (mai 0% finto). */
export function completionPct(done: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((done / total) * 100);
}

/**
 * Etichetta del range della settimana: "6–12 lug", oppure
 * "28 set – 4 ott" a cavallo di mese.
 */
export function weekRangeLabel(isoWeek: IsoWeek): string {
  const days = isoWeekDays(isoWeek);
  const first = days[0];
  const last = days[6];
  const month = (day: string) =>
    new Intl.DateTimeFormat("it-IT", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${day}T12:00:00.000Z`));
  const dayNum = (day: string) => String(Number(day.slice(8, 10)));
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${dayNum(first)}–${dayNum(last)} ${month(first)}`;
  }
  return `${dayNum(first)} ${month(first)} – ${dayNum(last)} ${month(last)}`;
}

/** Il prossimo stato al TAP: null → fatto; fatto → null; saltato → fatto. */
export function nextStateOnTap(
  state: "done" | "skipped" | null,
): "done" | null {
  return state === "done" ? null : "done";
}

/** Il prossimo stato al gesto LUNGO: saltato, o annulla se già saltato. */
export function nextStateOnLong(
  state: "done" | "skipped" | null,
): "skipped" | null {
  return state === "skipped" ? null : "skipped";
}

/* ── Lo slot "Palestra" conosce la scheda (run-11 P5a, CROSS-01) ─────── */

/** Fase 1, euristica sul titolo: niente schema, niente magia. */
export const GYM_SLOT_RE = /\b(palestra|gym|allenamento|workout)\b/i;

/**
 * Il giorno-scheda da mostrare accanto a uno slot palestra: quello col
 * weekday impostato uguale al giorno dello slot, altrimenti il
 * suggerito della rotazione (next-up). Titolo non-palestra o nessun
 * giorno: null — lo slot resta uno slot.
 */
export function gymDayForSlot(
  title: string,
  weekday: number,
  days: ReadonlyArray<{ id: string; name: string; weekday: number | null }>,
  nextUpId: string | null,
): { id: string; name: string } | null {
  if (!GYM_SLOT_RE.test(title)) return null;
  const byWeekday = days.find((d) => d.weekday === weekday);
  if (byWeekday !== undefined) {
    return { id: byWeekday.id, name: byWeekday.name };
  }
  const next = days.find((d) => d.id === nextUpId);
  return next !== undefined ? { id: next.id, name: next.name } : null;
}
