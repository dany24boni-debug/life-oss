/**
 * PlannerRepo su Dexie (run-08 prompt 3) — piani settimana + slot orari
 * + check per (slot, settimana ISO).
 *
 * Il check è UNA riga per (slot, settimana) per COSTRUZIONE: id
 * `deriveUuidV8("lifeos:slot-check:<slot_id>:<iso_week>")` — due
 * dispositivi che spuntano la stessa settimana convergono sulla stessa
 * PK (LWW). De-spuntare scrive `state: null` sulla stessa riga: anche
 * l'annullamento viaggia. La storia è append-only per costruzione: le
 * settimane passate restano righe indipendenti, mai riscritte dal
 * cambio del piano.
 *
 * Cascade (pattern programmi gym): eliminare un piano tombstona slot e
 * check con lo STESSO deleted_at; eliminare uno slot tombstona i suoi
 * check — il restore revive solo le righe di quel cascade.
 */

import type { LifeosDb } from "../db";
import { deriveUuidV8, uuidv7 } from "../ids";
import {
  computeWeekBoard,
  computeWeekStats,
  type IsoWeek,
  type WeekBoardDay,
  type WeekStats,
} from "../planner";
import type { PlannerRepo } from "../ports";
import { attempt, err, ok, type Result } from "../result";
import {
  IsoWeekSchema,
  PlanSlotCreateSchema,
  PlanSlotPatchSchema,
  SlotCheckStateSchema,
  WeekPlanCreateSchema,
  WeekPlanPatchSchema,
  type IsoInstant,
  type PlanSlot,
  type PlanSlotCreate,
  type PlanSlotPatch,
  type SlotCheck,
  type SlotCheckState,
  type WeekPlan,
  type WeekPlanCreate,
  type WeekPlanPatch,
} from "../schemas";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const PIANO_NON_TROVATO = "Piano non trovato.";
const SLOT_NON_TROVATO = "Slot non trovato.";

/** Id deterministico del check (slot, settimana ISO). */
export function slotCheckId(
  slotId: string,
  isoWeek: IsoWeek,
): Promise<string> {
  return deriveUuidV8(`lifeos:slot-check:${slotId}:${isoWeek}`);
}

export class LocalPlannerRepo implements PlannerRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  /* ── Piani ─────────────────────────────────────────────────────────── */

  createPlan(input: WeekPlanCreate): Promise<Result<WeekPlan>> {
    return attempt(async () => {
      const v = validate(WeekPlanCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const row: WeekPlan = {
        id: uuidv7(),
        name: v.data.name,
        is_active: v.data.is_active ?? false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      return this.db.transaction("rw", this.db.week_plans, async () => {
        await this.db.week_plans.add(row);
        if (row.is_active) await this.deactivateOthers(row.id);
        return ok(row);
      });
    });
  }

  updatePlan(id: string, patch: WeekPlanPatch): Promise<Result<WeekPlan>> {
    return attempt(async () => {
      const v = validate(WeekPlanPatchSchema, patch);
      if (!v.ok) return v;
      return this.db.transaction("rw", this.db.week_plans, async () => {
        const current = await this.db.week_plans.get(id);
        if (!current || !alive(current)) {
          return err<WeekPlan>("not_found", PIANO_NON_TROVATO);
        }
        const next: WeekPlan = {
          ...current,
          ...(v.data.name !== undefined && { name: v.data.name }),
          ...(v.data.is_active !== undefined && {
            is_active: v.data.is_active,
          }),
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.week_plans.put(next);
        if (next.is_active) await this.deactivateOthers(next.id);
        return ok(next);
      });
    });
  }

  /** Spegne ogni altro piano vivo attivo (dentro la transazione). */
  private async deactivateOthers(keepId: string): Promise<void> {
    const others = (await this.db.week_plans.toArray()).filter(
      (p) => p.id !== keepId && alive(p) && p.is_active,
    );
    for (const p of others) {
      await this.db.week_plans.put({
        ...p,
        is_active: false,
        updated_at: bumpFrom(this.clock, p.updated_at),
      });
    }
  }

  softDeletePlan(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.week_plans, this.db.plan_slots, this.db.slot_checks],
        async () => {
          const row = await this.db.week_plans.get(id);
          if (!row) return err<void>("not_found", PIANO_NON_TROVATO);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.week_plans.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          const slots = (
            await this.db.plan_slots.where("plan_id").equals(id).toArray()
          ).filter(alive);
          for (const slot of slots) {
            await this.db.plan_slots.put({
              ...slot,
              deleted_at: now,
              updated_at: bumpFrom(this.clock, slot.updated_at),
            });
            await this.tombstoneChecksOf(slot.id, now);
          }
          return ok(undefined);
        },
      ),
    );
  }

  restorePlan(id: string): Promise<Result<WeekPlan>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.week_plans, this.db.plan_slots, this.db.slot_checks],
        async () => {
          const row = await this.db.week_plans.get(id);
          if (!row) return err<WeekPlan>("not_found", PIANO_NON_TROVATO);
          if (row.deleted_at === null) return ok(row);
          const mark = row.deleted_at;
          const next: WeekPlan = {
            ...row,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, row.updated_at),
          };
          await this.db.week_plans.put(next);
          const slots = (
            await this.db.plan_slots.where("plan_id").equals(id).toArray()
          ).filter((s) => s.deleted_at === mark);
          for (const slot of slots) {
            await this.db.plan_slots.put({
              ...slot,
              deleted_at: null,
              updated_at: bumpFrom(this.clock, slot.updated_at),
            });
            await this.reviveChecksOf(slot.id, mark);
          }
          return ok(next);
        },
      ),
    );
  }

  duplicatePlan(id: string): Promise<Result<WeekPlan>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.week_plans, this.db.plan_slots],
        async () => {
          const source = await this.db.week_plans.get(id);
          if (!source || !alive(source)) {
            return err<WeekPlan>("not_found", PIANO_NON_TROVATO);
          }
          const now = this.clock();
          const copy: WeekPlan = {
            id: uuidv7(),
            name: `${source.name} (copia)`.slice(0, 120),
            is_active: false,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.week_plans.add(copy);
          const slots = (
            await this.db.plan_slots.where("plan_id").equals(id).toArray()
          ).filter(alive);
          for (const slot of slots) {
            await this.db.plan_slots.add({
              ...slot,
              id: uuidv7(),
              plan_id: copy.id,
              created_at: now,
              updated_at: now,
            });
          }
          return ok(copy);
        },
      ),
    );
  }

  async getPlanById(id: string): Promise<WeekPlan | null> {
    const row = await this.db.week_plans.get(id);
    return row && alive(row) ? row : null;
  }

  async listPlans(): Promise<WeekPlan[]> {
    const rows = (await this.db.week_plans.toArray()).filter(alive);
    return rows.sort(
      (a, b) =>
        Number(b.is_active) - Number(a.is_active) ||
        a.name.localeCompare(b.name, "it"),
    );
  }

  async activePlan(): Promise<WeekPlan | null> {
    const actives = (await this.db.week_plans.toArray()).filter(
      (p) => alive(p) && p.is_active,
    );
    if (actives.length === 0) return null;
    // Un merge può far coesistere più attivi: vince l'updated_at più
    // recente, deterministico su ogni device.
    return actives.sort((a, b) =>
      b.updated_at.localeCompare(a.updated_at),
    )[0];
  }

  /* ── Slot ──────────────────────────────────────────────────────────── */

  createSlot(input: PlanSlotCreate): Promise<Result<PlanSlot>> {
    return attempt(async () => {
      const v = validate(PlanSlotCreateSchema, input);
      if (!v.ok) return v;
      const plan = await this.db.week_plans.get(v.data.plan_id);
      if (!plan || !alive(plan)) {
        return err<PlanSlot>("not_found", PIANO_NON_TROVATO);
      }
      const now = this.clock();
      const row: PlanSlot = {
        id: uuidv7(),
        plan_id: v.data.plan_id,
        weekday: v.data.weekday,
        start_hhmm: v.data.start_hhmm,
        end_hhmm: v.data.end_hhmm ?? null,
        title: v.data.title,
        notes: v.data.notes ?? null,
        sort_order: v.data.sort_order ?? 0,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.plan_slots.add(row);
      return ok(row);
    });
  }

  updateSlot(id: string, patch: PlanSlotPatch): Promise<Result<PlanSlot>> {
    return attempt(async () => {
      const v = validate(PlanSlotPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.plan_slots.get(id);
      if (!current || !alive(current)) {
        return err<PlanSlot>("not_found", SLOT_NON_TROVATO);
      }
      const next: PlanSlot = {
        ...current,
        ...(v.data.weekday !== undefined && { weekday: v.data.weekday }),
        ...(v.data.start_hhmm !== undefined && {
          start_hhmm: v.data.start_hhmm,
        }),
        ...(v.data.end_hhmm !== undefined && { end_hhmm: v.data.end_hhmm }),
        ...(v.data.title !== undefined && { title: v.data.title }),
        ...(v.data.notes !== undefined && { notes: v.data.notes }),
        ...(v.data.sort_order !== undefined && {
          sort_order: v.data.sort_order,
        }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.plan_slots.put(next);
      return ok(next);
    });
  }

  softDeleteSlot(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.plan_slots, this.db.slot_checks],
        async () => {
          const row = await this.db.plan_slots.get(id);
          if (!row) return err<void>("not_found", SLOT_NON_TROVATO);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.plan_slots.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          await this.tombstoneChecksOf(id, now);
          return ok(undefined);
        },
      ),
    );
  }

  restoreSlot(id: string): Promise<Result<PlanSlot>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.plan_slots, this.db.slot_checks],
        async () => {
          const row = await this.db.plan_slots.get(id);
          if (!row) return err<PlanSlot>("not_found", SLOT_NON_TROVATO);
          if (row.deleted_at === null) return ok(row);
          const mark = row.deleted_at;
          const next: PlanSlot = {
            ...row,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, row.updated_at),
          };
          await this.db.plan_slots.put(next);
          await this.reviveChecksOf(id, mark);
          return ok(next);
        },
      ),
    );
  }

  /** Tombstone ai check vivi dello slot, con lo stesso deleted_at. */
  private async tombstoneChecksOf(
    slotId: string,
    mark: IsoInstant,
  ): Promise<void> {
    const checks = (
      await this.db.slot_checks.where("slot_id").equals(slotId).toArray()
    ).filter(alive);
    for (const check of checks) {
      await this.db.slot_checks.put({
        ...check,
        deleted_at: mark,
        updated_at: bumpFrom(this.clock, check.updated_at),
      });
    }
  }

  /** Revive SOLO i check del cascade (deleted_at identico). */
  private async reviveChecksOf(
    slotId: string,
    mark: IsoInstant,
  ): Promise<void> {
    const checks = (
      await this.db.slot_checks.where("slot_id").equals(slotId).toArray()
    ).filter((c) => c.deleted_at === mark);
    for (const check of checks) {
      await this.db.slot_checks.put({
        ...check,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, check.updated_at),
      });
    }
  }

  copySlotToWeekdays(
    id: string,
    weekdays: number[],
  ): Promise<Result<PlanSlot[]>> {
    return attempt(async () => {
      const source = await this.db.plan_slots.get(id);
      if (!source || !alive(source)) {
        return err<PlanSlot[]>("not_found", SLOT_NON_TROVATO);
      }
      const targets = [...new Set(weekdays)]
        .filter((d) => d >= 1 && d <= 7 && d !== source.weekday)
        .sort((a, b) => a - b);
      const copies: PlanSlot[] = [];
      for (const weekday of targets) {
        const now = this.clock();
        const copy: PlanSlot = {
          ...source,
          id: uuidv7(),
          weekday,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        };
        await this.db.plan_slots.add(copy);
        copies.push(copy);
      }
      return ok(copies);
    });
  }

  async listSlots(planId: string): Promise<PlanSlot[]> {
    const rows = (
      await this.db.plan_slots.where("plan_id").equals(planId).toArray()
    ).filter(alive);
    return rows.sort(
      (a, b) =>
        a.weekday - b.weekday ||
        a.start_hhmm.localeCompare(b.start_hhmm) ||
        a.sort_order - b.sort_order ||
        a.created_at.localeCompare(b.created_at),
    );
  }

  reorderSlots(planId: string, orderedIds: string[]): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.plan_slots, async () => {
        for (const [index, id] of orderedIds.entries()) {
          const row = await this.db.plan_slots.get(id);
          if (!row || !alive(row) || row.plan_id !== planId) continue;
          if (row.sort_order === index) continue;
          await this.db.plan_slots.put({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        return ok(undefined);
      }),
    );
  }

  /* ── Check per settimana ───────────────────────────────────────────── */

  setCheck(
    slotId: string,
    isoWeek: IsoWeek,
    state: SlotCheckState | null,
  ): Promise<Result<SlotCheck>> {
    return attempt(async () => {
      const w = validate(IsoWeekSchema, isoWeek);
      if (!w.ok) return w;
      if (state !== null) {
        const s = validate(SlotCheckStateSchema, state);
        if (!s.ok) return s;
      }
      const slot = await this.db.plan_slots.get(slotId);
      if (!slot || !alive(slot)) {
        return err<SlotCheck>("not_found", SLOT_NON_TROVATO);
      }
      const id = await slotCheckId(slotId, isoWeek);
      const current = await this.db.slot_checks.get(id);
      const now = this.clock();

      if (current) {
        const next: SlotCheck = {
          ...current,
          state,
          checked_at: state === null ? null : now,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.slot_checks.put(next);
        return ok(next);
      }
      const row: SlotCheck = {
        id,
        slot_id: slotId,
        iso_week: isoWeek,
        state,
        checked_at: state === null ? null : now,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.slot_checks.add(row);
      return ok(row);
    });
  }

  async getCheck(slotId: string, isoWeek: IsoWeek): Promise<SlotCheck | null> {
    const row = await this.db.slot_checks.get(await slotCheckId(slotId, isoWeek));
    return row && alive(row) ? row : null;
  }

  async listChecksForWeek(isoWeek: IsoWeek): Promise<SlotCheck[]> {
    const rows = await this.db.slot_checks
      .where("iso_week")
      .equals(isoWeek)
      .toArray();
    return rows.filter(alive);
  }

  /* ── Letture composte (matematica pura in data/planner.ts) ─────────── */

  async weekBoard(planId: string, isoWeek: IsoWeek): Promise<WeekBoardDay[]> {
    const [slots, checks] = await Promise.all([
      this.listSlots(planId),
      this.listChecksForWeek(isoWeek),
    ]);
    return computeWeekBoard(slots, checks, isoWeek);
  }

  async weekStats(
    planId: string,
    lastNWeeks: number,
    currentWeek: IsoWeek,
  ): Promise<WeekStats> {
    const slots = await this.listSlots(planId);
    const slotIds = new Set(slots.map((s) => s.id));
    const checks = (await this.db.slot_checks.toArray()).filter(
      (c) => alive(c) && slotIds.has(c.slot_id),
    );
    return computeWeekStats(slots, checks, currentWeek, lastNWeeks);
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => {
      const plans = await purgeTable(this.db.week_plans, olderThan);
      const slots = await purgeTable(this.db.plan_slots, olderThan);
      const checks = await purgeTable(this.db.slot_checks, olderThan);
      return ok(plans + slots + checks);
    });
  }
}
