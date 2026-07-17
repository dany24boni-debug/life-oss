/**
 * DietRepo su Dexie (run-09 prompt 1) — libreria alimenti personale,
 * piano settimanale di pasti con varianti, log per (pasto, giorno) ed
 * extra del giorno.
 *
 * Il log è UNA riga per (pasto, giorno) per COSTRUZIONE: id
 * `deriveUuidV8("lifeos:meal-log:<meal_id>:<date>")` — due dispositivi
 * che loggano lo stesso pasto convergono sulla stessa PK e il sync
 * fonde con LWW; s-mangiare scrive eaten:false sulla STESSA riga, così
 * anche l'annullamento viaggia (pattern dei check del planner).
 *
 * Cascade (pattern programmi gym): piano → pasti → varianti + righe +
 * log, tutti con lo STESSO deleted_at; il restore revive solo le righe
 * di quel cascade. Gli alimenti NON cascano mai dai pasti: una riga che
 * referenzia un alimento eliminato esce dai conti (totals null in
 * data/diet.ts), mai un buco che lancia.
 */

import type { LifeosDb } from "../db";
import {
  composeDayMeals,
  dayTotals,
  extraView,
  type DayDiet,
  type DietExtraView,
} from "../diet";
import { weekdayOfDay } from "../habits";
import { deriveUuidV8, uuidv7 } from "../ids";
import type { DietRepo } from "../ports";
import { attempt, err, ok, type Result } from "../result";
import { dayRange } from "../streak";
import {
  DietExtraCreateSchema,
  DietExtraPatchSchema,
  DietMealCreateSchema,
  DietMealPatchSchema,
  DietPlanCreateSchema,
  DietPlanPatchSchema,
  FoodCreateSchema,
  FoodPatchSchema,
  MealItemCreateSchema,
  MealItemPatchSchema,
  MealVariantCreateSchema,
  MealVariantPatchSchema,
  type DietExtra,
  type DietExtraCreate,
  type DietExtraPatch,
  type DietMeal,
  type DietMealCreate,
  type DietMealPatch,
  type DietPlan,
  type DietPlanCreate,
  type DietPlanPatch,
  type Food,
  type FoodCreate,
  type FoodPatch,
  type IsoDay,
  type IsoInstant,
  type MealItem,
  type MealItemCreate,
  type MealItemPatch,
  type MealLog,
  type MealVariant,
  type MealVariantCreate,
  type MealVariantPatch,
} from "../schemas";
import {
  alive,
  bumpFrom,
  monotonicClock,
  purgeTable,
  validate,
  type Clock,
} from "./util";

const ALIMENTO_NON_TROVATO = "Alimento non trovato.";
const PIANO_NON_TROVATO = "Piano non trovato.";
const PASTO_NON_TROVATO = "Pasto non trovato.";
const VARIANTE_NON_TROVATA = "Variante non trovata.";
const RIGA_NON_TROVATA = "Riga non trovata.";
const EXTRA_NON_TROVATO = "Extra non trovato.";

/** Id deterministico del log (pasto, giorno). */
export function mealLogId(mealId: string, date: IsoDay): Promise<string> {
  return deriveUuidV8(`lifeos:meal-log:${mealId}:${date}`);
}

const bySort = <T extends { sort_order: number; created_at: string }>(
  a: T,
  b: T,
): number =>
  a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at);

export class LocalDietRepo implements DietRepo {
  constructor(
    private readonly db: LifeosDb,
    private readonly clock: Clock = monotonicClock(),
  ) {}

  /* ── Alimenti ──────────────────────────────────────────────────────── */

  createFood(input: FoodCreate): Promise<Result<Food>> {
    return attempt(async () => {
      const v = validate(FoodCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const row: Food = {
        id: uuidv7(),
        name: v.data.name,
        basis: v.data.basis,
        kcal: v.data.kcal,
        protein_g: v.data.protein_g ?? 0,
        carbs_g: v.data.carbs_g ?? 0,
        fat_g: v.data.fat_g ?? 0,
        default_qty: v.data.default_qty ?? null,
        archived_at: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.foods.add(row);
      return ok(row);
    });
  }

  updateFood(id: string, patch: FoodPatch): Promise<Result<Food>> {
    return attempt(async () => {
      const v = validate(FoodPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.foods.get(id);
      if (!current || !alive(current)) {
        return err<Food>("not_found", ALIMENTO_NON_TROVATO);
      }
      const next: Food = {
        ...current,
        ...(v.data.name !== undefined && { name: v.data.name }),
        ...(v.data.kcal !== undefined && { kcal: v.data.kcal }),
        ...(v.data.protein_g !== undefined && { protein_g: v.data.protein_g }),
        ...(v.data.carbs_g !== undefined && { carbs_g: v.data.carbs_g }),
        ...(v.data.fat_g !== undefined && { fat_g: v.data.fat_g }),
        ...(v.data.default_qty !== undefined && {
          default_qty: v.data.default_qty,
        }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.foods.put(next);
      return ok(next);
    });
  }

  archiveFood(id: string): Promise<Result<Food>> {
    return attempt(async () => {
      const current = await this.db.foods.get(id);
      if (!current || !alive(current)) {
        return err<Food>("not_found", ALIMENTO_NON_TROVATO);
      }
      if (current.archived_at !== null) return ok(current);
      const now = bumpFrom(this.clock, current.updated_at);
      const next: Food = { ...current, archived_at: now, updated_at: now };
      await this.db.foods.put(next);
      return ok(next);
    });
  }

  unarchiveFood(id: string): Promise<Result<Food>> {
    return attempt(async () => {
      const current = await this.db.foods.get(id);
      if (!current || !alive(current)) {
        return err<Food>("not_found", ALIMENTO_NON_TROVATO);
      }
      if (current.archived_at === null) return ok(current);
      const next: Food = {
        ...current,
        archived_at: null,
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.foods.put(next);
      return ok(next);
    });
  }

  softDeleteFood(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.foods.get(id);
      if (!row) return err<void>("not_found", ALIMENTO_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.foods.put({ ...row, deleted_at: now, updated_at: now });
      return ok(undefined);
    });
  }

  restoreFood(id: string): Promise<Result<Food>> {
    return attempt(async () => {
      const row = await this.db.foods.get(id);
      if (!row) return err<Food>("not_found", ALIMENTO_NON_TROVATO);
      if (row.deleted_at === null) return ok(row);
      const next: Food = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.foods.put(next);
      return ok(next);
    });
  }

  async getFoodById(id: string): Promise<Food | null> {
    const row = await this.db.foods.get(id);
    return row && alive(row) ? row : null;
  }

  async listFoods(opts?: { includeArchived?: boolean }): Promise<Food[]> {
    const rows = (await this.db.foods.toArray()).filter(alive);
    const visible = opts?.includeArchived
      ? rows
      : rows.filter((f) => f.archived_at === null);
    return visible.sort((a, b) => a.name.localeCompare(b.name, "it"));
  }

  /* ── Piani ─────────────────────────────────────────────────────────── */

  createPlan(input: DietPlanCreate): Promise<Result<DietPlan>> {
    return attempt(async () => {
      const v = validate(DietPlanCreateSchema, input);
      if (!v.ok) return v;
      const now = this.clock();
      const row: DietPlan = {
        id: uuidv7(),
        name: v.data.name,
        is_active: v.data.is_active ?? false,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      return this.db.transaction("rw", this.db.diet_plans, async () => {
        await this.db.diet_plans.add(row);
        if (row.is_active) await this.deactivateOthers(row.id);
        return ok(row);
      });
    });
  }

  updatePlan(id: string, patch: DietPlanPatch): Promise<Result<DietPlan>> {
    return attempt(async () => {
      const v = validate(DietPlanPatchSchema, patch);
      if (!v.ok) return v;
      return this.db.transaction("rw", this.db.diet_plans, async () => {
        const current = await this.db.diet_plans.get(id);
        if (!current || !alive(current)) {
          return err<DietPlan>("not_found", PIANO_NON_TROVATO);
        }
        const next: DietPlan = {
          ...current,
          ...(v.data.name !== undefined && { name: v.data.name }),
          ...(v.data.is_active !== undefined && {
            is_active: v.data.is_active,
          }),
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.diet_plans.put(next);
        if (next.is_active) await this.deactivateOthers(next.id);
        return ok(next);
      });
    });
  }

  /** Spegne ogni altro piano vivo attivo (dentro la transazione). */
  private async deactivateOthers(keepId: string): Promise<void> {
    const others = (await this.db.diet_plans.toArray()).filter(
      (p) => p.id !== keepId && alive(p) && p.is_active,
    );
    for (const p of others) {
      await this.db.diet_plans.put({
        ...p,
        is_active: false,
        updated_at: bumpFrom(this.clock, p.updated_at),
      });
    }
  }

  private dietTables() {
    return [
      this.db.diet_plans,
      this.db.diet_meals,
      this.db.meal_variants,
      this.db.meal_items,
      this.db.meal_logs,
    ];
  }

  softDeletePlan(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.dietTables(), async () => {
        const row = await this.db.diet_plans.get(id);
        if (!row) return err<void>("not_found", PIANO_NON_TROVATO);
        if (row.deleted_at !== null) return ok(undefined);
        const now = bumpFrom(this.clock, row.updated_at);
        await this.db.diet_plans.put({
          ...row,
          deleted_at: now,
          updated_at: now,
        });
        const meals = (
          await this.db.diet_meals.where("plan_id").equals(id).toArray()
        ).filter(alive);
        for (const meal of meals) {
          await this.db.diet_meals.put({
            ...meal,
            deleted_at: now,
            updated_at: bumpFrom(this.clock, meal.updated_at),
          });
          await this.tombstoneMealChildren(meal.id, now);
        }
        return ok(undefined);
      }),
    );
  }

  restorePlan(id: string): Promise<Result<DietPlan>> {
    return attempt(async () =>
      this.db.transaction("rw", this.dietTables(), async () => {
        const row = await this.db.diet_plans.get(id);
        if (!row) return err<DietPlan>("not_found", PIANO_NON_TROVATO);
        if (row.deleted_at === null) return ok(row);
        const mark = row.deleted_at;
        const next: DietPlan = {
          ...row,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, row.updated_at),
        };
        await this.db.diet_plans.put(next);
        const meals = (
          await this.db.diet_meals.where("plan_id").equals(id).toArray()
        ).filter((m) => m.deleted_at === mark);
        for (const meal of meals) {
          await this.db.diet_meals.put({
            ...meal,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, meal.updated_at),
          });
          await this.reviveMealChildren(meal.id, mark);
        }
        return ok(next);
      }),
    );
  }

  duplicatePlan(id: string): Promise<Result<DietPlan>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [
          this.db.diet_plans,
          this.db.diet_meals,
          this.db.meal_variants,
          this.db.meal_items,
        ],
        async () => {
          const source = await this.db.diet_plans.get(id);
          if (!source || !alive(source)) {
            return err<DietPlan>("not_found", PIANO_NON_TROVATO);
          }
          const now = this.clock();
          const copy: DietPlan = {
            id: uuidv7(),
            name: `${source.name} (copia)`.slice(0, 120),
            is_active: false,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.diet_plans.add(copy);
          const meals = (
            await this.db.diet_meals.where("plan_id").equals(id).toArray()
          ).filter(alive);
          for (const meal of meals) {
            await this.copyMealDeep(meal, {
              planId: copy.id,
              weekday: meal.weekday,
              name: meal.name,
              sortOrder: meal.sort_order,
            });
          }
          return ok(copy);
        },
      ),
    );
  }

  async getPlanById(id: string): Promise<DietPlan | null> {
    const row = await this.db.diet_plans.get(id);
    return row && alive(row) ? row : null;
  }

  async listPlans(): Promise<DietPlan[]> {
    const rows = (await this.db.diet_plans.toArray()).filter(alive);
    return rows.sort(
      (a, b) =>
        Number(b.is_active) - Number(a.is_active) ||
        a.name.localeCompare(b.name, "it"),
    );
  }

  async activePlan(): Promise<DietPlan | null> {
    const actives = (await this.db.diet_plans.toArray()).filter(
      (p) => alive(p) && p.is_active,
    );
    if (actives.length === 0) return null;
    // Un merge può far coesistere più attivi: vince l'updated_at più
    // recente, deterministico su ogni device.
    return actives.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  }

  /* ── Pasti ─────────────────────────────────────────────────────────── */

  createMeal(input: DietMealCreate): Promise<Result<DietMeal>> {
    return attempt(async () => {
      const v = validate(DietMealCreateSchema, input);
      if (!v.ok) return v;
      const plan = await this.db.diet_plans.get(v.data.plan_id);
      if (!plan || !alive(plan)) {
        return err<DietMeal>("not_found", PIANO_NON_TROVATO);
      }
      const now = this.clock();
      const siblings = (
        await this.db.diet_meals
          .where("plan_id")
          .equals(v.data.plan_id)
          .toArray()
      ).filter((m) => alive(m) && m.weekday === v.data.weekday);
      const maxSort = siblings.reduce(
        (max, m) => Math.max(max, m.sort_order),
        -1,
      );
      const row: DietMeal = {
        id: uuidv7(),
        plan_id: v.data.plan_id,
        weekday: v.data.weekday,
        name: v.data.name,
        sort_order: v.data.sort_order ?? maxSort + 1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.diet_meals.add(row);
      return ok(row);
    });
  }

  updateMeal(id: string, patch: DietMealPatch): Promise<Result<DietMeal>> {
    return attempt(async () => {
      const v = validate(DietMealPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.diet_meals.get(id);
      if (!current || !alive(current)) {
        return err<DietMeal>("not_found", PASTO_NON_TROVATO);
      }
      const next: DietMeal = {
        ...current,
        ...(v.data.weekday !== undefined && { weekday: v.data.weekday }),
        ...(v.data.name !== undefined && { name: v.data.name }),
        ...(v.data.sort_order !== undefined && {
          sort_order: v.data.sort_order,
        }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.diet_meals.put(next);
      return ok(next);
    });
  }

  /** Tombstone a varianti, righe e log vivi del pasto (stesso mark). */
  private async tombstoneMealChildren(
    mealId: string,
    mark: IsoInstant,
  ): Promise<void> {
    const stamp = async <T extends { updated_at: IsoInstant }>(
      rows: T[],
      put: (row: T) => Promise<unknown>,
    ) => {
      for (const row of rows) {
        await put({
          ...row,
          deleted_at: mark,
          updated_at: bumpFrom(this.clock, row.updated_at),
        });
      }
    };
    await stamp(
      (
        await this.db.meal_variants.where("meal_id").equals(mealId).toArray()
      ).filter(alive),
      (r) => this.db.meal_variants.put(r),
    );
    await stamp(
      (
        await this.db.meal_items.where("meal_id").equals(mealId).toArray()
      ).filter(alive),
      (r) => this.db.meal_items.put(r),
    );
    await stamp(
      (
        await this.db.meal_logs.where("meal_id").equals(mealId).toArray()
      ).filter(alive),
      (r) => this.db.meal_logs.put(r),
    );
  }

  /** Revive SOLO le righe del cascade (deleted_at identico). */
  private async reviveMealChildren(
    mealId: string,
    mark: IsoInstant,
  ): Promise<void> {
    const revive = async <T extends { updated_at: IsoInstant }>(
      rows: T[],
      put: (row: T) => Promise<unknown>,
    ) => {
      for (const row of rows) {
        await put({
          ...row,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, row.updated_at),
        });
      }
    };
    await revive(
      (
        await this.db.meal_variants.where("meal_id").equals(mealId).toArray()
      ).filter((r) => r.deleted_at === mark),
      (r) => this.db.meal_variants.put(r),
    );
    await revive(
      (
        await this.db.meal_items.where("meal_id").equals(mealId).toArray()
      ).filter((r) => r.deleted_at === mark),
      (r) => this.db.meal_items.put(r),
    );
    await revive(
      (
        await this.db.meal_logs.where("meal_id").equals(mealId).toArray()
      ).filter((r) => r.deleted_at === mark),
      (r) => this.db.meal_logs.put(r),
    );
  }

  softDeleteMeal(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [
          this.db.diet_meals,
          this.db.meal_variants,
          this.db.meal_items,
          this.db.meal_logs,
        ],
        async () => {
          const row = await this.db.diet_meals.get(id);
          if (!row) return err<void>("not_found", PASTO_NON_TROVATO);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.diet_meals.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          await this.tombstoneMealChildren(id, now);
          return ok(undefined);
        },
      ),
    );
  }

  restoreMeal(id: string): Promise<Result<DietMeal>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [
          this.db.diet_meals,
          this.db.meal_variants,
          this.db.meal_items,
          this.db.meal_logs,
        ],
        async () => {
          const row = await this.db.diet_meals.get(id);
          if (!row) return err<DietMeal>("not_found", PASTO_NON_TROVATO);
          if (row.deleted_at === null) return ok(row);
          const mark = row.deleted_at;
          const next: DietMeal = {
            ...row,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, row.updated_at),
          };
          await this.db.diet_meals.put(next);
          await this.reviveMealChildren(id, mark);
          return ok(next);
        },
      ),
    );
  }

  /**
   * Copia profonda di un pasto (varianti + righe, log MAI: la storia
   * resta all'originale). Da chiamare dentro una transazione.
   */
  private async copyMealDeep(
    source: DietMeal,
    target: {
      planId: string;
      weekday: number;
      name: string;
      sortOrder: number;
    },
  ): Promise<DietMeal> {
    const now = this.clock();
    const copy: DietMeal = {
      id: uuidv7(),
      plan_id: target.planId,
      weekday: target.weekday,
      name: target.name.slice(0, 120),
      sort_order: target.sortOrder,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    await this.db.diet_meals.add(copy);

    const variants = (
      await this.db.meal_variants.where("meal_id").equals(source.id).toArray()
    ).filter(alive);
    const variantIdMap = new Map<string, string>();
    for (const variant of variants) {
      const variantCopy: MealVariant = {
        ...variant,
        id: uuidv7(),
        meal_id: copy.id,
        created_at: now,
        updated_at: now,
      };
      variantIdMap.set(variant.id, variantCopy.id);
      await this.db.meal_variants.add(variantCopy);
    }
    const items = (
      await this.db.meal_items.where("meal_id").equals(source.id).toArray()
    ).filter(alive);
    for (const item of items) {
      // Riga di una variante il cui id non è mappato (incoerenza da
      // merge): salta — mai una copia che punta alla variante altrui.
      const variantId =
        item.variant_id === null
          ? null
          : (variantIdMap.get(item.variant_id) ?? undefined);
      if (variantId === undefined) continue;
      await this.db.meal_items.add({
        ...item,
        id: uuidv7(),
        meal_id: copy.id,
        variant_id: variantId,
        created_at: now,
        updated_at: now,
      });
    }
    return copy;
  }

  duplicateMeal(id: string): Promise<Result<DietMeal>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.diet_meals, this.db.meal_variants, this.db.meal_items],
        async () => {
          const source = await this.db.diet_meals.get(id);
          if (!source || !alive(source)) {
            return err<DietMeal>("not_found", PASTO_NON_TROVATO);
          }
          const siblings = (
            await this.db.diet_meals
              .where("plan_id")
              .equals(source.plan_id)
              .toArray()
          ).filter((m) => alive(m) && m.weekday === source.weekday);
          const maxSort = siblings.reduce(
            (max, m) => Math.max(max, m.sort_order),
            -1,
          );
          const copy = await this.copyMealDeep(source, {
            planId: source.plan_id,
            weekday: source.weekday,
            name: `${source.name} (copia)`,
            sortOrder: maxSort + 1,
          });
          return ok(copy);
        },
      ),
    );
  }

  copyMealToWeekdays(
    id: string,
    weekdays: number[],
  ): Promise<Result<DietMeal[]>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.diet_meals, this.db.meal_variants, this.db.meal_items],
        async () => {
          const source = await this.db.diet_meals.get(id);
          if (!source || !alive(source)) {
            return err<DietMeal[]>("not_found", PASTO_NON_TROVATO);
          }
          const targets = [...new Set(weekdays)]
            .filter((d) => d >= 1 && d <= 7 && d !== source.weekday)
            .sort((a, b) => a - b);
          const siblings = (
            await this.db.diet_meals
              .where("plan_id")
              .equals(source.plan_id)
              .toArray()
          ).filter(alive);
          const copies: DietMeal[] = [];
          for (const weekday of targets) {
            const maxSort = siblings
              .filter((m) => m.weekday === weekday)
              .reduce((max, m) => Math.max(max, m.sort_order), -1);
            copies.push(
              await this.copyMealDeep(source, {
                planId: source.plan_id,
                weekday,
                name: source.name,
                sortOrder: maxSort + 1,
              }),
            );
          }
          return ok(copies);
        },
      ),
    );
  }

  copyDayToWeekdays(
    planId: string,
    fromWeekday: number,
    weekdays: number[],
  ): Promise<Result<DietMeal[]>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [
          this.db.diet_plans,
          this.db.diet_meals,
          this.db.meal_variants,
          this.db.meal_items,
        ],
        async () => {
          const plan = await this.db.diet_plans.get(planId);
          if (!plan || !alive(plan)) {
            return err<DietMeal[]>("not_found", PIANO_NON_TROVATO);
          }
          const meals = (
            await this.db.diet_meals.where("plan_id").equals(planId).toArray()
          ).filter(alive);
          const sourceMeals = meals
            .filter((m) => m.weekday === fromWeekday)
            .sort(bySort);
          const targets = [...new Set(weekdays)]
            .filter((d) => d >= 1 && d <= 7 && d !== fromWeekday)
            .sort((a, b) => a - b);
          const copies: DietMeal[] = [];
          for (const weekday of targets) {
            let sortOrder =
              meals
                .filter((m) => m.weekday === weekday)
                .reduce((max, m) => Math.max(max, m.sort_order), -1) + 1;
            for (const source of sourceMeals) {
              copies.push(
                await this.copyMealDeep(source, {
                  planId,
                  weekday,
                  name: source.name,
                  sortOrder: sortOrder++,
                }),
              );
            }
          }
          return ok(copies);
        },
      ),
    );
  }

  async getMealById(id: string): Promise<DietMeal | null> {
    const row = await this.db.diet_meals.get(id);
    return row && alive(row) ? row : null;
  }

  async listMeals(planId: string): Promise<DietMeal[]> {
    const rows = (
      await this.db.diet_meals.where("plan_id").equals(planId).toArray()
    ).filter(alive);
    return rows.sort((a, b) => a.weekday - b.weekday || bySort(a, b));
  }

  reorderMeals(
    planId: string,
    weekday: number,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.diet_meals, async () => {
        for (const [index, id] of orderedIds.entries()) {
          const row = await this.db.diet_meals.get(id);
          if (
            !row ||
            !alive(row) ||
            row.plan_id !== planId ||
            row.weekday !== weekday
          ) {
            continue;
          }
          if (row.sort_order === index) continue;
          await this.db.diet_meals.put({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        return ok(undefined);
      }),
    );
  }

  /* ── Varianti ──────────────────────────────────────────────────────── */

  createVariant(input: MealVariantCreate): Promise<Result<MealVariant>> {
    return attempt(async () => {
      const v = validate(MealVariantCreateSchema, input);
      if (!v.ok) return v;
      const meal = await this.db.diet_meals.get(v.data.meal_id);
      if (!meal || !alive(meal)) {
        return err<MealVariant>("not_found", PASTO_NON_TROVATO);
      }
      const now = this.clock();
      const siblings = (
        await this.db.meal_variants
          .where("meal_id")
          .equals(v.data.meal_id)
          .toArray()
      ).filter(alive);
      const maxSort = siblings.reduce(
        (max, s) => Math.max(max, s.sort_order),
        -1,
      );
      const row: MealVariant = {
        id: uuidv7(),
        meal_id: v.data.meal_id,
        name: v.data.name,
        sort_order: v.data.sort_order ?? maxSort + 1,
        training: v.data.training ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.meal_variants.add(row);
      return ok(row);
    });
  }

  createVariantFromBase(
    mealId: string,
    name?: string,
  ): Promise<Result<MealVariant>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.diet_meals, this.db.meal_variants, this.db.meal_items],
        async () => {
          const meal = await this.db.diet_meals.get(mealId);
          if (!meal || !alive(meal)) {
            return err<MealVariant>("not_found", PASTO_NON_TROVATO);
          }
          const siblings = (
            await this.db.meal_variants
              .where("meal_id")
              .equals(mealId)
              .toArray()
          ).filter(alive);
          // La base è la "A": la prima variante nasce "Variante B".
          const letter = String.fromCharCode(
            66 + Math.min(siblings.length, 24),
          );
          const maxSort = siblings.reduce(
            (max, s) => Math.max(max, s.sort_order),
            -1,
          );
          const now = this.clock();
          const variant: MealVariant = {
            id: uuidv7(),
            meal_id: mealId,
            name: (name ?? `Variante ${letter}`).slice(0, 120),
            sort_order: maxSort + 1,
            training: null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          };
          await this.db.meal_variants.add(variant);
          const baseItems = (
            await this.db.meal_items.where("meal_id").equals(mealId).toArray()
          ).filter((i) => alive(i) && i.variant_id === null);
          for (const item of baseItems) {
            await this.db.meal_items.add({
              ...item,
              id: uuidv7(),
              variant_id: variant.id,
              created_at: now,
              updated_at: now,
            });
          }
          return ok(variant);
        },
      ),
    );
  }

  updateVariant(
    id: string,
    patch: MealVariantPatch,
  ): Promise<Result<MealVariant>> {
    return attempt(async () => {
      const v = validate(MealVariantPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.meal_variants.get(id);
      if (!current || !alive(current)) {
        return err<MealVariant>("not_found", VARIANTE_NON_TROVATA);
      }
      const next: MealVariant = {
        ...current,
        ...(v.data.name !== undefined && { name: v.data.name }),
        ...(v.data.sort_order !== undefined && {
          sort_order: v.data.sort_order,
        }),
        ...(v.data.training !== undefined && { training: v.data.training }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.meal_variants.put(next);
      return ok(next);
    });
  }

  softDeleteVariant(id: string): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.meal_variants, this.db.meal_items],
        async () => {
          const row = await this.db.meal_variants.get(id);
          if (!row) return err<void>("not_found", VARIANTE_NON_TROVATA);
          if (row.deleted_at !== null) return ok(undefined);
          const now = bumpFrom(this.clock, row.updated_at);
          await this.db.meal_variants.put({
            ...row,
            deleted_at: now,
            updated_at: now,
          });
          const items = (
            await this.db.meal_items
              .where("meal_id")
              .equals(row.meal_id)
              .toArray()
          ).filter((i) => alive(i) && i.variant_id === id);
          for (const item of items) {
            await this.db.meal_items.put({
              ...item,
              deleted_at: now,
              updated_at: bumpFrom(this.clock, item.updated_at),
            });
          }
          return ok(undefined);
        },
      ),
    );
  }

  restoreVariant(id: string): Promise<Result<MealVariant>> {
    return attempt(async () =>
      this.db.transaction(
        "rw",
        [this.db.meal_variants, this.db.meal_items],
        async () => {
          const row = await this.db.meal_variants.get(id);
          if (!row) return err<MealVariant>("not_found", VARIANTE_NON_TROVATA);
          if (row.deleted_at === null) return ok(row);
          const mark = row.deleted_at;
          const next: MealVariant = {
            ...row,
            deleted_at: null,
            updated_at: bumpFrom(this.clock, row.updated_at),
          };
          await this.db.meal_variants.put(next);
          const items = (
            await this.db.meal_items
              .where("meal_id")
              .equals(row.meal_id)
              .toArray()
          ).filter((i) => i.variant_id === id && i.deleted_at === mark);
          for (const item of items) {
            await this.db.meal_items.put({
              ...item,
              deleted_at: null,
              updated_at: bumpFrom(this.clock, item.updated_at),
            });
          }
          return ok(next);
        },
      ),
    );
  }

  async listVariants(mealId: string): Promise<MealVariant[]> {
    const rows = (
      await this.db.meal_variants.where("meal_id").equals(mealId).toArray()
    ).filter(alive);
    return rows.sort(bySort);
  }

  reorderVariants(
    mealId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.meal_variants, async () => {
        for (const [index, id] of orderedIds.entries()) {
          const row = await this.db.meal_variants.get(id);
          if (!row || !alive(row) || row.meal_id !== mealId) continue;
          if (row.sort_order === index) continue;
          await this.db.meal_variants.put({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        return ok(undefined);
      }),
    );
  }

  /* ── Righe ─────────────────────────────────────────────────────────── */

  createItem(input: MealItemCreate): Promise<Result<MealItem>> {
    return attempt(async () => {
      const v = validate(MealItemCreateSchema, input);
      if (!v.ok) return v;
      const meal = await this.db.diet_meals.get(v.data.meal_id);
      if (!meal || !alive(meal)) {
        return err<MealItem>("not_found", PASTO_NON_TROVATO);
      }
      const variantId = v.data.variant_id ?? null;
      if (variantId !== null) {
        const variant = await this.db.meal_variants.get(variantId);
        if (!variant || !alive(variant) || variant.meal_id !== v.data.meal_id) {
          return err<MealItem>("not_found", VARIANTE_NON_TROVATA);
        }
      }
      const food = await this.db.foods.get(v.data.food_id);
      if (!food || !alive(food)) {
        return err<MealItem>("not_found", ALIMENTO_NON_TROVATO);
      }
      const now = this.clock();
      const siblings = (
        await this.db.meal_items
          .where("meal_id")
          .equals(v.data.meal_id)
          .toArray()
      ).filter((i) => alive(i) && i.variant_id === variantId);
      const maxSort = siblings.reduce(
        (max, i) => Math.max(max, i.sort_order),
        -1,
      );
      const row: MealItem = {
        id: uuidv7(),
        meal_id: v.data.meal_id,
        variant_id: variantId,
        food_id: v.data.food_id,
        qty: v.data.qty,
        sort_order: v.data.sort_order ?? maxSort + 1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.meal_items.add(row);
      return ok(row);
    });
  }

  updateItem(id: string, patch: MealItemPatch): Promise<Result<MealItem>> {
    return attempt(async () => {
      const v = validate(MealItemPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.meal_items.get(id);
      if (!current || !alive(current)) {
        return err<MealItem>("not_found", RIGA_NON_TROVATA);
      }
      if (v.data.food_id !== undefined) {
        const food = await this.db.foods.get(v.data.food_id);
        if (!food || !alive(food)) {
          return err<MealItem>("not_found", ALIMENTO_NON_TROVATO);
        }
      }
      const next: MealItem = {
        ...current,
        ...(v.data.food_id !== undefined && { food_id: v.data.food_id }),
        ...(v.data.qty !== undefined && { qty: v.data.qty }),
        ...(v.data.sort_order !== undefined && {
          sort_order: v.data.sort_order,
        }),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.meal_items.put(next);
      return ok(next);
    });
  }

  softDeleteItem(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.meal_items.get(id);
      if (!row) return err<void>("not_found", RIGA_NON_TROVATA);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.meal_items.put({
        ...row,
        deleted_at: now,
        updated_at: now,
      });
      return ok(undefined);
    });
  }

  restoreItem(id: string): Promise<Result<MealItem>> {
    return attempt(async () => {
      const row = await this.db.meal_items.get(id);
      if (!row) return err<MealItem>("not_found", RIGA_NON_TROVATA);
      if (row.deleted_at === null) return ok(row);
      const next: MealItem = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.meal_items.put(next);
      return ok(next);
    });
  }

  async listItems(mealId: string): Promise<MealItem[]> {
    const rows = (
      await this.db.meal_items.where("meal_id").equals(mealId).toArray()
    ).filter(alive);
    return rows.sort(bySort);
  }

  reorderItems(
    mealId: string,
    variantId: string | null,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return attempt(async () =>
      this.db.transaction("rw", this.db.meal_items, async () => {
        for (const [index, id] of orderedIds.entries()) {
          const row = await this.db.meal_items.get(id);
          if (
            !row ||
            !alive(row) ||
            row.meal_id !== mealId ||
            row.variant_id !== variantId
          ) {
            continue;
          }
          if (row.sort_order === index) continue;
          await this.db.meal_items.put({
            ...row,
            sort_order: index,
            updated_at: bumpFrom(this.clock, row.updated_at),
          });
        }
        return ok(undefined);
      }),
    );
  }

  /* ── Log del giorno ────────────────────────────────────────────────── */

  logMeal(
    mealId: string,
    date: IsoDay,
    eaten: boolean,
  ): Promise<Result<MealLog>> {
    return this.upsertLog(mealId, date, (current) => ({
      eaten,
      variant_id: current?.variant_id ?? null,
    }));
  }

  setVariant(
    mealId: string,
    date: IsoDay,
    variantId: string | null,
  ): Promise<Result<MealLog>> {
    return attempt(async () => {
      if (variantId !== null) {
        const variant = await this.db.meal_variants.get(variantId);
        if (!variant || !alive(variant) || variant.meal_id !== mealId) {
          return err<MealLog>("not_found", VARIANTE_NON_TROVATA);
        }
      }
      return this.upsertLog(mealId, date, (current) => ({
        eaten: current?.eaten ?? false,
        variant_id: variantId,
      }));
    });
  }

  /**
   * L'upsert per (pasto, giorno) condiviso: id derivato, una riga per
   * costruzione; una tombstone del giorno viene rianimata.
   */
  private upsertLog(
    mealId: string,
    date: IsoDay,
    next: (current: MealLog | null) => Pick<MealLog, "eaten" | "variant_id">,
  ): Promise<Result<MealLog>> {
    return attempt(async () => {
      const meal = await this.db.diet_meals.get(mealId);
      if (!meal || !alive(meal)) {
        return err<MealLog>("not_found", PASTO_NON_TROVATO);
      }
      const id = await mealLogId(mealId, date);
      const current = await this.db.meal_logs.get(id);
      const fields = next(current && alive(current) ? current : null);

      if (current) {
        const row: MealLog = {
          ...current,
          ...fields,
          deleted_at: null,
          updated_at: bumpFrom(this.clock, current.updated_at),
        };
        await this.db.meal_logs.put(row);
        return ok(row);
      }
      const now = this.clock();
      const row: MealLog = {
        id,
        meal_id: mealId,
        date,
        ...fields,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.meal_logs.add(row);
      return ok(row);
    });
  }

  async getMealLog(mealId: string, date: IsoDay): Promise<MealLog | null> {
    const row = await this.db.meal_logs.get(await mealLogId(mealId, date));
    return row && alive(row) ? row : null;
  }

  async listLogsByDay(date: IsoDay): Promise<MealLog[]> {
    const rows = await this.db.meal_logs.where("date").equals(date).toArray();
    return rows.filter(alive);
  }

  /* ── Extra ─────────────────────────────────────────────────────────── */

  /** L'aut-aut normalizzato: via libreria O voce libera, mai un misto. */
  private normalizeExtra(
    e: Pick<
      DietExtra,
      "food_id" | "qty" | "name" | "kcal" | "protein_g" | "carbs_g" | "fat_g"
    >,
  ): Pick<
    DietExtra,
    "food_id" | "qty" | "name" | "kcal" | "protein_g" | "carbs_g" | "fat_g"
  > {
    if (e.food_id !== null) {
      return {
        food_id: e.food_id,
        qty: e.qty,
        name: null,
        kcal: null,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      };
    }
    return { ...e, qty: null };
  }

  addExtra(input: DietExtraCreate): Promise<Result<DietExtra>> {
    return attempt(async () => {
      const v = validate(DietExtraCreateSchema, input);
      if (!v.ok) return v;
      if (v.data.food_id != null) {
        const food = await this.db.foods.get(v.data.food_id);
        if (!food || !alive(food)) {
          return err<DietExtra>("not_found", ALIMENTO_NON_TROVATO);
        }
      }
      const now = this.clock();
      const row: DietExtra = {
        id: uuidv7(),
        date: v.data.date,
        ...this.normalizeExtra({
          food_id: v.data.food_id ?? null,
          qty: v.data.qty ?? null,
          name: v.data.name ?? null,
          kcal: v.data.kcal ?? null,
          protein_g: v.data.protein_g ?? null,
          carbs_g: v.data.carbs_g ?? null,
          fat_g: v.data.fat_g ?? null,
        }),
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };
      await this.db.diet_extras.add(row);
      return ok(row);
    });
  }

  updateExtra(id: string, patch: DietExtraPatch): Promise<Result<DietExtra>> {
    return attempt(async () => {
      const v = validate(DietExtraPatchSchema, patch);
      if (!v.ok) return v;
      const current = await this.db.diet_extras.get(id);
      if (!current || !alive(current)) {
        return err<DietExtra>("not_found", EXTRA_NON_TROVATO);
      }
      const merged: DietExtra = {
        ...current,
        ...(v.data.date !== undefined && { date: v.data.date }),
        ...(v.data.food_id !== undefined && { food_id: v.data.food_id }),
        ...(v.data.qty !== undefined && { qty: v.data.qty }),
        ...(v.data.name !== undefined && { name: v.data.name }),
        ...(v.data.kcal !== undefined && { kcal: v.data.kcal }),
        ...(v.data.protein_g !== undefined && { protein_g: v.data.protein_g }),
        ...(v.data.carbs_g !== undefined && { carbs_g: v.data.carbs_g }),
        ...(v.data.fat_g !== undefined && { fat_g: v.data.fat_g }),
      };
      // L'aut-aut vale sulla riga RISULTANTE, come gli invarianti esami.
      const isFood = merged.food_id !== null && merged.qty !== null;
      const isFree = merged.name !== null && merged.kcal !== null;
      if (!isFood && !isFree) {
        return err<DietExtra>(
          "validation",
          "Un extra è un alimento con quantità oppure una voce libera con kcal.",
        );
      }
      const next: DietExtra = {
        ...merged,
        ...this.normalizeExtra(merged),
        updated_at: bumpFrom(this.clock, current.updated_at),
      };
      await this.db.diet_extras.put(next);
      return ok(next);
    });
  }

  softDeleteExtra(id: string): Promise<Result<void>> {
    return attempt(async () => {
      const row = await this.db.diet_extras.get(id);
      if (!row) return err<void>("not_found", EXTRA_NON_TROVATO);
      if (row.deleted_at !== null) return ok(undefined);
      const now = bumpFrom(this.clock, row.updated_at);
      await this.db.diet_extras.put({
        ...row,
        deleted_at: now,
        updated_at: now,
      });
      return ok(undefined);
    });
  }

  restoreExtra(id: string): Promise<Result<DietExtra>> {
    return attempt(async () => {
      const row = await this.db.diet_extras.get(id);
      if (!row) return err<DietExtra>("not_found", EXTRA_NON_TROVATO);
      if (row.deleted_at === null) return ok(row);
      const next: DietExtra = {
        ...row,
        deleted_at: null,
        updated_at: bumpFrom(this.clock, row.updated_at),
      };
      await this.db.diet_extras.put(next);
      return ok(next);
    });
  }

  async dayExtras(date: IsoDay): Promise<DietExtraView[]> {
    const rows = (
      await this.db.diet_extras.where("date").equals(date).toArray()
    )
      .filter(alive)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const foodIds = [
      ...new Set(
        rows.flatMap((r) => (r.food_id !== null ? [r.food_id] : [])),
      ),
    ];
    const foods = await this.db.foods.bulkGet(foodIds);
    const foodById = new Map(
      foods.flatMap((f) => (f && alive(f) ? [[f.id, f] as const] : [])),
    );
    return rows.map((extra) =>
      extraView(
        extra,
        extra.food_id !== null ? (foodById.get(extra.food_id) ?? null) : null,
      ),
    );
  }

  /* ── Lettura composta (matematica pura in data/diet.ts) ────────────── */

  async dayDiet(date: IsoDay): Promise<DayDiet> {
    const weekday = weekdayOfDay(date);
    const plan = await this.activePlan();
    if (!plan) return { date, weekday, plan: null, meals: [] };

    const allMeals = (
      await this.db.diet_meals.where("plan_id").equals(plan.id).toArray()
    ).filter(alive);
    const dayMeals = allMeals.filter((m) => m.weekday === weekday);
    const mealIds = dayMeals.map((m) => m.id);

    const [variants, items, logsRaw] = await Promise.all([
      this.db.meal_variants.where("meal_id").anyOf(mealIds).toArray(),
      this.db.meal_items.where("meal_id").anyOf(mealIds).toArray(),
      this.db.meal_logs.where("date").equals(date).toArray(),
    ]);
    const aliveItems = items.filter(alive);
    const foodIds = [...new Set(aliveItems.map((i) => i.food_id))];
    const foods = (await this.db.foods.bulkGet(foodIds)).flatMap((f) =>
      f && alive(f) ? [f] : [],
    );

    return {
      date,
      weekday,
      plan,
      meals: composeDayMeals({
        date,
        meals: dayMeals,
        variants: variants.filter(alive),
        items: aliveItems,
        logs: logsRaw.filter(alive),
        foods,
      }),
    };
  }

  /**
   * Totali consumati per giorno nel range (run-12, /stats): il loop di
   * dayDiet + dayExtras — le STESSE regole di composizione, zero drift.
   * Sola lettura; a scala personale (range 7–31 giorni) il giro di
   * query indicizzate è la scelta documentata. Tenuti solo i giorni con
   * un pasto mangiato o un extra.
   */
  async consumedByDay(
    from: IsoDay,
    to: IsoDay,
  ): Promise<Array<{ date: IsoDay; kcal: number; protein_dg: number }>> {
    const out: Array<{ date: IsoDay; kcal: number; protein_dg: number }> = [];
    for (const date of dayRange(from, to)) {
      const [day, extras] = await Promise.all([
        this.dayDiet(date),
        this.dayExtras(date),
      ]);
      const anyEaten = day.meals.some((m) => m.eaten);
      if (!anyEaten && extras.length === 0) continue;
      const totals = dayTotals(day, extras);
      out.push({ date, kcal: totals.kcal, protein_dg: totals.protein_dg });
    }
    return out;
  }

  purgeTombstones(olderThan: IsoInstant): Promise<Result<number>> {
    return attempt(async () => {
      const foods = await purgeTable(this.db.foods, olderThan);
      const plans = await purgeTable(this.db.diet_plans, olderThan);
      const meals = await purgeTable(this.db.diet_meals, olderThan);
      const variants = await purgeTable(this.db.meal_variants, olderThan);
      const items = await purgeTable(this.db.meal_items, olderThan);
      const logs = await purgeTable(this.db.meal_logs, olderThan);
      const extras = await purgeTable(this.db.diet_extras, olderThan);
      return ok(foods + plans + meals + variants + items + logs + extras);
    });
  }
}
