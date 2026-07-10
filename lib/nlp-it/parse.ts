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

import { todayInTimeZone } from "./civil";
import {
  displayDate,
  EVENING_DEFAULT,
  isoDate,
  matchDates,
  matchModule,
  matchPriorities,
  matchTags,
  matchTimes,
  type Span,
} from "./matchers";
import type { Fragment, ParseOptions, ParseResult } from "./types";

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

  // 2) Orari e date: si raccolgono TUTTI i candidati (mascherati tra
  //    loro), poi per ciascuna famiglia vince l'ultimo nel testo.
  const tagSpans: Span[] = [...tags];
  const times = matchTimes(input, tagSpans);
  const dates = matchDates(input, today, [...tagSpans, ...times]);
  const priorities = matchPriorities(input);

  const winningTime = times.at(-1);
  const winningDate = dates.at(-1);
  const winningPriority = priorities.at(-1);
  const moduleHint = matchModule(input);

  // 3) "stasera": orario implicito solo senza orario esplicito.
  const time =
    winningTime?.hhmm ??
    (winningDate?.eveningDefault ? EVENING_DEFAULT : undefined);

  // 4) Titolo: via gli span consumati (i perdenti restano testo).
  const consumed: Span[] = [
    ...tags,
    ...(winningTime ? [winningTime] : []),
    ...(winningDate ? [winningDate] : []),
    ...(winningPriority ? [winningPriority] : []),
  ];
  const title = normalizeWhitespace(removeSpans(input, consumed));

  // 5) Frammenti per i chip, ordinati per posizione nel testo.
  const fragments: Fragment[] = [
    ...tags.map((t) => frag("tag", t, `#${t.value}`)),
    ...(winningTime ? [frag("time", winningTime, time ?? winningTime.hhmm)] : []),
    ...(winningDate ? [frag("date", winningDate, displayDate(winningDate))] : []),
    ...(winningPriority
      ? [frag("priority", winningPriority, `P${winningPriority.priority}`)]
      : []),
    ...(moduleHint ? [frag("module", moduleHint, "Palestra")] : []),
  ].sort((a, b) => a.start - b.start);

  return {
    title,
    ...(winningDate && { date: isoDate(winningDate) }),
    ...(time && { time }),
    ...(winningPriority && { priority: winningPriority.priority }),
    tags: dedupeTags(tags.map((t) => t.value)),
    ...(moduleHint && { moduleHint: moduleHint.hint }),
    fragments,
  };
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
