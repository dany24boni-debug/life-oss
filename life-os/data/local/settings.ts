/**
 * SettingsRepo su Dexie — riga singola id "local".
 *
 * `get()` non scrive mai: se la riga non esiste restituisce DEFAULT_SETTINGS
 * (timestamp epoch = "mai persistito"; nel sync LWW perde contro qualsiasi
 * scrittura reale, che è il comportamento giusto). La riga nasce alla prima
 * `update()`.
 */

import type { LifeosDb } from "../db";
import { attempt, ok, type Result } from "../result";
import {
  SettingsPatchSchema,
  type Settings,
  type SettingsPatch,
} from "../schemas";
import type { SettingsRepo } from "../ports";
import { monotonicClock, validate, type Clock } from "./util";

const EPOCH = "1970-01-01T00:00:00.000Z";

export const DEFAULT_SETTINGS: Settings = {
  id: "local",
  display_name: null,
  theme: "dark",
  protected_days: [],
  created_at: EPOCH,
  updated_at: EPOCH,
  deleted_at: null,
};

export class LocalSettingsRepo implements SettingsRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  async get(): Promise<Settings> {
    const row = await this.db.settings.get("local");
    // Merge sui default: le righe scritte prima di un campo nuovo (es.
    // protected_days, run-03) tornano complete senza migrazione Dexie.
    return row ? { ...DEFAULT_SETTINGS, ...row } : DEFAULT_SETTINGS;
  }

  update(patch: SettingsPatch): Promise<Result<Settings>> {
    return attempt(async () => {
      const v = validate(SettingsPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.get();
      const now = this.clock();
      const next: Settings = {
        ...current,
        ...(v.data.display_name !== undefined && {
          display_name: v.data.display_name,
        }),
        ...(v.data.theme !== undefined && { theme: v.data.theme }),
        ...(v.data.protected_days !== undefined && {
          // Ordinati e senza duplicati per costruzione: chi legge (motore
          // streak, UI) non deve difendersi.
          protected_days: [...new Set(v.data.protected_days)].sort(),
        }),
        created_at: current.created_at === EPOCH ? now : current.created_at,
        updated_at: now,
      };
      await this.db.settings.put(next);
      return ok(next);
    });
  }
}
