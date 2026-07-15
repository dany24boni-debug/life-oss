/**
 * lib/nlp-it — parser del linguaggio naturale italiano per il quick-add
 * (B2.1). Puro, deterministico, zero dipendenze, mai un throw.
 *
 * Uso:
 *   parse("domani alle 7 e mezza colazione #casa", {
 *     now: new Date(),
 *     timeZone: "Europe/Rome",
 *   })
 */

export { parse } from "./parse";
export { EVENING_DEFAULT } from "./matchers";
export type {
  Fragment,
  FragmentKind,
  Hhmm,
  IsoDate,
  ModuleHint,
  ParseOptions,
  ParseResult,
  Priority,
  RecurrenceValue,
} from "./types";
