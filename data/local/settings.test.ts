import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import { DEFAULT_SETTINGS, LocalSettingsRepo } from "./settings";

let counter = 0;
let db: LifeosDb;
let repo: LocalSettingsRepo;

beforeEach(() => {
  db = new LifeosDb(`test-settings-${++counter}`);
  repo = new LocalSettingsRepo(db);
});

afterEach(async () => {
  await db.delete();
});

describe("LocalSettingsRepo", () => {
  it("get senza riga: default con timestamp epoch, e NON scrive", async () => {
    const s = await repo.get();
    expect(s).toEqual(DEFAULT_SETTINGS);
    expect(s.theme).toBe("dark");
    expect(await db.settings.get("local")).toBeUndefined(); // mai persistito
  });

  it("update crea la riga alla prima scrittura (upsert)", async () => {
    const r = await repo.update({ display_name: "Davide" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.display_name).toBe("Davide");
      expect(r.data.created_at).not.toBe(DEFAULT_SETTINGS.created_at);
      expect(r.data.created_at).toBe(r.data.updated_at);
    }
    const stored = await db.settings.get("local");
    expect(stored?.display_name).toBe("Davide");
  });

  it("update successivi bumpano updated_at e preservano created_at", async () => {
    const first = await repo.update({ display_name: "Davide" });
    const second = await repo.update({ theme: "light" });
    expect(first.ok && second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.data.display_name).toBe("Davide"); // patch parziale
      expect(second.data.theme).toBe("light");
      expect(second.data.created_at).toBe(first.data.created_at);
      expect(second.data.updated_at > first.data.updated_at).toBe(true);
    }
  });

  it("update rifiuta temi fuori enum", async () => {
    const r = await repo.update({ theme: "sepia" as never });
    expect(!r.ok && r.error.code).toBe("validation");
  });
});

describe("LocalSettingsRepo — protected_days (run-03)", () => {
  it("una riga salvata prima del campo torna normalizzata con []", async () => {
    // Simula una riga scritta dallo schema precedente (niente protected_days).
    const now = new Date().toISOString();
    await db.settings.put({
      id: "local",
      display_name: "Davide",
      theme: "dark",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as never);

    const s = await repo.get();
    expect(s.protected_days).toEqual([]);
    expect(s.display_name).toBe("Davide");
  });

  it("update ordina e deduplica i giorni protetti", async () => {
    const r = await repo.update({
      protected_days: ["2026-07-12", "2026-07-10", "2026-07-12"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.protected_days).toEqual(["2026-07-10", "2026-07-12"]);
    }
    expect((await repo.get()).protected_days).toEqual([
      "2026-07-10",
      "2026-07-12",
    ]);
  });

  it("update rifiuta giorni non validi", async () => {
    const r = await repo.update({ protected_days: ["10/07/2026"] });
    expect(!r.ok && r.error.code).toBe("validation");
  });
});

describe("LocalSettingsRepo — attrezzatura palestra (run-12)", () => {
  it("sopravvivenza: una riga pre-run-12 torna completa e un update NON perde nulla", async () => {
    // Simula la riga com'era scritta a run-11 (niente campi attrezzatura):
    // stesso meccanismo del pattern protected_days — merge sui default,
    // nessuna migrazione Dexie (precedente v7 documentato in db.ts).
    const now = new Date().toISOString();
    await db.settings.put({
      id: "local",
      display_name: "Davide",
      theme: "light",
      protected_days: ["2026-07-10"],
      height_cm: 180,
      sex: "m",
      birth_year: 2000,
      activity_level: 3,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    } as never);

    const s = await repo.get();
    expect(s.gym_bar_kg).toBeNull();
    expect(s.gym_plates).toBeNull();
    expect(s.height_cm).toBe(180);

    // L'update dei campi nuovi preserva TUTTO il resto (perdita zero).
    const r = await repo.update({
      gym_bar_kg: 20,
      gym_plates: [{ kg: 10, n: 4 }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.gym_bar_kg).toBe(20);
      expect(r.data.display_name).toBe("Davide");
      expect(r.data.theme).toBe("light");
      expect(r.data.protected_days).toEqual(["2026-07-10"]);
      expect(r.data.height_cm).toBe(180);
      expect(r.data.activity_level).toBe(3);
    }
  });

  it("update ordina i dischi per kg decrescente", async () => {
    const r = await repo.update({
      gym_bar_kg: 20,
      gym_plates: [
        { kg: 1.25, n: 2 },
        { kg: 20, n: 4 },
        { kg: 5, n: 2 },
      ],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.gym_plates?.map((p) => p.kg)).toEqual([20, 5, 1.25]);
    }
  });

  it("update rifiuta tagli duplicati e bilanciere fuori dominio", async () => {
    const dup = await repo.update({
      gym_plates: [
        { kg: 20, n: 2 },
        { kg: 20, n: 2 },
      ],
    });
    expect(!dup.ok && dup.error.code).toBe("validation");

    const bar = await repo.update({ gym_bar_kg: 0 });
    expect(!bar.ok && bar.error.code).toBe("validation");
  });

  it("gym_plates: null azzera il profilo dischi", async () => {
    await repo.update({ gym_plates: [{ kg: 20, n: 4 }] });
    const r = await repo.update({ gym_plates: null });
    expect(r.ok && r.data.gym_plates).toBeNull();
  });
});
