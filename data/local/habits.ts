/**
 * HabitsRepo su Dexie (run-08 prompt 1) — abitudini + log per-giorno.
 *
 * Il log è UNA riga per (abitudine, giorno) per COSTRUZIONE: id
 * `deriveUuidV8("lifeos:habit-log:<habit_id>:<date>")` — due dispositivi
 * che loggano lo stesso giorno producono la stessa PK e il sync fonde
 * con LWW (stesso disegno di Sera/Corpo; il valore NON si somma tra
 * dispositivi: vince la scrittura più recente, come ogni riga LWW).
 *
 * Cancellare un'abitudine tombstona anche i suoi log con lo STESSO
 * deleted_at (pattern cascade dei programmi gym): l'undo revive solo le
 * righe di quel cascade — un giorno azzerato o eliminato prima resta
 * com'era.
 */

import type { LifeosDb } from "../db";
import {
  effectiveTarget,
  habitDone,
  isScheduledOn,
  DEFAULT_HABIT_ICON,
} from "../habits";
import { deriveUuidV8, uuidv7 } from "../ids";
import { attempt, err, ok, type Result } from "../result";
import {
  HabitCreateSchema,
  HabitPatchSchema,
  HabitValueSchema,
  type Habit,
  type HabitCreate,
  type HabitKind,
  type HabitLog,
  type HabitPatch,
  type IsoDay,
  type IsoInstant,
} from "../schemas";
import type { HabitBoardEntry, HabitsRepo } from "../ports";
import { computeSeriesStreak, type StreakSummary } from "../streak";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const ABITUDINE_NON_TROVATA = "Abitudine non trovata.";

/** Id deterministico del log (abitudine, giorno). */
export function habitLogId(habitId: string, date: IsoDay): Promise<string> {
  return deriveUuidV8(`lifeos:habit-log:${habitId}:${date}`);
}

/** unit/daily_target hanno senso solo per la specie giusta. */
function normalizeByKind(
  kind: HabitKind,
  unit: string | null,
  dailyTarget: number | null,
): { unit: string | null; daily_target: number | null } {
  return {
    unit: kind === "quantity" ? unit : null,
    daily_target: kind === "boolean" ? null : dailyTarget,
  };
}

/** Giorni feriali ordinati e senza duplicati per costruzione. */
function normalizeWeekdays(weekdays: number[] | null): number[] | null {
  if (weekdays === null) return null;
  const unique = [...new Set(weekdays)].sort((a, b) => a - b);
  return unique.length === 7 ? null : unique;
}

export class LocalHabitsRepo implements HabitsRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  create(input: HabitCreate): Promise<Result<Habit>> {
    return attempt(async () => {
      const v = validate(HabitCreateSchema, input);
      if (!v.ok) return v;
      const data = v.data;
      const now = this.clock();
      const siblings = (await this.db.habits.toArray()).filter(alive);
      const maxSort = siblings.reduce(
        (max, h) => Math.max(max, h.sort_order),
        -1,
      );
      const row: Habit = {
        id: uuidv7(),
        name: data.name,
        icon: data.icon ?? DEFAULT_HABIT_ICON,
        kind: data.kind,
        ...normalizeByKind(
          data.kind,
          data.unit ?? null,
          data.daily_target ?? null,
        ),
        weekdays: normalizeWeekdays(data.weekdays ?? null),
        sort_order: data.sort_order ?? maxSort + 1,
        archived_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.habits.add(row);
      return ok(row);
    });
  }

  update(id: string, patch: HabitPatch): Promise<Result<Habit>> {
    return attempt(async () => {
      const v = validate(HabitPatchSchema, patch);
      if (!v.ok) return v;
      const data = v.data;
      const current = await this.db.habits.get(id);
      if (!current || !alive(current)) {
        return err<Habit>("not_found", ABITUDINE_NON_TROVATA);
      }
      const merged: Habit = {
        ...current,
        ...(data.name !== undefined && { name: data.name }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.daily_target !== undefined && {
          daily_target: data.daily_target,
        }),
        ...(data.weekdays !== undefined && {
          weekdays: normalizeWeekdays(data.weekdays),
        }),
        ...(data.sort_order !== undefined && { sort_order: data.sort_order }),
      };
      const next: Habit = {
        ...merged,
        ...normalizeByKind(merged.kind, merged.unit, merged.daily_target),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.habits.put(next);
      return ok(next);
    });
  }

  archive(id: string): Promise<Result<Habit>> {
    return attempt(async () => {
      const current = await this.db.habits.get(id);
      if (!current || !alive(current)) {
        return err<Habit>("not_found", ABITUDINE_NON_TROVATA);
      }
      if (current.archived_at !== null) return ok(current);
      const now = bumpFrom(this.clock, current.updated_at);
      const next: Habit = { ...current, archived_at: now, updated_at: now };
      await this.db.habits.put(next);
      return ok(next);
    });
  }

  unarchive(id: string): Promise<Result<Habit>> {
    return attempt(async () => {
      const current = await this.db.habits.get(id);
      if (!current || !alive(current)) {
        return err<Habit>("not_found", ABITUDINE_NON_TROVATA);
      }
      if (current.archived_at === null) return ok(current);
      const next: Habit = {
        ...current,
        archived_at: null,
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.habits.put(next);
      return ok(next);
    });
  }

  softDelete(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", [this.db.habits, this.db.habit_logs], async () => {
        const row = await this.db.habits.get(id);
        if (!row) return err<void>("not_found", ABITUDINE_NON_TROVATA);
        if (row.deleted_at !== null) return ok(undefined);
        // Stesso deleted_at su abitudine e log vivi: il marchio del
        // cascade che l'undo sa distinguere.
        const now = bumpFrom(this.clock, row.updated_at);
        await this.db.habits.put({ ...row, deleted_at: now, updated_at: now });
        const logs = await this.db.habit_logs
          .where("habit_id")
          .equals(id)
          .toArray();
        const doomed = logs.filter(alive).map((l) => ({
          ...l,
          deleted_at: now,
          updated_at: bumpFrom(this.clock, l.updated_at),
        }));
        if (doomed.length > 0) await this.db.habit_logs.bulkPut(doomed);
        return ok(undefined);
      }),
    );
  }

  restore(id: string): Promise<Result<Habit>> {
    return attempt(async () =>
      this.db.transaction("rw", [this.db.habits, this.db.habit_logs], async () => {
        const row = await this.db.habits.get(id);
        if (!row) return err<Habit>("not_found", ABITUDINE_NON_TROVATA);
        if (row.deleted_at === null) return ok(row);
        const mark = row.deleted_at;
        const next: Habit = {
          ...row,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, row.updated_at),
        };
        await this.db.habits.put(next);
        // Revive SOLO i log del cascade (deleted_at identico).
        const logs = await this.db.habit_logs
          .where("habit_id")
          .equals(id)
          .toArray();
        const revived = logs
          .filter((l) => l.deleted_at === mark)
          .map((l) => ({
            ...l,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, l.updated_at),
          }));
        if (revived.length > 0) await this.db.habit_logs.bulkPut(revived);
        return ok(next);
      }),
    );
  }

  reorder(orderedIds: string[]): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.habits, async () => {
        for (const [index, id] of orderedIds.entries()) {
          const row = await this.db.habits.get(id);
          if (!row || !alive(row)) continue;
          if (row.sort_order === index) continue;
          await this.db.habits.put({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        return ok(undefined);
      }),
    );
  }

  async getById(id: string): Promise<Habit | null> {
    const row = await this.db.habits.get(id);
    return row && alive(row) ? row : null;
  }

  async listAll(opts?: { includeArchived?: boolean }): Promise<Habit[]> {
    const rows = (await this.db.habits.toArray()).filter(alive);
    const visible = opts?.includeArchived
      ? rows
      : rows.filter((h) => h.archived_at === null);
    return visible.sort(
      (a, b) =>
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at),
    );
  }

  logDay(
    habitId: string,
    date: IsoDay,
    value: number,
  ): Promise<Result<HabitLog>> {
    return this.writeDay(habitId, date, () => value);
  }

  incrementDay(
    habitId: string,
    date: IsoDay,
    delta: number,
  ): Promise<Result<HabitLog>> {
    return this.writeDay(habitId, date, (current) => current + delta);
  }

  /**
   * L'upsert per-giorno condiviso: legge la riga derivata, calcola il
   * prossimo valore (assoluto o incrementale) clampato al dominio, e
   * scrive rianimando un'eventuale tombstone del giorno.
   */
  private writeDay(
    habitId: string,
    date: IsoDay,
    nextValue: (current: number) => number,
  ): Promise<Result<HabitLog>> {
    return attempt(async () => {
      const habit = await this.db.habits.get(habitId);
      if (!habit || !alive(habit)) {
        return err<HabitLog>("not_found", ABITUDINE_NON_TROVATA);
      }
      const id = await habitLogId(habitId, date);
      const current = await this.db.habit_logs.get(id);
      const base = current && alive(current) ? current.value : 0;
      const raw = nextValue(base);
      const clamped = Math.max(0, Math.min(1_000_000, raw));
      const v = validate(HabitValueSchema, clamped);
      if (!v.ok) return v;

      if (current) {
        const next: HabitLog = {
          ...current,
          value: clamped,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.habit_logs.put(next);
        return ok(next);
      }
      const now = this.clock();
      const row: HabitLog = {
        id,
        habit_id: habitId,
        date,
        value: clamped,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.habit_logs.add(row);
      return ok(row);
    });
  }

  async getLog(habitId: string, date: IsoDay): Promise<HabitLog | null> {
    const row = await this.db.habit_logs.get(await habitLogId(habitId, date));
    return row && alive(row) ? row : null;
  }

  async listLogsByDay(date: IsoDay): Promise<HabitLog[]> {
    const rows = await this.db.habit_logs.where("date").equals(date).toArray();
    return rows.filter(alive);
  }

  async listLogsRange(
    habitId: string,
    from: IsoDay,
    to: IsoDay,
  ): Promise<HabitLog[]> {
    const rows = await this.db.habit_logs
      .where("habit_id")
      .equals(habitId)
      .toArray();
    return rows
      .filter((l) => alive(l) && l.date >= from && l.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async dayBoard(date: IsoDay): Promise<HabitBoardEntry[]> {
    const [habits, logs, latestWeight] = await Promise.all([
      this.listAll(),
      this.listLogsByDay(date),
      this.latestWeightKg(),
    ]);
    const logByHabit = new Map(logs.map((l) => [l.habit_id, l]));
    return habits
      .filter((habit) => isScheduledOn(habit, date))
      .map((habit) => {
        const log = logByHabit.get(habit.id) ?? null;
        const target = effectiveTarget(habit, latestWeight);
        const value = log?.value ?? 0;
        return {
          habit,
          log,
          target,
          value,
          done: habitDone(habit.kind, value, target),
        };
      });
  }

  async habitStreak(
    habitId: string,
    opts: { today: IsoDay },
  ): Promise<StreakSummary> {
    const habit = await this.db.habits.get(habitId);
    if (!habit || !alive(habit)) {
      return { current: 0, best: 0, todayCounts: false };
    }
    const [logs, settingsRow, latestWeight] = await Promise.all([
      this.db.habit_logs.where("habit_id").equals(habitId).toArray(),
      this.db.settings.get("local"),
      this.latestWeightKg(),
    ]);
    // Completamento valutato contro l'obiettivo effettivo CORRENTE:
    // deterministico e identico su ogni dispositivo (il log non
    // fotografa l'obiettivo del giorno — scelta documentata nel report).
    const target = effectiveTarget(habit, latestWeight);
    const doneDays = new Set(
      logs
        .filter((l) => alive(l) && habitDone(habit.kind, l.value, target))
        .map((l) => l.date),
    );
    const protectedDays = new Set(settingsRow?.protected_days ?? []);
    return computeSeriesStreak({
      doneDays,
      isBridge: (day) =>
        protectedDays.has(day) || !isScheduledOn(habit, day),
      today: opts.today,
    });
  }

  /** Peso della pesata più recente (per l'obiettivo derivato dell'acqua). */
  private async latestWeightKg(): Promise<number | null> {
    const rows = (await this.db.body.toArray()).filter(alive);
    if (rows.length === 0) return null;
    return rows.sort((a, b) => b.date.localeCompare(a.date))[0].weight_kg;
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => {
      const habits = await purgeTable(this.db.habits, olderThan);
      const logs = await purgeTable(this.db.habit_logs, olderThan);
      return ok(habits + logs);
    });
  }
}
