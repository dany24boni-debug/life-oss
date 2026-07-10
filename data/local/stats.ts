/**
 * StatsRepo su Dexie — aggregati di sola lettura, calcolati al volo sulle
 * stesse tabelle (mai cache: la lezione centrale dell'audit). Composto
 * sopra le tabelle, non sopra gli altri repo, per usare gli indici
 * direttamente.
 */

import type { LifeosDb } from "../db";
import type { IsoDay } from "../schemas";
import type { StatsRepo } from "../ports";
import {
  civilDayInZone,
  computeStreak,
  type StreakSummary,
} from "../streak";
import { alive } from "./util";

export class LocalStatsRepo implements StatsRepo {
  constructor(private readonly db: LifeosDb) {}

  async tasksSummary(day: IsoDay): Promise<{ total: number; done: number }> {
    const rows = await this.db.tasks.where("date").equals(day).toArray();
    const live = rows.filter(alive);
    return {
      total: live.length,
      done: live.filter((t) => t.status === "done").length,
    };
  }

  async overdueCount(today: IsoDay): Promise<number> {
    const rows = await this.db.tasks.where("date").below(today).toArray();
    return rows.filter((t) => alive(t) && t.status === "open").length;
  }

  async completionByDay(
    from: IsoDay,
    to: IsoDay,
  ): Promise<Array<{ date: IsoDay; total: number; done: number }>> {
    const rows = await this.db.tasks
      .where("date")
      .between(from, to, true, true)
      .toArray();
    const byDay = new Map<IsoDay, { total: number; done: number }>();
    for (const t of rows) {
      if (!alive(t) || t.date === null) continue;
      const bucket = byDay.get(t.date) ?? { total: 0, done: 0 };
      bucket.total += 1;
      if (t.status === "done") bucket.done += 1;
      byDay.set(t.date, bucket);
    }
    return [...byDay.entries()]
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async streak(opts: {
    today: IsoDay;
    timeZone: string;
  }): Promise<StreakSummary> {
    const [activityDays, settingsRow] = await Promise.all([
      this.allActivityDays(opts.timeZone),
      this.db.settings.get("local"),
    ]);
    return computeStreak({
      activityDays,
      protectedDays: new Set(settingsRow?.protected_days ?? []),
      today: opts.today,
    });
  }

  async activityDays(
    from: IsoDay,
    to: IsoDay,
    timeZone: string,
  ): Promise<IsoDay[]> {
    const all = await this.allActivityDays(timeZone);
    return [...all].filter((d) => d >= from && d <= to).sort();
  }

  /**
   * Giorni con almeno un'azione significativa: task completato (istante
   * completed_at -> giorno civile nella zona) o sessione gym (già un
   * giorno civile). Scansione filtrata: completed_at non è indicizzato,
   * a scala personale è la scelta documentata (vedi data/db.ts).
   */
  private async allActivityDays(timeZone: string): Promise<Set<IsoDay>> {
    const [doneTasks, sessions] = await Promise.all([
      this.db.tasks
        .where("status")
        .equals("done")
        .filter((t) => alive(t) && t.completed_at !== null)
        .toArray(),
      this.db.gym_sessions.filter((s) => alive(s)).toArray(),
    ]);
    const days = new Set<IsoDay>();
    for (const t of doneTasks) days.add(civilDayInZone(t.completed_at!, timeZone));
    for (const s of sessions) days.add(s.date);
    return days;
  }

  async gymVolumeInRange(
    from: IsoDay,
    to: IsoDay,
  ): Promise<{ sessions: number; totalVolumeKg: number }> {
    const sessions = (
      await this.db.gym_sessions
        .where("date")
        .between(from, to, true, true)
        .toArray()
    ).filter(alive);
    if (sessions.length === 0) return { sessions: 0, totalVolumeKg: 0 };

    const sessionIds = new Set(sessions.map((s) => s.id));
    const sets = await this.db.gym_sets
      .where("session_id")
      .anyOf([...sessionIds])
      .toArray();
    const totalVolumeKg = sets
      .filter(alive)
      .reduce((sum, s) => sum + (s.weight_kg ?? 0) * s.reps, 0);
    return { sessions: sessions.length, totalVolumeKg };
  }
}
