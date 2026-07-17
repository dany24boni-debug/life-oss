import { describe, expect, it } from "vitest";
import { parse } from "@/lib/nlp-it";
import type { Task } from "@/data/schemas";
import {
  APP_TIME_ZONE,
  DEFAULT_DATE_CHIP_KEY,
  applyDismissals,
  chipKey,
  dayHeading,
  groupTasksByDay,
  moveItem,
  snoozeDate,
  todayInZone,
  toTaskCreate,
  laterRange,
  upcomingRange,
  withDefaultDate,
} from "./logic";

/** Venerdì 10 luglio 2026, ore 10:00 a Roma (CEST). */
const NOW = new Date("2026-07-10T10:00:00.000+02:00");
const TODAY = "2026-07-10";

function parsed(input: string) {
  return parse(input, { now: NOW, timeZone: APP_TIME_ZONE });
}

function effective(input: string, dismissedKeys: string[] = []) {
  return applyDismissals(input, parsed(input), new Set(dismissedKeys));
}

describe("todayInZone", () => {
  it("estrae il giorno civile nella zona data", () => {
    expect(todayInZone(NOW, "Europe/Rome")).toBe("2026-07-10");
  });

  it("la mezzanotte di Roma cade nel giorno giusto (UTC è indietro)", () => {
    // 23:30 UTC del 10 = 01:30 dell'11 a Roma (estate, UTC+2).
    expect(todayInZone(new Date("2026-07-10T23:30:00.000Z"), "Europe/Rome")).toBe(
      "2026-07-11",
    );
    expect(todayInZone(new Date("2026-07-10T23:30:00.000Z"), "UTC")).toBe(
      "2026-07-10",
    );
  });

  it("zona non valida degrada a UTC senza lanciare", () => {
    expect(todayInZone(new Date("2026-07-10T23:30:00.000Z"), "Not/AZone")).toBe(
      "2026-07-10",
    );
  });
});

describe("applyDismissals", () => {
  it("senza dismissal è un passthrough del parse (più i chip)", () => {
    const e = effective("spesa domani alle 18 #casa !!");
    expect(e.title).toBe("spesa");
    expect(e.date).toBe("2026-07-11");
    expect(e.time).toBe("18:00");
    expect(e.priority).toBe(2);
    expect(e.tags).toEqual(["casa"]);
    expect(e.chips.map((c) => c.kind)).toEqual([
      "date",
      "time",
      "tag",
      "priority",
    ]);
  });

  it("dismettere il chip data riporta il testo nel titolo e conserva l'orario esplicito", () => {
    const input = "spesa domani alle 18";
    const dateKey = chipKey(input, parsed(input).fragments.find((f) => f.kind === "date")!);
    const e = effective(input, [dateKey]);
    expect(e.date).toBeUndefined();
    expect(e.time).toBe("18:00");
    expect(e.title).toBe("spesa domani");
    expect(e.chips.map((c) => c.kind)).toEqual(["time"]);
  });

  it("dismettere 'stasera' scarta data E orario implicito insieme", () => {
    const input = "cena stasera";
    const r = parsed(input);
    expect(r.time).toBe("20:00"); // premessa: il default serale esiste
    const dateKey = chipKey(input, r.fragments.find((f) => f.kind === "date")!);
    const e = applyDismissals(input, r, new Set([dateKey]));
    expect(e.date).toBeUndefined();
    expect(e.time).toBeUndefined();
    expect(e.title).toBe("cena stasera");
  });

  it("dismettere l'orario esplicito non fa risorgere il default di stasera", () => {
    const input = "cena stasera alle 21";
    const r = parsed(input);
    expect(r.time).toBe("21:00");
    const timeKey = chipKey(input, r.fragments.find((f) => f.kind === "time")!);
    const e = applyDismissals(input, r, new Set([timeKey]));
    expect(e.date).toBe(TODAY); // stasera resta come data
    expect(e.time).toBeUndefined(); // l'utente ha detto: niente orario
  });

  it("dismettere un tag lo toglie dai tags e lo lascia nel titolo", () => {
    const input = "pulizie #casa #uni";
    const r = parsed(input);
    const casaKey = chipKey(
      input,
      r.fragments.find((f) => f.display === "#casa")!,
    );
    const e = applyDismissals(input, r, new Set([casaKey]));
    expect(e.tags).toEqual(["uni"]);
    expect(e.title).toBe("pulizie #casa");
  });

  it("occorrenze identiche condividono la chiave: un dismissal le spegne tutte", () => {
    const input = "#casa lavori #casa";
    const r = parsed(input);
    const keys = r.fragments.map((f) => chipKey(input, f));
    expect(new Set(keys).size).toBe(1);
    const e = applyDismissals(input, r, new Set([keys[0]]));
    expect(e.tags).toEqual([]);
    expect(e.title).toBe("#casa lavori #casa");
  });

  it("il chip module si spegne senza toccare il titolo (mai consumato)", () => {
    const input = "palestra gambe";
    const r = parsed(input);
    expect(r.moduleHint).toBe("gym");
    const modKey = chipKey(input, r.fragments.find((f) => f.kind === "module")!);
    const e = applyDismissals(input, r, new Set([modKey]));
    expect(e.moduleHint).toBeUndefined();
    expect(e.title).toBe("palestra gambe");
  });

  it("dismettere la priorità riporta i punti esclamativi nel titolo", () => {
    const input = "urgente !!!";
    const r = parsed(input);
    const pKey = chipKey(input, r.fragments.find((f) => f.kind === "priority")!);
    const e = applyDismissals(input, r, new Set([pKey]));
    expect(e.priority).toBeUndefined();
    expect(e.title).toBe("urgente !!!");
  });
});

describe("withDefaultDate", () => {
  it("aggiunge la data implicita con chip attenuato quando il parse non ha data", () => {
    const e = withDefaultDate(effective("spesa"), TODAY, false, TODAY);
    expect(e.date).toBe(TODAY);
    const chip = e.chips.find((c) => c.key === DEFAULT_DATE_CHIP_KEY);
    expect(chip).toBeDefined();
    expect(chip!.muted).toBe(true);
    expect(chip!.label).toBe("Oggi");
  });

  it("non tocca nulla se il parse ha già una data o il default è stato dismesso", () => {
    const withDate = withDefaultDate(effective("spesa domani"), TODAY, false, TODAY);
    expect(withDate.date).toBe("2026-07-11");
    expect(withDate.chips.some((c) => c.key === DEFAULT_DATE_CHIP_KEY)).toBe(false);

    const dismissed = withDefaultDate(effective("spesa"), TODAY, true, TODAY);
    expect(dismissed.date).toBeUndefined();
    expect(dismissed.chips).toHaveLength(0);
  });
});

describe("toTaskCreate", () => {
  it("mappa tutti i campi effettivi, incluso il module_link dal hint", () => {
    const e = effective("palestra gambe domani alle 18 #forza !");
    const payload = toTaskCreate(e);
    expect(payload).toEqual({
      title: "palestra gambe",
      date: "2026-07-11",
      time: "18:00",
      priority: 3,
      tags: ["forza"],
      module_link: { kind: "gym", ref_id: null },
    });
  });

  it("omette i campi assenti: solo titolo per un input semplice", () => {
    expect(toTaskCreate(effective("comprare il latte"))).toEqual({
      title: "comprare il latte",
    });
  });
});

describe("snoozeDate", () => {
  it("stasera = oggi, domani = +1", () => {
    expect(snoozeDate("stasera", TODAY)).toBe("2026-07-10");
    expect(snoozeDate("domani", TODAY)).toBe("2026-07-11");
  });

  it("weekend = prossimo sabato, strettamente futuro", () => {
    expect(snoozeDate("weekend", "2026-07-10")).toBe("2026-07-11"); // ven -> sab
    expect(snoozeDate("weekend", "2026-07-11")).toBe("2026-07-18"); // sab -> sab successivo
    expect(snoozeDate("weekend", "2026-07-12")).toBe("2026-07-18"); // dom -> sab prossimo
  });

  it("prossima settimana = prossimo lunedì, con rollover di settimana e mese", () => {
    expect(snoozeDate("prossima_settimana", "2026-07-10")).toBe("2026-07-13");
    expect(snoozeDate("prossima_settimana", "2026-07-13")).toBe("2026-07-20"); // lun -> lun dopo
    expect(snoozeDate("prossima_settimana", "2026-07-12")).toBe("2026-07-13"); // dom -> domani
    expect(snoozeDate("prossima_settimana", "2026-07-31")).toBe("2026-08-03"); // cambio mese
    expect(snoozeDate("prossima_settimana", "2026-12-31")).toBe("2027-01-04"); // cambio anno
  });
});

describe("moveItem", () => {
  const list = ["a", "b", "c", "d"];

  it("sposta avanti e indietro", () => {
    expect(moveItem(list, 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(list, 3, 1)).toEqual(["a", "d", "b", "c"]);
  });

  it("clampa gli indici fuori range e non muta l'originale", () => {
    expect(moveItem(list, 0, 99)).toEqual(["b", "c", "d", "a"]);
    expect(moveItem(list, -5, 0)).toEqual(list);
    expect(list).toEqual(["a", "b", "c", "d"]);
    expect(moveItem([], 0, 1)).toEqual([]);
  });
});

describe("giorni e raggruppamenti", () => {
  it("upcomingRange copre da domani a oggi+7", () => {
    expect(upcomingRange(TODAY)).toEqual({
      from: "2026-07-11",
      to: "2026-07-17",
    });
  });

  it("laterRange parte dove finisce la settimana: zona morta chiusa", () => {
    const later = laterRange(TODAY);
    expect(later.from).toBe("2026-07-18");
    expect(later.to).toBe("2027-07-10");
    // Contiguità con upcomingRange: nessun giorno datato resta invisibile.
    expect(later.from > upcomingRange(TODAY).to).toBe(true);
  });

  it("dayHeading: Oggi, Domani, poi etichetta breve", () => {
    expect(dayHeading(TODAY, TODAY)).toBe("Oggi");
    expect(dayHeading("2026-07-11", TODAY)).toBe("Domani");
    const other = dayHeading("2026-07-15", TODAY);
    expect(other).not.toBe("Oggi");
    expect(other).toContain("15");
  });

  it("groupTasksByDay preserva l'ordine di arrivo dei gruppi e dei task", () => {
    const t = (id: string, date: string | null) =>
      ({ id, date }) as unknown as Task;
    const groups = groupTasksByDay([
      t("1", "2026-07-11"),
      t("2", "2026-07-11"),
      t("3", "2026-07-12"),
      t("4", null),
    ]);
    expect(groups.map((g) => g.day)).toEqual(["2026-07-11", "2026-07-12", ""]);
    expect(groups[0].tasks.map((x) => x.id)).toEqual(["1", "2"]);
  });
});

describe("applyDismissals — ricorrenze (run-09)", () => {
  function effectiveWithToday(input: string, dismissedKeys: string[] = []) {
    return applyDismissals(input, parsed(input), new Set(dismissedKeys), TODAY);
  }

  it("il chip ripeti porta regola e prima occorrenza derivata", () => {
    const e = effectiveWithToday("palestra ogni lunedì");
    expect(e.title).toBe("palestra");
    expect(e.recurrence).toEqual({ freq: "weekly", weekdays: [1] });
    expect(e.date).toBe("2026-07-13");
    // "palestra" in testa accende anche il hint modulo (mai consumato).
    expect(e.chips.map((c) => c.kind)).toEqual(["module", "recurrence"]);
  });

  it("dismettere il chip ripeti: regola E data derivata decadono insieme", () => {
    const input = "palestra ogni lunedì";
    const e = effectiveWithToday(input, ["recurrence:ogni lunedì"]);
    expect(e.recurrence).toBeUndefined();
    expect(e.date).toBeUndefined();
    expect(e.title).toBe("palestra ogni lunedì");
  });

  it("data esplicita dismessa con regola attiva: torna alla prima occorrenza", () => {
    const input = "ogni lunedì il 15/08 palestra";
    const conData = effectiveWithToday(input);
    expect(conData.date).toBe("2026-08-15");
    const senzaData = effectiveWithToday(input, ["date:il 15/08"]);
    expect(senzaData.recurrence).toEqual({ freq: "weekly", weekdays: [1] });
    expect(senzaData.date).toBe("2026-07-13"); // il primo lunedì utile
  });

  it("toTaskCreate porta la regola nel payload", () => {
    const e = effectiveWithToday("ogni giorno vitamine");
    const payload = toTaskCreate(e);
    expect(payload.recurrence).toEqual({ freq: "daily" });
    expect(payload.date).toBe("2026-07-10");
  });
});
