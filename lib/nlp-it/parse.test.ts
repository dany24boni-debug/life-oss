import { describe, expect, it } from "vitest";
import { parse } from "./parse";
import type { ParseResult } from "./types";

/**
 * Istante fisso per tutta la tabella: venerdì 10 luglio 2026, 12:00 a
 * Roma (10:00Z). `now` e timezone sono SEMPRE iniettati — il parser non
 * legge mai l'ambiente, quindi questi test sono deterministici ovunque
 * girino.
 */
const NOW = new Date("2026-07-10T10:00:00Z");
const TZ = "Europe/Rome";

function p(input: string, now: Date = NOW, timeZone: string = TZ) {
  return parse(input, { now, timeZone });
}

type Expected = Partial<
  Pick<ParseResult, "title" | "date" | "time" | "priority" | "moduleHint">
> & { tags?: string[] };

const CASES: Array<{ name: string; input: string; want: Expected }> = [
  // ── Date: parole chiave ─────────────────────────────────────────────
  {
    name: "oggi",
    input: "oggi comprare latte",
    want: { title: "comprare latte", date: "2026-07-10" },
  },
  {
    name: "domani",
    input: "domani chiamare mamma",
    want: { title: "chiamare mamma", date: "2026-07-11" },
  },
  {
    name: "dopodomani (non confuso con domani)",
    input: "dopodomani riunione",
    want: { title: "riunione", date: "2026-07-12" },
  },
  {
    name: "stasera: data oggi + orario default 20:00",
    input: "stasera film",
    want: { title: "film", date: "2026-07-10", time: "20:00" },
  },
  {
    name: "stasera con orario esplicito: niente default",
    input: "stasera alle 22 film",
    want: { title: "film", date: "2026-07-10", time: "22:00" },
  },
  {
    name: "fine mese",
    input: "fine mese report",
    want: { title: "report", date: "2026-07-31" },
  },
  {
    name: "weekend = prossimo sabato",
    input: "weekend gita al lago",
    want: { title: "gita al lago", date: "2026-07-11" },
  },
  // ── Date: giorni della settimana (prossima occorrenza, futura) ─────
  {
    name: "lunedì con accento",
    input: "lunedì lezione",
    want: { title: "lezione", date: "2026-07-13" },
  },
  {
    name: "lunedi senza accento",
    input: "lunedi lezione",
    want: { title: "lezione", date: "2026-07-13" },
  },
  {
    name: "LUNEDÌ maiuscolo accentato",
    input: "LUNEDÌ lezione",
    want: { title: "lezione", date: "2026-07-13" },
  },
  {
    name: "abbreviazione lun",
    input: "lun lezione",
    want: { title: "lezione", date: "2026-07-13" },
  },
  {
    name: "venerdì detto di venerdì = +7, mai oggi",
    input: "venerdì riunione",
    want: { title: "riunione", date: "2026-07-17" },
  },
  {
    name: "ven abbreviato",
    input: "ven riunione",
    want: { title: "riunione", date: "2026-07-17" },
  },
  {
    name: "sab abbreviato",
    input: "sab spesa grossa",
    want: { title: "spesa grossa", date: "2026-07-11" },
  },
  {
    name: "dom è domenica, non domani",
    input: "dom pranzo dai nonni",
    want: { title: "pranzo dai nonni", date: "2026-07-12" },
  },
  {
    name: "mercoledì in mezzo alla frase",
    input: "portare la macchina mercoledì dal meccanico",
    want: { title: "portare la macchina dal meccanico", date: "2026-07-15" },
  },
  // ── Date: forme numeriche ───────────────────────────────────────────
  {
    name: "tra N giorni",
    input: "tra 3 giorni tagliando",
    want: { title: "tagliando", date: "2026-07-13" },
  },
  {
    name: "tra 1 giorno (singolare)",
    input: "tra 1 giorno scadenza",
    want: { title: "scadenza", date: "2026-07-11" },
  },
  {
    name: "il 15: questo mese se futuro",
    input: "il 15 pagare bolletta",
    want: { title: "pagare bolletta", date: "2026-07-15" },
  },
  {
    name: "il 10 detto il 10: mese prossimo (strettamente futuro)",
    input: "il 10 affitto",
    want: { title: "affitto", date: "2026-08-10" },
  },
  {
    name: "il 31: luglio ce l'ha",
    input: "il 31 stipendio",
    want: { title: "stipendio", date: "2026-07-31" },
  },
  {
    name: "15/08 anno corrente",
    input: "15/08 grigliata",
    want: { title: "grigliata", date: "2026-08-15" },
  },
  {
    name: "15/8 mese a una cifra",
    input: "15/8 grigliata",
    want: { title: "grigliata", date: "2026-08-15" },
  },
  {
    name: "10/07 è oggi: resta quest'anno",
    input: "10/07 bilancio",
    want: { title: "bilancio", date: "2026-07-10" },
  },
  {
    name: "09/07 è passata: rotola all'anno prossimo",
    input: "09/07 anniversario",
    want: { title: "anniversario", date: "2027-07-09" },
  },
  {
    name: "29/02 salta al primo bisestile utile",
    input: "29/02 scherzo",
    want: { title: "scherzo", date: "2028-02-29" },
  },
  {
    name: "il 15/08 consumato intero (il incluso)",
    input: "il 15/08 grigliata",
    want: { title: "grigliata", date: "2026-08-15" },
  },
  {
    name: "31/04 non esiste mai: resta titolo",
    input: "31/04 fantasma",
    want: { title: "31/04 fantasma", date: undefined },
  },
  {
    name: "15/08/2027 con anno esplicito: fuori grammatica v1, resta titolo",
    input: "15/08/2027 fuori spec",
    want: { title: "15/08/2027 fuori spec", date: undefined },
  },
  // ── Conflitti: l'ultima data vince, la precedente torna titolo ─────
  {
    name: "due date: vince l'ultima nel testo",
    input: "domani anzi il 20 chiama idraulico",
    want: { title: "domani anzi chiama idraulico", date: "2026-07-20" },
  },
  {
    name: "stasera perdente non regala il suo orario default",
    input: "stasera anzi domani cinema",
    want: { title: "stasera anzi cinema", date: "2026-07-11", time: undefined },
  },
  // ── Orari ───────────────────────────────────────────────────────────
  {
    name: "HH:MM",
    input: "cena 18:30",
    want: { title: "cena", time: "18:30", date: undefined },
  },
  {
    name: "HH.MM col punto",
    input: "cena 18.30",
    want: { title: "cena", time: "18:30" },
  },
  {
    name: "alle 7 = 07:00",
    input: "alle 7 sveglia",
    want: { title: "sveglia", time: "07:00" },
  },
  {
    name: "alle 19",
    input: "alle 19 aperitivo",
    want: { title: "aperitivo", time: "19:00" },
  },
  {
    name: "h 18",
    input: "h 18 richiamare ufficio",
    want: { title: "richiamare ufficio", time: "18:00" },
  },
  {
    name: "alle 20:30 consumato con il prefisso",
    input: "cena con Marco alle 20:30",
    want: { title: "cena con Marco", time: "20:30" },
  },
  {
    name: "e mezza",
    input: "domani alle 7 e mezza colazione",
    want: { title: "colazione", date: "2026-07-11", time: "07:30" },
  },
  {
    name: "e un quarto",
    input: "alle 9 e un quarto meeting",
    want: { title: "meeting", time: "09:15" },
  },
  {
    name: "ora impossibile: nessun orario",
    input: "alle 25 numeri",
    want: { title: "alle 25 numeri", time: undefined },
  },
  {
    name: "numero nudo senza prefisso non è un orario",
    input: "comprare 7 mele",
    want: { title: "comprare 7 mele", time: undefined },
  },
  {
    name: "due orari: vince l'ultimo, il primo torna titolo",
    input: "alle 9 o alle 11 call",
    want: { title: "alle 9 o call", time: "11:00" },
  },
  // ── Priorità ────────────────────────────────────────────────────────
  {
    name: "!!! = P1",
    input: "consegna tesi!!!",
    want: { title: "consegna tesi", priority: 1 },
  },
  {
    name: "!! = P2",
    input: "pagare assicurazione!!",
    want: { title: "pagare assicurazione", priority: 2 },
  },
  {
    name: "! = P3",
    input: "annaffiare le piante!",
    want: { title: "annaffiare le piante", priority: 3 },
  },
  {
    name: "run più lungo di 3 resta P1 e viene consumato intero",
    input: "urgentissimo!!!! davvero",
    want: { title: "urgentissimo davvero", priority: 1 },
  },
  {
    name: "più run: vince l'ultimo, il primo resta punteggiatura",
    input: "ciao! fai la spesa!!",
    want: { title: "ciao! fai la spesa", priority: 2 },
  },
  // ── Tag ─────────────────────────────────────────────────────────────
  {
    name: "un tag",
    input: "#spesa latte e uova",
    want: { title: "latte e uova", tags: ["spesa"] },
  },
  {
    name: "più tag, anche in mezzo",
    input: "comprare #spesa #casa pane",
    want: { title: "comprare pane", tags: ["spesa", "casa"] },
  },
  {
    name: "tag con lettere unicode accentate",
    input: "#università lezione di analisi",
    want: { title: "lezione di analisi", tags: ["università"] },
  },
  {
    name: "tag duplicati dedupe case-insensitive",
    input: "#uni ripasso #Uni",
    want: { title: "ripasso", tags: ["uni"] },
  },
  // ── Modulo ──────────────────────────────────────────────────────────
  {
    name: "palestra in testa: hint gym, parola NON consumata",
    input: "palestra gambe alle 18",
    want: {
      title: "palestra gambe",
      time: "18:00",
      moduleHint: "gym",
    },
  },
  {
    name: "Palestra maiuscolo",
    input: "Palestra push day",
    want: { title: "Palestra push day", moduleHint: "gym" },
  },
  {
    name: "palestra non in testa: nessun hint",
    input: "andare in palestra",
    want: { title: "andare in palestra", moduleHint: undefined },
  },
  // ── Robustezza ──────────────────────────────────────────────────────
  {
    name: "garbage: tutto titolo, mai un throw",
    input: "xyz 99/99 boh",
    want: { title: "xyz 99/99 boh", date: undefined, time: undefined },
  },
  {
    name: "stringa vuota",
    input: "",
    want: { title: "" },
  },
  {
    name: "solo spazi",
    input: "   ",
    want: { title: "" },
  },
  {
    name: "spazi multipli normalizzati",
    input: "  domani   fare    ordine  ",
    want: { title: "fare ordine", date: "2026-07-11" },
  },
  {
    name: "tutto insieme",
    input: "palestra domani alle 7 e mezza #gym spinta!!!",
    want: {
      title: "palestra spinta",
      date: "2026-07-11",
      time: "07:30",
      priority: 1,
      tags: ["gym"],
      moduleHint: "gym",
    },
  },
];

describe("parse — tabella v1", () => {
  for (const c of CASES) {
    it(c.name, () => {
      const got = p(c.input);
      if ("title" in c.want) expect(got.title).toBe(c.want.title);
      expect(got.date).toBe(c.want.date);
      expect(got.time).toBe(c.want.time);
      expect(got.priority).toBe(c.want.priority);
      expect(got.moduleHint).toBe(c.want.moduleHint);
      if (c.want.tags) expect(got.tags).toEqual(c.want.tags);
      else expect(got.tags).toEqual([]);
    });
  }
});

describe("parse — frammenti (span sull'input originale)", () => {
  it("span esatti e display dei chip", () => {
    const input = "domani #uni alle 9 studio !!";
    const got = p(input);
    expect(got.fragments).toEqual([
      { kind: "date", start: 0, end: 6, display: "sab 11 lug" },
      { kind: "tag", start: 7, end: 11, display: "#uni" },
      { kind: "time", start: 12, end: 18, display: "09:00" },
      { kind: "priority", start: 26, end: 28, display: "P2" },
    ]);
    expect(got.title).toBe("studio");
    // Gli span citano davvero l'input originale.
    expect(input.slice(0, 6)).toBe("domani");
    expect(input.slice(7, 11)).toBe("#uni");
    expect(input.slice(12, 18)).toBe("alle 9");
    expect(input.slice(26, 28)).toBe("!!");
  });

  it("frammento module presente ma parola non consumata", () => {
    const got = p("palestra domani alle 7 e mezza #gym spinta!!!");
    expect(got.fragments).toEqual([
      { kind: "module", start: 0, end: 8, display: "Palestra" },
      { kind: "date", start: 9, end: 15, display: "sab 11 lug" },
      { kind: "time", start: 16, end: 30, display: "07:30" },
      { kind: "tag", start: 31, end: 35, display: "#gym" },
      { kind: "priority", start: 42, end: 45, display: "P1" },
    ]);
    expect(got.title).toBe("palestra spinta");
  });

  it("con due date c'è UN solo frammento data (il vincente)", () => {
    const got = p("domani anzi il 20 chiama idraulico");
    const dateFrags = got.fragments.filter((f) => f.kind === "date");
    expect(dateFrags).toHaveLength(1);
    expect(dateFrags[0].display).toBe("lun 20 lug");
  });

  it("stasera: un solo frammento (data), l'orario default sta nel result", () => {
    const got = p("stasera film");
    expect(got.fragments.map((f) => f.kind)).toEqual(["date"]);
    expect(got.time).toBe("20:00");
  });
});

describe("parse — timezone del giorno civile", () => {
  it("stesso istante, 'oggi' diverso per zona", () => {
    const instant = new Date("2026-07-10T22:30:00Z");
    expect(p("oggi x", instant, "Europe/Rome").date).toBe("2026-07-11");
    expect(p("oggi x", instant, "America/New_York").date).toBe("2026-07-10");
  });

  it("timezone invalida: degrada a UTC, mai un throw", () => {
    const got = p("domani x", new Date("2026-07-10T10:00:00Z"), "Marte/Olympus");
    expect(got.date).toBe("2026-07-11");
  });
});

describe("parse — confini DST Europe/Rome (giorno civile sempre +1)", () => {
  it("domani attraverso l'entrata in ora legale (marzo)", () => {
    // Sab 28 mar 2026, 13:00 CET: domani è IL giorno del cambio (23 ore).
    expect(p("domani x", new Date("2026-03-28T12:00:00Z")).date).toBe(
      "2026-03-29",
    );
    // Dom 29 mar (giorno da 23 ore, ora CEST): domani resta +1 civile.
    expect(p("domani x", new Date("2026-03-29T12:00:00Z")).date).toBe(
      "2026-03-30",
    );
  });

  it("domani attraverso l'uscita dall'ora legale (ottobre)", () => {
    // Sab 24 ott 2026: domani è il giorno da 25 ore.
    expect(p("domani x", new Date("2026-10-24T12:00:00Z")).date).toBe(
      "2026-10-25",
    );
    expect(p("domani x", new Date("2026-10-25T12:00:00Z")).date).toBe(
      "2026-10-26",
    );
  });

  it("giorno della settimana che scavalca il cambio d'ora", () => {
    // Sab 28 mar: lunedì cade oltre il cambio, +2 civili esatti.
    expect(p("lunedì x", new Date("2026-03-28T12:00:00Z")).date).toBe(
      "2026-03-30",
    );
  });
});

describe("parse — rollover di fine anno", () => {
  it("venerdì da fine dicembre atterra sull'anno nuovo", () => {
    // Mer 30 dic 2026 (11:00 a Roma).
    expect(p("venerdì x", new Date("2026-12-30T10:00:00Z")).date).toBe(
      "2027-01-01",
    );
  });

  it("il 15 da fine dicembre va a gennaio dell'anno nuovo", () => {
    expect(p("il 15 x", new Date("2026-12-20T10:00:00Z")).date).toBe(
      "2027-01-15",
    );
  });
});

describe("parse — ricorrenze (run-09): la regola detta il ritmo", () => {
  // NOW è venerdì 10 luglio 2026 (ISO 5) a Roma.
  const RECUR_CASES: Array<{
    name: string;
    input: string;
    title: string;
    date?: string;
    recurrence?: { freq: "daily" | "weekly"; weekdays?: number[] };
  }> = [
    {
      name: "ogni giorno: daily, prima occorrenza oggi",
      input: "ogni giorno bere acqua",
      title: "bere acqua",
      date: "2026-07-10",
      recurrence: { freq: "daily" },
    },
    {
      name: "ogni lunedì (pieno): weekly, primo lunedì utile",
      input: "palestra ogni lunedì",
      title: "palestra",
      date: "2026-07-13",
      recurrence: { freq: "weekly", weekdays: [1] },
    },
    {
      name: "ogni ven (abbreviato): oggi È venerdì → parte oggi",
      input: "ogni ven report",
      title: "report",
      date: "2026-07-10",
      recurrence: { freq: "weekly", weekdays: [5] },
    },
    {
      name: "lista con e: ogni lunedì e giovedì",
      input: "ogni lunedì e giovedì palestra",
      title: "palestra",
      date: "2026-07-13",
      recurrence: { freq: "weekly", weekdays: [1, 4] },
    },
    {
      name: "lista con virgole e chiusa da e",
      input: "ogni lun, mer e ven review",
      title: "review",
      date: "2026-07-10",
      recurrence: { freq: "weekly", weekdays: [1, 3, 5] },
    },
    {
      name: "nei feriali: lun-ven",
      input: "nei feriali standup",
      title: "standup",
      date: "2026-07-10",
      recurrence: { freq: "weekly", weekdays: [1, 2, 3, 4, 5] },
    },
    {
      name: "ogni sabato: accenti e futuro",
      input: "ogni sabato spesa",
      title: "spesa",
      date: "2026-07-11",
      recurrence: { freq: "weekly", weekdays: [6] },
    },
    {
      name: "maiuscole: Ogni Domenica",
      input: "Ogni Domenica chiamata",
      title: "chiamata",
      date: "2026-07-12",
      recurrence: { freq: "weekly", weekdays: [7] },
    },
    {
      name: "conflitto: la data esplicita vince sulla PRIMA occorrenza",
      input: "ogni lunedì il 15/08 palestra",
      title: "palestra",
      date: "2026-08-15",
      recurrence: { freq: "weekly", weekdays: [1] },
    },
    {
      name: "conflitto con parola-data: ogni giorno da domani",
      input: "ogni giorno domani vitamine",
      title: "vitamine",
      date: "2026-07-11",
      recurrence: { freq: "daily" },
    },
    {
      name: "ogni senza giorno riconoscibile: resta titolo",
      input: "ogni tanto pulire",
      title: "ogni tanto pulire",
    },
    {
      name: "weekday nudo senza ogni: solo data, nessuna regola",
      input: "lunedì riunione",
      title: "riunione",
      date: "2026-07-13",
    },
  ];

  for (const c of RECUR_CASES) {
    it(c.name, () => {
      const r = p(c.input);
      expect(r.title).toBe(c.title);
      expect(r.date).toBe(c.date);
      expect(r.recurrence).toEqual(c.recurrence);
    });
  }

  it("il frammento è dismissibile: span esatto e display parlante", () => {
    const r = p("ogni lun e gio palestra");
    const frag = r.fragments.find((f) => f.kind === "recurrence");
    expect(frag).toBeDefined();
    expect("ogni lun e gio palestra".slice(frag!.start, frag!.end)).toBe(
      "ogni lun e gio",
    );
    expect(frag!.display).toBe("ogni lun e gio");
    // Nessun frammento data: la prima occorrenza è derivata dalla regola.
    expect(r.fragments.some((f) => f.kind === "date")).toBe(false);
    expect(r.date).toBe("2026-07-13");
  });

  it("con più regole vince l'ultima; la perdente torna titolo", () => {
    const r = p("ogni giorno anzi ogni sabato spesa");
    expect(r.recurrence).toEqual({ freq: "weekly", weekdays: [6] });
    expect(r.title).toBe("ogni giorno anzi spesa");
  });
});
