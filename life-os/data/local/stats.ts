/**
 * StatsRepo su Dexie — aggregati di sola lettura, calcolati al volo sulle
 * stesse tabelle (mai cache: la lezione centrale dell'audit). Composto
 * sopra le tabelle, non sopra gli altri repo, per usare gli indici
 * direttamente.
 */

import type { LifeosDb } from "../db";
import type { IsoDay } from "../schemas";
import type { StatsRepo } from "../ports";
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
