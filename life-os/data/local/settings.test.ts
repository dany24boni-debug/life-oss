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
