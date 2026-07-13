/**
 * Matcher del vocabolario v1 (B2.1). Ogni matcher produce candidati con
 * span sull'input originale; la risoluzione (ultimo vince, maschera degli
 * overlap, titolo residuo) sta in parse.ts.
 *
 * Nota tecnica sui confini di parola: `\b` di JavaScript è ASCII e
 * fallisce dopo le vocali accentate ("lunedì\b" non matcha mai a fine
 * parola). Qui i confini si fanno con un gruppo iniziale
 * `(^|[^lettera/cifra])` e un lookahead finale — niente lookbehind, così
 * il target ES2017 resta rispettato.
 */

import {
  addDays,
  daysInMonth,
  formatDayShortIt,
  isBefore,
  isoWeekday,
  isValidDate,
  toIso,
  type CivilDate,
} from "./civil";
import type { RecurrenceValue } from "./types";

export type Span = { start: number; end: number };

export type TagCandidate = Span & { value: string };
export type TimeCandidate = Span & { hhmm: string };
export type DateCandidate = Span & {
  day: CivilDate;
  /** true solo per "stasera": porta l'orario di default se non ce n'è uno. */
  eveningDefault?: boolean;
};
export type PriorityCandidate = Span & { priority: 1 | 2 | 3 };
export type ModuleCandidate = Span & { hint: "gym" };

/** L'orario implicito di "stasera" quando non c'è un orario esplicito. */
export const EVENING_DEFAULT: string = "20:00";

const L = "\\p{L}\\p{N}"; // classe lettera-o-cifra per i confini custom

function overlaps(spans: Span[], s: Span): boolean {
  return spans.some((x) => s.start < x.end && x.start < s.end);
}

// ============================================================
// Tag: #spesa, #università (lettere unicode, cifre, _ e -)
// ============================================================

export function matchTags(input: string): TagCandidate[] {
  const out: TagCandidate[] = [];
  const re = new RegExp(`(^|\\s)#([${L}_-]+)`, "gu");
  for (const m of input.matchAll(re)) {
    const start = m.index + m[1].length;
    out.push({ start, end: start + 1 + m[2].length, value: m[2] });
  }
  return out;
}

// ============================================================
// Orari
// ============================================================

/**
 * Tutti i candidati orario, in due forme:
 *  1. minuti espliciti — "18:30", "18.30", con prefisso opzionale
 *     "alle "/"h " consumato nello span;
 *  2. ora secca con prefisso obbligatorio — "alle 7", "h 18", estendibile
 *     con "e mezza" (:30) / "e un quarto" (:15).
 * Un numero nudo senza prefisso non è mai un orario.
 */
export function matchTimes(input: string, consumed: Span[]): TimeCandidate[] {
  const out: TimeCandidate[] = [];
  const taken: Span[] = [...consumed];

  // 1) minuti espliciti. Lookahead finale: niente lettere/cifre, niente
  //    ":" (18:30:00 non è un orario v1), niente ".5" (decimali) — ma il
  //    punto di fine frase ("alle 18:30.") resta fuori dallo span.
  const explicit = new RegExp(
    `(^|[^${L}])((?:alle\\s+|h\\s*)?([0-2]?\\d)[:.]([0-5]\\d))(?!:|[${L}]|[./]\\d)`,
    "giu",
  );
  for (const m of input.matchAll(explicit)) {
    const hour = Number(m[3]);
    if (hour > 23) continue;
    const start = m.index + m[1].length;
    const span = { start, end: start + m[2].length };
    if (overlaps(taken, span)) continue;
    taken.push(span);
    out.push({ ...span, hhmm: `${pad2(hour)}:${m[4]}` });
  }

  // 2) ora secca con "alle"/"h", suffisso "e mezza"/"e un quarto".
  const bare = new RegExp(
    `(^|[^${L}])((alle\\s+|h\\s*)([0-2]?\\d))(?!:|[${L}]|[./]\\d)`,
    "giu",
  );
  for (const m of input.matchAll(bare)) {
    const hour = Number(m[4]);
    if (hour > 23) continue;
    const start = m.index + m[1].length;
    let end = start + m[2].length;
    let minutes = "00";
    const suffix = /^\s+e\s+(mezza|un\s+quarto)(?![\p{L}\p{N}])/iu.exec(
      input.slice(end),
    );
    if (suffix) {
      minutes = suffix[1].toLowerCase() === "mezza" ? "30" : "15";
      end += suffix[0].length;
    }
    const span = { start, end };
    if (overlaps(taken, span)) continue;
    taken.push(span);
    out.push({ ...span, hhmm: `${pad2(hour)}:${minutes}` });
  }

  return out.sort((a, b) => a.start - b.start);
}

// ============================================================
// Date
// ============================================================

const WEEKDAY_FORMS: Array<{ re: string; iso: number }> = [
  { re: "luned[ìi]|lun", iso: 1 },
  { re: "marted[ìi]|mar", iso: 2 },
  { re: "mercoled[ìi]|mer", iso: 3 },
  { re: "gioved[ìi]|gio", iso: 4 },
  { re: "venerd[ìi]|ven", iso: 5 },
  { re: "sabato|sab", iso: 6 },
  { re: "domenica|dom", iso: 7 },
];

/**
 * Tutti i candidati data. Ordine di scansione: forme numeriche (più
 * specifiche) prima delle parole chiave, con maschera interna perché
 * "il 15/08" non produca anche "il 15". Convenzioni risolte qui:
 *   - settimana/weekend/"il N": prossima occorrenza STRETTAMENTE futura
 *   - "15/08": anno corrente, rotola avanti se già passata (oggi conta
 *     come presente, non passato) o se la data non esiste in quell'anno
 *     (29/02 -> primo anno bisestile utile)
 *   - "fine mese": ultimo giorno del mese corrente, anche se è oggi
 */
export function matchDates(
  input: string,
  today: CivilDate,
  consumed: Span[],
): DateCandidate[] {
  const out: DateCandidate[] = [];
  const taken: Span[] = [...consumed];
  const todayIso = isoWeekday(today);

  const push = (span: Span, day: CivilDate, eveningDefault?: boolean) => {
    if (overlaps(taken, span)) return;
    taken.push(span);
    out.push({ ...span, day, ...(eveningDefault && { eveningDefault }) });
  };

  // D1 — "15/08", "15/8", prefisso "il " opzionale, mai dentro 15/08/2027.
  const ddmm = new RegExp(
    `(^|[^${L}])((?:il\\s+)?([0-3]?\\d)\\/([01]?\\d))(?!\\/?\\d|[${L}]|\\.\\d)`,
    "giu",
  );
  for (const m of input.matchAll(ddmm)) {
    const d = Number(m[3]);
    const mo = Number(m[4]);
    if (d < 1 || mo < 1 || mo > 12) continue;
    let day: CivilDate | null = null;
    for (let y = today.y; y <= today.y + 8; y++) {
      if (isValidDate(y, mo, d) && !isBefore({ y, m: mo, d }, today)) {
        day = { y, m: mo, d };
        break;
      }
    }
    if (!day) continue; // 30/02, 31/04: non esiste mai -> resta titolo
    const start = m.index + m[1].length;
    push({ start, end: start + m[2].length }, day);
  }

  // D2 — "tra N giorni" / "tra 1 giorno".
  const traN = new RegExp(
    `(^|[^${L}])(tra\\s+(\\d{1,3})\\s+giorn[oi])(?![${L}])`,
    "giu",
  );
  for (const m of input.matchAll(traN)) {
    const start = m.index + m[1].length;
    push({ start, end: start + m[2].length }, addDays(today, Number(m[3])));
  }

  // D3 — "il 15": prossima occorrenza del giorno-del-mese, strettamente
  // futura, saltando i mesi che non hanno quel giorno ("il 31").
  const ilN = new RegExp(`(^|[^${L}])(il\\s+([0-3]?\\d))(?!:|[${L}]|[./]\\d)`, "giu");
  for (const m of input.matchAll(ilN)) {
    const n = Number(m[3]);
    if (n < 1 || n > 31) continue;
    let y = today.y;
    let mo = today.m;
    // Questo mese solo se il giorno è ancora davanti a noi.
    if (n <= today.d || n > daysInMonth(y, mo)) {
      do {
        mo += 1;
        if (mo > 12) {
          mo = 1;
          y += 1;
        }
      } while (n > daysInMonth(y, mo));
    }
    const start = m.index + m[1].length;
    push({ start, end: start + m[2].length }, { y, m: mo, d: n });
  }

  // D4 — parole chiave. Ordine: composti prima dei semplici.
  const keyword = (
    pattern: string,
    resolve: () => { day: CivilDate; eveningDefault?: boolean },
  ) => {
    const re = new RegExp(`(^|[^${L}])(${pattern})(?![${L}])`, "giu");
    for (const m of input.matchAll(re)) {
      const start = m.index + m[1].length;
      const { day, eveningDefault } = resolve();
      push({ start, end: start + m[2].length }, day, eveningDefault);
    }
  };

  keyword("dopodomani", () => ({ day: addDays(today, 2) }));
  keyword("domani", () => ({ day: addDays(today, 1) }));
  keyword("oggi", () => ({ day: today }));
  keyword("stasera", () => ({ day: today, eveningDefault: true }));
  keyword("fine\\s+mese", () => ({
    day: { y: today.y, m: today.m, d: daysInMonth(today.y, today.m) },
  }));
  // "weekend" = prossimo sabato, stessa convenzione dei giorni di settimana.
  keyword("weekend", () => ({
    day: addDays(today, deltaToWeekday(todayIso, 6)),
  }));
  for (const wd of WEEKDAY_FORMS) {
    keyword(wd.re, () => ({
      day: addDays(today, deltaToWeekday(todayIso, wd.iso)),
    }));
  }

  return out.sort((a, b) => a.start - b.start);
}

/** Distanza in giorni alla prossima occorrenza STRETTAMENTE futura. */
function deltaToWeekday(todayIso: number, targetIso: number): number {
  return ((targetIso - todayIso + 6) % 7) + 1;
}

// ============================================================
// Ricorrenze (run-09): "ogni giorno", "ogni lunedì", "ogni lun e
// gio", "ogni lun, mer e ven", "nei feriali". La regola detta il
// ritmo; la data (esplicita o derivata) la prima occorrenza —
// risoluzione in parse.ts.
// ============================================================

export type RecurrenceCandidate = Span & { value: RecurrenceValue };

const WD_PATTERN = WEEKDAY_FORMS.map((w) => w.re).join("|");

export function matchRecurrences(
  input: string,
  consumed: Span[],
): RecurrenceCandidate[] {
  const out: RecurrenceCandidate[] = [];
  const taken: Span[] = [...consumed];

  const push = (span: Span, value: RecurrenceValue) => {
    if (overlaps(taken, span)) return;
    taken.push(span);
    out.push({ ...span, value });
  };

  // R1 — "ogni giorno".
  const daily = new RegExp(`(^|[^${L}])(ogni\\s+giorno)(?![${L}])`, "giu");
  for (const m of input.matchAll(daily)) {
    const start = m.index + m[1].length;
    push({ start, end: start + m[2].length }, { freq: "daily" });
  }

  // R2 — "nei feriali" (lun-ven).
  const feriali = new RegExp(`(^|[^${L}])(nei\\s+feriali)(?![${L}])`, "giu");
  for (const m of input.matchAll(feriali)) {
    const start = m.index + m[1].length;
    push(
      { start, end: start + m[2].length },
      { freq: "weekly", weekdays: [1, 2, 3, 4, 5] },
    );
  }

  // R3 — "ogni <wd>" con liste ("e" o virgole). Le forme piene stanno
  // prima delle abbreviazioni dentro OGNI alternativa di WEEKDAY_FORMS,
  // quindi "lunedì" non si ferma mai a "lun".
  const list = new RegExp(
    `(^|[^${L}])(ogni\\s+(?:${WD_PATTERN})(?:(?:\\s*,\\s*|\\s+e\\s+)(?:${WD_PATTERN}))*)(?![${L}])`,
    "giu",
  );
  for (const m of input.matchAll(list)) {
    const start = m.index + m[1].length;
    const weekdays = extractWeekdays(m[2]);
    if (weekdays.length === 0) continue;
    push(
      { start, end: start + m[2].length },
      { freq: "weekly", weekdays },
    );
  }

  return out.sort((a, b) => a.start - b.start);
}

/** I giorni ISO citati nel testo della lista, ordinati e senza doppi. */
function extractWeekdays(listText: string): number[] {
  const found = new Set<number>();
  for (const wd of WEEKDAY_FORMS) {
    const re = new RegExp(`(^|[^${L}])(${wd.re})(?![${L}])`, "giu");
    if (re.test(listText)) found.add(wd.iso);
  }
  return [...found].sort((a, b) => a - b);
}

const WEEKDAY_ABBREV_IT = ["lun", "mar", "mer", "gio", "ven", "sab", "dom"];

/** Etichetta del chip: "ogni giorno", "nei feriali", "ogni lun e gio". */
export function displayRecurrence(value: RecurrenceValue): string {
  if (value.freq === "daily") return "ogni giorno";
  const days = [...new Set(value.weekdays ?? [])].sort((a, b) => a - b);
  if (days.length === 5 && days.every((d, i) => d === i + 1)) {
    return "nei feriali";
  }
  const names = days.map((d) => WEEKDAY_ABBREV_IT[d - 1]);
  if (names.length === 1) return `ogni ${names[0]}`;
  return `ogni ${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}

// ============================================================
// Priorità: run di "!" — 1 -> P3, 2 -> P2, 3+ -> P1
// ============================================================

export function matchPriorities(input: string): PriorityCandidate[] {
  const out: PriorityCandidate[] = [];
  for (const m of input.matchAll(/!+/g)) {
    const n = m[0].length;
    out.push({
      start: m.index,
      end: m.index + n,
      priority: n >= 3 ? 1 : n === 2 ? 2 : 3,
    });
  }
  return out;
}

// ============================================================
// Modulo: "palestra" in testa suggerisce Gym (chip visibile, parola
// NON consumata — mai inghiottita in silenzio)
// ============================================================

export function matchModule(input: string): ModuleCandidate | undefined {
  const m = new RegExp(`^(\\s*)(palestra)(?![${L}])`, "iu").exec(input);
  if (!m) return undefined;
  return {
    start: m[1].length,
    end: m[1].length + m[2].length,
    hint: "gym",
  };
}

// ============================================================
// Display dei chip
// ============================================================

export function displayDate(c: DateCandidate): string {
  return formatDayShortIt(c.day);
}

export function isoDate(c: DateCandidate): string {
  return toIso(c.day);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
