/**
 * Logica pura del quick-add eventi (B2.4) — il ParseResult del parser
 * italiano ridotto ai concetti che un evento capisce. Differenze
 * deliberate dal cugino task (documentate e testate):
 *   - contano solo i frammenti data/orario: priorità, tag e hint modulo
 *     NON esistono sugli eventi, quindi restano testo nel titolo;
 *   - senza data dal testo vale il giorno selezionato (chip attenuato
 *     dismissibile, stessa convenzione dei task);
 *   - la grammatica non ha l'orario di fine: con un inizio la fine è
 *     +1h (defaultEndTime, modificabile dalla scheda), senza orario
 *     l'evento è tutto il giorno.
 */

import type { DayString } from "@/ui/calendar-core";
import { parse } from "@/lib/nlp-it";
import type { EventCreate } from "@/data/schemas";
import {
  APP_TIME_ZONE,
  chipKey,
  dayHeading,
  DEFAULT_DATE_CHIP_KEY,
  type Chip,
} from "../_components/tasks/logic";
import { defaultEndTime } from "./agenda";

/** Il parse ridotto ai concetti evento: titolo, giorno, inizio. */
export type EffectiveEventParse = {
  title: string;
  date?: DayString;
  time?: string;
  chips: Chip[];
};

export function eventParse(
  input: string,
  now: Date,
  dismissed: ReadonlySet<string>,
  defaultDate: DayString,
  defaultDismissed: boolean,
  today: DayString,
): EffectiveEventParse | null {
  const text = input.trim();
  if (!text) return null;
  const result = parse(input, { now, timeZone: APP_TIME_ZONE });

  const relevant = result.fragments.filter(
    (f) => f.kind === "date" || f.kind === "time",
  );
  const active = relevant.filter((f) => !dismissed.has(chipKey(input, f)));
  const dateActive = active.some((f) => f.kind === "date");
  const hasTimeFragment = relevant.some((f) => f.kind === "time");
  const timeActive = hasTimeFragment
    ? active.some((f) => f.kind === "time")
    : dateActive && result.time !== undefined; // orario implicito di "stasera"

  // Solo i frammenti data/orario attivi vengono consumati dal titolo.
  const title = removeSpans(input, active).replace(/\s+/g, " ").trim();

  const chips: Chip[] = active.map((f) => ({
    key: chipKey(input, f),
    kind: f.kind,
    label: f.display,
  }));

  const out: EffectiveEventParse = {
    title,
    ...(dateActive && result.date !== undefined && { date: result.date }),
    ...(timeActive && result.time !== undefined && { time: result.time }),
    chips,
  };

  if (!out.date && !defaultDismissed) {
    out.date = defaultDate;
    out.chips = [
      ...out.chips,
      {
        key: DEFAULT_DATE_CHIP_KEY,
        kind: "date",
        label: dayHeading(defaultDate, today),
        muted: true,
      },
    ];
  }
  return out;
}

function removeSpans(
  input: string,
  spans: readonly { start: number; end: number }[],
): string {
  if (spans.length === 0) return input;
  const keep: string[] = [];
  let cursor = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    keep.push(input.slice(cursor, s.start), " ");
    cursor = s.end;
  }
  keep.push(input.slice(cursor));
  return keep.join("");
}

/** EffectiveEventParse (con date) -> payload di EventsRepo.create. */
export function toEventCreate(
  effective: EffectiveEventParse & { date: DayString },
): EventCreate {
  const start = effective.time ?? null;
  return {
    title: effective.title,
    date: effective.date,
    start_time: start,
    end_time: start ? defaultEndTime(start) : null,
    all_day: start === null,
  };
}
