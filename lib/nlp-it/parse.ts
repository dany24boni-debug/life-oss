/**
 * parse() — quick-add in italiano (B2.1). Puro e deterministico: `now` e
 * `timeZone` sono iniettati, la libreria non legge MAI l'ambiente; zero
 * dipendenze; non lancia mai (garbage in, titolo intero out).
 *
 * Regole di risoluzione (documentate qui, testate in parse.test.ts):
 *   - Per i valori singoli (data, orario, priorità) vince l'ULTIMO match
 *     nel testo; i match precedenti tornano testo del titolo, senza
 *     frammento ("domani anzi il 20" -> data il 20, "domani anzi" resta
 *     nel titolo).
 *   - I tag sono multi-valore: tutti consumati, dedupe case-insensitive
 *     mantenendo la prima grafia.
 *   - "stasera" porta l'orario di default 20:00 SOLO se vince la
 *     contesa data e non c'è un orario esplicito; il chip resta uno solo
 *     (stasera è un concetto unico: scartarlo scarta data e orario).
 *   - Il suggerimento modulo ("palestra" in testa) genera un frammento ma
 *     NON viene consumato: il titolo conserva la parola.
 *   - titolo = input meno gli span consumati, spazi normalizzati.
 */

import {
  addDays,
  isoWeekday,
  todayInTimeZone,
  toIso,
  type CivilDate,
} from "./civil";
import {
  displayDate,
  displayRecurrence,
  EVENING_DEFAULT,
  isoDate,
  matchDates,
  matchModule,
  matchPriorities,
  matchRecurrences,
  matchTags,
  matchTimes,
  type Span,
} from "./matchers";
import type {
  Fragment,
  ParseOptions,
  ParseResult,
  RecurrenceValue,
} from "./types";

export function parse(input: string, opts: ParseOptions): ParseResult {
  try {
    return parseInner(input, opts);
  } catch {
    // Contratto: mai un throw verso la UI. Qualsiasi imprevisto degrada
    // a "tutto titolo" — l'utente non perde mai il testo digitato.
    return { title: normalizeWhitespace(input), tags: [], fragments: [] };
  }
}

function parseInner(input: string, opts: ParseOptions): ParseResult {
  const today = todayInTimeZone(opts.now, opts.timeZone);

  // 1) Tag: non ambigui, tutti consumati.
  const tags = matchTags(input);

  // 2) Ricorrenze PRIMA di orari e date: "ogni lunedì" maschera il suo
  //    "lunedì" (che altrimenti diventerebbe una data), poi per ogni
  //    famiglia vince l'ultimo match nel testo.
  const tagSpans: Span[] = [...tags];
  const recurrences = matchRecurrences(input, tagSpans);
  const times = matchTimes(input, [...tagSpans, ...recurrences]);
  const dates = matchDates(input, today, [
    ...tagSpans,
    ...recurrences,
    ...times,
  ]);
  const priorities = matchPriorities(input);

  const winningRecurrence = recurrences.at(-1);
  const winningTime = times.at(-1);
  const winningDate = dates.at(-1);
  const winningPriority = priorities.at(-1);
  const moduleHint = matchModule(input);

  // 3) "stasera": orario implicito solo senza orario esplicito.
  const time =
    winningTime?.hhmm ??
    (winningDate?.eveningDefault ? EVENING_DEFAULT : undefined);

  // 3b) La regola detta il ritmo, la data la PRIMA occorrenza: con una
  //     data esplicita vince quella; senza, il primo giorno previsto
  //     dalla regola (oggi incluso — "ogni lunedì" di lunedì parte oggi).
  const date = winningDate
    ? isoDate(winningDate)
    : winningRecurrence
      ? firstScheduledDay(winningRecurrence.value, today)
      : undefined;

  // 4) Titolo: via gli span consumati (i perdenti restano testo).
  const consumed: Span[] = [
    ...tags,
    ...(winningRecurrence ? [winningRecurrence] : []),
    ...(winningTime ? [winningTime] : []),
    ...(winningDate ? [winningDate] : []),
    ...(winningPriority ? [winningPriority] : []),
  ];
  const title = normalizeWhitespace(removeSpans(input, consumed));

  // 5) Frammenti per i chip, ordinati per posizione nel testo.
  const fragments: Fragment[] = [
    ...tags.map((t) => frag("tag", t, `#${t.value}`)),
    ...(winningRecurrence
      ? [
          frag(
            "recurrence",
            winningRecurrence,
            displayRecurrence(winningRecurrence.value),
          ),
        ]
      : []),
    ...(winningTime ? [frag("time", winningTime, time ?? winningTime.hhmm)] : []),
    ...(winningDate ? [frag("date", winningDate, displayDate(winningDate))] : []),
    ...(winningPriority
      ? [frag("priority", winningPriority, `P${winningPriority.priority}`)]
      : []),
    ...(moduleHint ? [frag("module", moduleHint, "Palestra")] : []),
  ].sort((a, b) => a.start - b.start);

  return {
    title,
    ...(date && { date }),
    ...(time && { time }),
    ...(winningPriority && { priority: winningPriority.priority }),
    tags: dedupeTags(tags.map((t) => t.value)),
    ...(moduleHint && { moduleHint: moduleHint.hint }),
    ...(winningRecurrence && { recurrence: winningRecurrence.value }),
    fragments,
  };
}

/** Primo giorno previsto dalla regola, oggi INCLUSO. */
function firstScheduledDay(
  value: RecurrenceValue,
  today: CivilDate,
): string {
  if (value.freq === "daily") return toIso(today);
  const weekdays = value.weekdays ?? [];
  for (let i = 0; i <= 7; i++) {
    const candidate = addDays(today, i);
    if (weekdays.includes(isoWeekday(candidate))) return toIso(candidate);
  }
  return toIso(today);
}

function frag(
  kind: Fragment["kind"],
  span: Span,
  display: string,
): Fragment {
  return { kind, start: span.start, end: span.end, display };
}

function removeSpans(input: string, spans: Span[]): string {
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

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Dedupe case-insensitive, prima grafia vince, ordine di apparizione. */
function dedupeTags(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}
