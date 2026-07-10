/**
 * Adapter locale (IndexedDB via Dexie) — factory unica.
 *
 * `createLocalRepos(db)` costruisce il fascio completo di port sulla stessa
 * istanza Dexie; i test passano un db con nome unico per isolamento, l'app
 * usa il singleton di `getDb()` (vedi data/hooks.ts).
 */

import type { LifeosDb } from "../db";
import type { Repos } from "../ports";
import { LocalEventsRepo } from "./events";
import { LocalGymRepo } from "./gym";
import { LocalRemindersRepo } from "./reminders";
import { LocalSettingsRepo } from "./settings";
import { LocalStatsRepo } from "./stats";
import { LocalTasksRepo } from "./tasks";
import type { Clock } from "./util";

export { LocalEventsRepo } from "./events";
export { LocalGymRepo } from "./gym";
export { LocalRemindersRepo } from "./reminders";
export { DEFAULT_SETTINGS, LocalSettingsRepo } from "./settings";
export { LocalStatsRepo } from "./stats";
export { LocalTasksRepo } from "./tasks";

export function createLocalRepos(db: LifeosDb, clock?: Clock): Repos {
  return {
    tasks: new LocalTasksRepo(db, clock),
    events: new LocalEventsRepo(db, clock),
    gym: new LocalGymRepo(db, clock),
    stats: new LocalStatsRepo(db),
    reminders: new LocalRemindersRepo(db, clock),
    settings: new LocalSettingsRepo(db, clock),
  };
}
