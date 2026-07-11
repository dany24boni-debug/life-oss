import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { LifeosDb } from "./db";
import {
  DEFAULT_HABIT_ICON,
  HABIT_ICON_KEYS,
  STARTER_HABITS,
  WATER_DEFAULT_ML,
  WATER_HABIT_ID,
  WATER_SEED,
  effectiveTarget,
  habitDone,
  isScheduledOn,
  seedWaterHabit,
  weekdayOfDay,
} from "./habits";
import { HabitCreateSchema } from "./schemas";

const dbs: LifeosDb[] = [];
let counter = 0;

function makeDb(): LifeosDb {
  const db = new LifeosDb(`habits-domain-test-${++counter}`);
  dbs.push(db);
  return db;
}

afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

describe("weekdayOfDay / isScheduledOn — giorni civili, DST-immuni", () => {
  it("ISO: lunedì 1 … domenica 7", () => {
    expect(weekdayOfDay("2026-07-13")).toBe(1); // lunedì
    expect(weekdayOfDay("2026-07-12")).toBe(7); // domenica
    expect(weekdayOfDay("2026-07-11")).toBe(6); // sabato
  });

  it("i giorni dei cambi d'ora europei hanno il weekday giusto", () => {
    expect(weekdayOfDay("2026-03-29")).toBe(7); // domenica del +1h
    expect(weekdayOfDay("2026-10-25")).toBe(7); // domenica del −1h
  });

  it("weekdays null = tutti i giorni; set = solo quelli", () => {
    expect(isScheduledOn({ weekdays: null }, "2026-07-12")).toBe(true);
    const feriali = { weekdays: [1, 2, 3, 4, 5] };
    expect(isScheduledOn(feriali, "2026-07-10")).toBe(true); // venerdì
    expect(isScheduledOn(feriali, "2026-07-11")).toBe(false); // sabato
  });
});

describe("effectiveTarget / habitDone", () => {
  it("override manuale vince sempre; boolean = 1; senza obiettivo = null", () => {
    expect(
      effectiveTarget(
        { id: "x", kind: "quantity", daily_target: 1500 },
        80,
      ),
    ).toBe(1500);
    expect(
      effectiveTarget({ id: "x", kind: "boolean", daily_target: null }, null),
    ).toBe(1);
    expect(
      effectiveTarget({ id: "x", kind: "counter", daily_target: null }, 80),
    ).toBeNull();
  });

  it("acqua: segue il profilo (35 ml/kg), default di prodotto senza peso", () => {
    const acqua = { id: WATER_HABIT_ID, kind: "quantity" as const, daily_target: null };
    expect(effectiveTarget(acqua, 80)).toBe(2800);
    expect(effectiveTarget(acqua, 40)).toBe(1500); // clamp basso di derived.ts
    expect(effectiveTarget(acqua, null)).toBe(WATER_DEFAULT_ML);
    // Override manuale sull'acqua: vince sul derivato.
    expect(
      effectiveTarget({ ...acqua, daily_target: 3000 }, 80),
    ).toBe(3000);
  });

  it("habitDone: >= obiettivo quando c'è, > 0 senza", () => {
    expect(habitDone("quantity", 2800, 2800)).toBe(true);
    expect(habitDone("quantity", 2799, 2800)).toBe(false);
    expect(habitDone("counter", 3, null)).toBe(true);
    expect(habitDone("counter", 0, null)).toBe(false);
    expect(habitDone("boolean", 1, 1)).toBe(true);
    expect(habitDone("boolean", 0, 1)).toBe(false);
  });
});

describe("seedWaterHabit — UUID fisso, idempotente, non risuscita", () => {
  it("golden: l'id dell'acqua è fissato (prefisso …90ac…, indice 1)", () => {
    // FISSATO byte per byte: due dispositivi che seminano producono la
    // stessa riga e il sync la fonde. NON aggiornare mai questo valore.
    expect(WATER_HABIT_ID).toBe("01970000-90ac-7000-8000-000000000001");
    expect(WATER_SEED.kind).toBe("quantity");
    expect(WATER_SEED.unit).toBe("ml");
    expect(WATER_SEED.daily_target).toBeNull(); // segue il profilo
  });

  it("semina una volta; il secondo giro non tocca niente", async () => {
    const db = makeDb();
    expect(await seedWaterHabit(db)).toBe(1);
    expect(await seedWaterHabit(db)).toBe(0);
    expect(await db.habits.count()).toBe(1);
  });

  it("non risuscita una tombstone e non sovrascrive una riga modificata", async () => {
    const db = makeDb();
    await seedWaterHabit(db);
    // L'utente rinomina: la semina non riporta il nome del seme.
    await db.habits.update(WATER_HABIT_ID, {
      name: "Idratazione",
      updated_at: "2026-07-12T10:00:00.000Z",
    });
    expect(await seedWaterHabit(db)).toBe(0);
    expect((await db.habits.get(WATER_HABIT_ID))?.name).toBe("Idratazione");

    // L'utente elimina: la semina non la fa rinascere.
    await db.habits.update(WATER_HABIT_ID, {
      deleted_at: "2026-07-12T11:00:00.000Z",
    });
    expect(await seedWaterHabit(db)).toBe(0);
    expect((await db.habits.get(WATER_HABIT_ID))?.deleted_at).not.toBeNull();
  });
});

describe("set icone e starter", () => {
  it("il default è nel set curato; gli starter validano come HabitCreate", () => {
    expect(HABIT_ICON_KEYS).toContain(DEFAULT_HABIT_ICON);
    expect(HABIT_ICON_KEYS).toContain(WATER_SEED.icon);
    for (const starter of STARTER_HABITS) {
      const parsed = HabitCreateSchema.safeParse(starter);
      expect(parsed.success).toBe(true);
      expect(HABIT_ICON_KEYS).toContain(starter.icon as string);
    }
  });
});
