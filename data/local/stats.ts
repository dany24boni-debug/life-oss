/**
 * StatsRepo su Dexie — aggregati di sola lettura, calcolati al volo sulle
 * stesse tabelle (mai cache: la lezione centrale dell'audit). Composto
 * sopra le tabelle, non sopra gli altri repo, per usare gli indici
 * direttamente.
 */

import type { LifeosDb } from "../db";
import { effectiveTarget, habitDone, isScheduledOn } from "../habits";
import type { GymSet, IsoDay } from "../schemas";
import type { StatsRepo } from "../ports";
import {
  civilDayInZone,
  computeStreak,
  dayRange,
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
   * completed_at -> giorno civile nella zona), sessione gym (già un
   * giorno civile), abitudine COMPLETATA (run-08: valore >= obiettivo
   * effettivo — per l'acqua l'obiettivo segue il profilo, come sulla
   * board) o fase di LAVORO del timer focus conclusa (run-08 P5).
   * Scansione filtrata: completed_at non è indicizzato, a scala
   * personale è la scelta documentata (vedi data/db.ts).
   */
  private async allActivityDays(timeZone: string): Promise<Set<IsoDay>> {
    const [doneTasks, sessions, habits, habitLogs, bodyRows, focusRows] =
      await Promise.all([
        this.db.tasks
          .where("status")
          .equals("done")
          .filter((t) => alive(t) && t.completed_at !== null)
          .toArray(),
        this.db.gym_sessions.filter((s) => alive(s)).toArray(),
        this.db.habits.filter(alive).toArray(),
        this.db.habit_logs.filter(alive).toArray(),
        this.db.body.filter(alive).toArray(),
        this.db.focus_sessions.filter(alive).toArray(),
      ]);
    const days = new Set<IsoDay>();
    for (const t of doneTasks) days.add(civilDayInZone(t.completed_at!, timeZone));
    for (const s of sessions) days.add(s.date);
    for (const f of focusRows) days.add(f.date);

    // Abitudini: anche le archiviate contano (i completamenti erano
    // veri); le eliminate no (i log viaggiano nel cascade di tombstone).
    const habitById = new Map(habits.map((h) => [h.id, h]));
    const latestWeight =
      bodyRows.length > 0
        ? bodyRows.sort((a, b) => b.date.localeCompare(a.date))[0].weight_kg
        : null;
    for (const log of habitLogs) {
      const habit = habitById.get(log.habit_id);
      if (!habit) continue;
      const target = effectiveTarget(habit, latestWeight);
      if (habitDone(habit.kind, log.value, target)) days.add(log.date);
    }
    return days;
  }

  /**
   * Completamento abitudini per giorno (run-12). "Prevista il giorno D":
   * viva, nata entro D (created_at → giorno civile), non ancora
   * archiviata in D, e con D nello schedule. "Completata": stessa
   * semantica di allActivityDays (obiettivo effettivo; l'acqua segue il
   * profilo col peso più recente — semplificazione documentata: il
   * target storico non viene ricostruito). Giorni senza previste: fuori.
   */
  async habitCompletionByDay(
    from: IsoDay,
    to: IsoDay,
    timeZone: string,
  ): Promise<Array<{ date: IsoDay; scheduled: number; done: number }>> {
    const [habits, logs, bodyRows] = await Promise.all([
      this.db.habits.filter(alive).toArray(),
      this.db.habit_logs
        .where("date")
        .between(from, to, true, true)
        .toArray(),
      this.db.body.filter(alive).toArray(),
    ]);
    const latestWeight =
      bodyRows.length > 0
        ? bodyRows.sort((a, b) => b.date.localeCompare(a.date))[0].weight_kg
        : null;
    const valueByKey = new Map<string, number>();
    for (const log of logs) {
      if (alive(log)) valueByKey.set(`${log.habit_id}:${log.date}`, log.value);
    }
    const habitViews = habits.map((h) => ({
      habit: h,
      bornDay: civilDayInZone(h.created_at, timeZone),
      archivedDay:
        h.archived_at === null ? null : civilDayInZone(h.archived_at, timeZone),
      target: effectiveTarget(h, latestWeight),
    }));

    const out: Array<{ date: IsoDay; scheduled: number; done: number }> = [];
    for (const date of dayRange(from, to)) {
      let scheduled = 0;
      let done = 0;
      for (const v of habitViews) {
        if (v.bornDay > date) continue;
        if (v.archivedDay !== null && v.archivedDay <= date) continue;
        if (!isScheduledOn(v.habit, date)) continue;
        scheduled += 1;
        const value = valueByKey.get(`${v.habit.id}:${date}`) ?? 0;
        if (habitDone(v.habit.kind, value, v.target)) done += 1;
      }
      if (scheduled > 0) out.push({ date, scheduled, done });
    }
    return out;
  }

  async trainedDays(from: IsoDay, to: IsoDay): Promise<IsoDay[]> {
    const sessions = await this.db.gym_sessions
      .where("date")
      .between(from, to, true, true)
      .toArray();
    return [
      ...new Set(
        sessions
          .filter((s) => alive(s) && s.finished_at !== null)
          .map((s) => s.date),
      ),
    ].sort();
  }

  /**
   * PR di peso caduti nel range (run-12, "Il tuo mese") — il gemello
   * dichiarato di weightPrSetIds (app/(app)/gym/pr.ts), ricalcolato
   * sulle tabelle come gymVolumeInRange (la convenzione di questo
   * repo). Cronologia per esercizio su TUTTA la storia: giorno della
   * sessione, poi done_at (null legacy in testa), poi id.
   */
  async gymPrCountInRange(from: IsoDay, to: IsoDay): Promise<number> {
    const [sessions, sets] = await Promise.all([
      this.db.gym_sessions.filter(alive).toArray(),
      this.db.gym_sets.filter(alive).toArray(),
    ]);
    const dayOf = new Map(sessions.map((s) => [s.id, s.date] as const));
    const byExercise = new Map<string, GymSet[]>();
    for (const s of sets) {
      if (!dayOf.has(s.session_id)) continue;
      const list = byExercise.get(s.exercise_id) ?? [];
      list.push(s);
      byExercise.set(s.exercise_id, list);
    }
    let count = 0;
    for (const list of byExercise.values()) {
      list.sort(
        (a, b) =>
          (dayOf.get(a.session_id) as IsoDay).localeCompare(
            dayOf.get(b.session_id) as IsoDay,
          ) ||
          (a.done_at ?? "").localeCompare(b.done_at ?? "") ||
          a.id.localeCompare(b.id),
      );
      let maxKg: number | null = null;
      for (const s of list) {
        if (s.weight_kg === null || s.weight_kg <= 0) continue;
        const day = dayOf.get(s.session_id) as IsoDay;
        if (maxKg !== null && s.weight_kg > maxKg && day >= from && day <= to) {
          count += 1;
        }
        if (maxKg === null || s.weight_kg > maxKg) maxKg = s.weight_kg;
      }
    }
    return count;
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
