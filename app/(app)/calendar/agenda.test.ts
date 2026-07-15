import { describe, expect, it } from "vitest";
import type { LocalEvent, Task } from "@/data/schemas";
import {
  buildDayAgenda,
  buildDensityMap,
  defaultEndTime,
  googleEventOnDay,
  instantDayInZone,
  instantHhmmInZone,
  toGoogleAgendaEvent,
  type GoogleAgendaEvent,
} from "./agenda";

const TZ = "Europe/Rome";
const AUDIT = {
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  deleted_at: null,
};

let n = 0;
function uid(): string {
  n += 1;
  return `01980000-0000-7000-8000-${String(n).padStart(12, "0")}`;
}

function event(over: Partial<LocalEvent>): LocalEvent {
  return {
    id: uid(),
    title: "Evento",
    date: "2026-07-10",
    start_time: null,
    end_time: null,
    all_day: true,
    notes: null,
    ...AUDIT,
    ...over,
  };
}

function task(over: Partial<Task>): Task {
  return {
    id: uid(),
    title: "Task",
    notes: null,
    date: "2026-07-10",
    time: null,
    priority: null,
    tags: [],
    module_link: null,
    recurrence: null,
    status: "open",
    completed_at: null,
    sort_order: 0,
    subtasks: [],
    ...AUDIT,
    ...over,
  };
}

function gev(over: Partial<GoogleAgendaEvent>): GoogleAgendaEvent {
  return {
    id: uid(),
    title: "Google",
    day: "2026-07-10",
    endDayExclusive: null,
    allDay: false,
    start: "10:00",
    end: null,
    ...over,
  };
}

describe("conversioni istante → fuso app", () => {
  it("estate (CEST, UTC+2): giorno e orario giusti", () => {
    expect(instantDayInZone("2026-07-10T18:30:00.000Z", TZ)).toBe("2026-07-10");
    expect(instantHhmmInZone("2026-07-10T18:30:00.000Z", TZ)).toBe("20:30");
  });

  it("un istante a cavallo di mezzanotte cambia giorno civile", () => {
    expect(instantDayInZone("2026-07-10T22:30:00.000Z", TZ)).toBe("2026-07-11");
    expect(instantHhmmInZone("2026-07-10T22:30:00.000Z", TZ)).toBe("00:30");
  });

  it("inverno (CET, UTC+1)", () => {
    expect(instantHhmmInZone("2026-12-10T18:30:00.000Z", TZ)).toBe("19:30");
  });

  it("fuso non valido degrada a UTC senza lanciare", () => {
    expect(instantDayInZone("2026-07-10T18:30:00.000Z", "Marte/Olympus")).toBe(
      "2026-07-10",
    );
  });
});

describe("defaultEndTime — la regola +1h del quick-add", () => {
  it("aggiunge un'ora conservando i minuti", () => {
    expect(defaultEndTime("20:30")).toBe("21:30");
    expect(defaultEndTime("08:00")).toBe("09:00");
  });

  it("non scavalca mai la mezzanotte: clamp a 23:59", () => {
    expect(defaultEndTime("23:00")).toBe("23:59");
    expect(defaultEndTime("23:45")).toBe("23:59");
  });
});

describe("toGoogleAgendaEvent", () => {
  it("evento con orario: giorno e orari nel fuso app, fine stesso giorno", () => {
    const g = toGoogleAgendaEvent(
      {
        id: "g1",
        title: "Riunione",
        starts_at: "2026-07-10T08:00:00.000Z",
        ends_at: "2026-07-10T09:00:00.000Z",
        all_day: false,
        status: "confirmed",
      },
      TZ,
    );
    expect(g).toEqual({
      id: "g1",
      title: "Riunione",
      day: "2026-07-10",
      endDayExclusive: null,
      allDay: false,
      start: "10:00",
      end: "11:00",
    });
  });

  it("fine su un altro giorno civile: end omesso (v1)", () => {
    const g = toGoogleAgendaEvent(
      {
        id: "g2",
        title: "Nottata",
        starts_at: "2026-07-10T20:00:00.000Z",
        ends_at: "2026-07-11T01:00:00.000Z",
        all_day: false,
        status: null,
      },
      TZ,
    );
    expect(g?.start).toBe("22:00");
    expect(g?.end).toBeNull();
  });

  it("all-day multi-giorno: fine esclusiva Google conservata", () => {
    const g = toGoogleAgendaEvent(
      {
        id: "g3",
        title: "Ferie",
        starts_at: "2026-07-10T00:00:00.000Z",
        ends_at: "2026-07-13T00:00:00.000Z",
        all_day: true,
        status: "confirmed",
      },
      TZ,
    );
    expect(g?.allDay).toBe(true);
    expect(g?.day).toBe("2026-07-10");
    expect(g?.endDayExclusive).toBe("2026-07-13");
    // Copre 10, 11, 12 — non il 13 (esclusivo) né il 9.
    expect(googleEventOnDay(g!, "2026-07-10")).toBe(true);
    expect(googleEventOnDay(g!, "2026-07-12")).toBe(true);
    expect(googleEventOnDay(g!, "2026-07-13")).toBe(false);
    expect(googleEventOnDay(g!, "2026-07-09")).toBe(false);
  });

  it("gli eventi cancellati spariscono; titolo vuoto ha un segnaposto", () => {
    expect(
      toGoogleAgendaEvent(
        {
          id: "g4",
          title: "X",
          starts_at: "2026-07-10T08:00:00.000Z",
          ends_at: null,
          all_day: false,
          status: "cancelled",
        },
        TZ,
      ),
    ).toBeNull();
    const senzaTitolo = toGoogleAgendaEvent(
      {
        id: "g5",
        title: "  ",
        starts_at: "2026-07-10T08:00:00.000Z",
        ends_at: null,
        all_day: false,
        status: null,
      },
      TZ,
    );
    expect(senzaTitolo?.title).toBe("(senza titolo)");
  });
});

describe("buildDayAgenda — merge e ordinamento", () => {
  it("all-day prima (task senza orario DOPO gli eventi), poi per orario", () => {
    const items = buildDayAgenda("2026-07-10", {
      events: [
        event({ title: "Compleanno", all_day: true }),
        event({
          title: "Cena",
          all_day: false,
          start_time: "20:30",
          end_time: "22:00",
        }),
      ],
      tasks: [
        task({ title: "Chiamare idraulico", time: "09:00" }),
        // run-08 P5: il task datato SENZA orario entra in fascia
        // giornata, dopo gli all-day (locali e Google).
        task({ title: "Comprare il regalo" }),
      ],
      google: [
        gev({ title: "Standup", start: "09:00" }),
        gev({ title: "Ferie", allDay: true, start: null }),
      ],
    });

    expect(items.map((i) => `${i.source}:${i.title}`)).toEqual([
      "event:Compleanno",
      "google:Ferie",
      "task:Comprare il regalo",
      "task:Chiamare idraulico",
      "google:Standup",
      "event:Cena",
    ]);
    const cena = items.find((i) => i.title === "Cena");
    expect(cena?.start).toBe("20:30");
    expect(cena?.end).toBe("22:00");
  });

  it("task senza orario: all-day, source-linked e col done che passa", () => {
    const items = buildDayAgenda("2026-07-10", {
      events: [],
      tasks: [
        task({ title: "Spesa", status: "done" }),
        task({ title: "Bolletta" }),
      ],
      google: [],
    });
    expect(items.map((i) => i.title)).toEqual(["Bolletta", "Spesa"]);
    for (const i of items) {
      expect(i.allDay).toBe(true);
      expect(i.start).toBeNull();
      expect(i.source).toBe("task");
      expect(i.key).toBe(`task:${i.id}`);
    }
    expect(items.find((i) => i.title === "Spesa")?.done).toBe(true);
  });

  it("giorni diversi restano fuori; i task fatti arrivano marcati done", () => {
    const items = buildDayAgenda("2026-07-10", {
      events: [event({ date: "2026-07-11" })],
      tasks: [
        task({ title: "Fatta", time: "08:00", status: "done" }),
      ],
      google: [gev({ day: "2026-07-09" })],
    });
    expect(items).toHaveLength(1);
    expect(items[0].done).toBe(true);
  });
});

describe("buildDensityMap", () => {
  it("conta eventi vivi, task APERTI datati e google (multi-giorno espanso)", () => {
    const map = buildDensityMap({
      events: [event({ date: "2026-07-10" }), event({ date: "2026-07-10" })],
      tasks: [
        task({ date: "2026-07-10" }),
        task({ date: "2026-07-10", status: "done" }), // i fatti non pesano
        task({ date: null }), // inbox fuori
      ],
      google: [
        gev({
          allDay: true,
          start: null,
          day: "2026-07-11",
          endDayExclusive: "2026-07-13",
        }),
      ],
    });
    expect(map.get("2026-07-10")).toBe(3);
    expect(map.get("2026-07-11")).toBe(1);
    expect(map.get("2026-07-12")).toBe(1);
    expect(map.get("2026-07-13")).toBeUndefined();
  });
});
