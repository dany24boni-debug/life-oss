import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LifeosDb } from "../db";
import type { Result } from "../result";
import type { DietMeal, Food } from "../schemas";
import { LocalDietRepo, mealLogId } from "./diet";

let counter = 0;
let db: LifeosDb;
let repo: LocalDietRepo;

beforeEach(() => {
  db = new LifeosDb(`test-diet-${++counter}`);
  repo = new LocalDietRepo(db);
});

afterEach(async () => {
  await db.delete();
});

async function must<T>(p: Promise<Result<T>>): Promise<T> {
  const r = await p;
  if (!r.ok) throw new Error(`operazione fallita: ${r.error.message}`);
  return r.data;
}

/** Fixture: piano attivo con un pranzo di lunedì (pasta 80 g + pollo). */
async function seedLunch(): Promise<{
  planId: string;
  meal: DietMeal;
  pasta: Food;
  pollo: Food;
}> {
  const plan = await must(repo.createPlan({ name: "Dieta", is_active: true }));
  const pasta = await must(
    repo.createFood({
      name: "Pasta",
      basis: "per100g",
      kcal: 353,
      protein_g: 13.5,
      carbs_g: 70.2,
      fat_g: 1.8,
    }),
  );
  const pollo = await must(
    repo.createFood({
      name: "Petto di pollo",
      basis: "per100g",
      kcal: 110,
      protein_g: 23,
    }),
  );
  const meal = await must(
    repo.createMeal({ plan_id: plan.id, weekday: 1, name: "Pranzo" }),
  );
  await must(
    repo.createItem({ meal_id: meal.id, food_id: pasta.id, qty: 80 }),
  );
  await must(
    repo.createItem({ meal_id: meal.id, food_id: pollo.id, qty: 150 }),
  );
  return { planId: plan.id, meal, pasta, pollo };
}

describe("LocalDietRepo — alimenti", () => {
  it("create normalizza le macro assenti a 0 e ordina per nome", async () => {
    const b = await must(
      repo.createFood({ name: "Banana", basis: "per_piece", kcal: 105 }),
    );
    expect(b.protein_g).toBe(0);
    expect(b.default_qty).toBeNull();
    await must(
      repo.createFood({ name: "Avena", basis: "per100g", kcal: 389, default_qty: 40 }),
    );
    expect((await repo.listFoods()).map((f) => f.name)).toEqual([
      "Avena",
      "Banana",
    ]);
  });

  it("archivia: sparisce dalla lista, resta con includeArchived; undo", async () => {
    const f = await must(
      repo.createFood({ name: "Ricotta", basis: "per100g", kcal: 174 }),
    );
    await must(repo.archiveFood(f.id));
    expect(await repo.listFoods()).toHaveLength(0);
    expect(
      (await repo.listFoods({ includeArchived: true })).map((x) => x.id),
    ).toEqual([f.id]);
    await must(repo.unarchiveFood(f.id));
    expect(await repo.listFoods()).toHaveLength(1);
  });

  it("la basis non è patchabile (cambierebbe il senso delle quantità)", async () => {
    const f = await must(
      repo.createFood({ name: "Uovo", basis: "per_piece", kcal: 78 }),
    );
    // Il campo non esiste sul patch: zod lo strippa, la riga non cambia.
    await must(
      repo.updateFood(f.id, {
        kcal: 80,
        ...({ basis: "per100g" } as object),
      }),
    );
    expect((await repo.getFoodById(f.id))?.basis).toBe("per_piece");
    expect((await repo.getFoodById(f.id))?.kcal).toBe(80);
  });
});

describe("LocalDietRepo — piani e pasti", () => {
  it("al più un piano attivo: attivarne uno spegne gli altri", async () => {
    const a = await must(repo.createPlan({ name: "Massa", is_active: true }));
    const b = await must(repo.createPlan({ name: "Cut" }));
    expect((await repo.activePlan())?.id).toBe(a.id);
    await must(repo.updatePlan(b.id, { is_active: true }));
    expect((await repo.activePlan())?.id).toBe(b.id);
    expect((await repo.getPlanById(a.id))?.is_active).toBe(false);
  });

  it("cascade del piano: pasti, varianti, righe e log muoiono e rivivono insieme", async () => {
    const { planId, meal } = await seedLunch();
    const variante = await must(repo.createVariantFromBase(meal.id));
    await must(repo.logMeal(meal.id, "2026-07-13", true));

    // Una riga eliminata PRIMA, singolarmente, non fa parte del cascade.
    const items = await repo.listItems(meal.id);
    const vittima = items.find((i) => i.variant_id === variante.id);
    if (!vittima) throw new Error("fixture rotta");
    await must(repo.softDeleteItem(vittima.id));

    await must(repo.softDeletePlan(planId));
    expect(await repo.getPlanById(planId)).toBeNull();
    expect(await repo.getMealById(meal.id)).toBeNull();
    expect(await repo.listVariants(meal.id)).toHaveLength(0);
    expect(await repo.listItems(meal.id)).toHaveLength(0);
    expect(await repo.getMealLog(meal.id, "2026-07-13")).toBeNull();

    await must(repo.restorePlan(planId));
    expect(await repo.getPlanById(planId)).not.toBeNull();
    expect(await repo.getMealById(meal.id)).not.toBeNull();
    expect(await repo.listVariants(meal.id)).toHaveLength(1);
    // 2 righe base + 1 riga variante rimasta: la vittima resta morta.
    expect(await repo.listItems(meal.id)).toHaveLength(3);
    expect((await repo.getMealLog(meal.id, "2026-07-13"))?.eaten).toBe(true);
  });

  it("duplicatePlan: copia profonda, mai attiva, i log restano all'originale", async () => {
    const { planId, meal } = await seedLunch();
    await must(repo.createVariantFromBase(meal.id));
    await must(repo.logMeal(meal.id, "2026-07-13", true));

    const copy = await must(repo.duplicatePlan(planId));
    expect(copy.name).toBe("Dieta (copia)");
    expect(copy.is_active).toBe(false);
    const copiedMeals = await repo.listMeals(copy.id);
    expect(copiedMeals).toHaveLength(1);
    const copiedMeal = copiedMeals[0];
    expect(copiedMeal.id).not.toBe(meal.id);
    // Varianti e righe copiate con id rimappati.
    const copiedVariants = await repo.listVariants(copiedMeal.id);
    expect(copiedVariants).toHaveLength(1);
    const copiedItems = await repo.listItems(copiedMeal.id);
    expect(copiedItems).toHaveLength(4); // 2 base + 2 della variante
    expect(
      copiedItems
        .filter((i) => i.variant_id !== null)
        .every((i) => i.variant_id === copiedVariants[0].id),
    ).toBe(true);
    // Nessun log sul clone.
    expect(await repo.getMealLog(copiedMeal.id, "2026-07-13")).toBeNull();
  });

  it("duplicateMeal: in coda allo stesso giorno, nome (copia)", async () => {
    const { planId, meal } = await seedLunch();
    const copy = await must(repo.duplicateMeal(meal.id));
    expect(copy.name).toBe("Pranzo (copia)");
    expect(copy.weekday).toBe(1);
    const meals = await repo.listMeals(planId);
    expect(meals.map((m) => m.name)).toEqual(["Pranzo", "Pranzo (copia)"]);
    expect(await repo.listItems(copy.id)).toHaveLength(2);
  });

  it("copyMealToWeekdays: mai nel proprio giorno, dedupe, copia profonda", async () => {
    const { planId, meal } = await seedLunch();
    const copies = await must(
      repo.copyMealToWeekdays(meal.id, [1, 3, 3, 5, 9]),
    );
    expect(copies.map((c) => c.weekday)).toEqual([3, 5]);
    for (const c of copies) {
      expect(c.name).toBe("Pranzo");
      expect(await repo.listItems(c.id)).toHaveLength(2);
    }
    expect((await repo.listMeals(planId)).map((m) => m.weekday)).toEqual([
      1, 3, 5,
    ]);
  });

  it("copyDayToWeekdays: tutti i pasti del giorno, in ordine, in coda", async () => {
    const { planId } = await seedLunch();
    await must(repo.createMeal({ plan_id: planId, weekday: 1, name: "Cena" }));
    const copies = await must(repo.copyDayToWeekdays(planId, 1, [2]));
    expect(copies.map((c) => c.name)).toEqual(["Pranzo", "Cena"]);
    const day2 = (await repo.listMeals(planId)).filter((m) => m.weekday === 2);
    expect(day2.map((m) => m.name)).toEqual(["Pranzo", "Cena"]);
  });

  it("reorderMeals tocca solo il (piano, giorno) giusto", async () => {
    const { planId } = await seedLunch();
    const colazione = await must(
      repo.createMeal({ plan_id: planId, weekday: 1, name: "Colazione" }),
    );
    const altrove = await must(
      repo.createMeal({ plan_id: planId, weekday: 2, name: "Martedì" }),
    );
    const day1 = (await repo.listMeals(planId)).filter((m) => m.weekday === 1);
    await must(
      repo.reorderMeals(planId, 1, [
        colazione.id,
        day1.find((m) => m.name === "Pranzo")?.id ?? "",
        altrove.id, // giorno diverso: saltato
      ]),
    );
    const after = (await repo.listMeals(planId)).filter((m) => m.weekday === 1);
    expect(after.map((m) => m.name)).toEqual(["Colazione", "Pranzo"]);
    expect((await repo.getMealById(altrove.id))?.sort_order).toBe(0);
  });
});

describe("LocalDietRepo — varianti e righe", () => {
  it("createVariantFromBase copia le righe base e nomina B, C…", async () => {
    const { meal } = await seedLunch();
    const b = await must(repo.createVariantFromBase(meal.id));
    expect(b.name).toBe("Variante B");
    const c = await must(repo.createVariantFromBase(meal.id));
    expect(c.name).toBe("Variante C");
    const items = await repo.listItems(meal.id);
    expect(items.filter((i) => i.variant_id === b.id)).toHaveLength(2);
    expect(items.filter((i) => i.variant_id === c.id)).toHaveLength(2);
    expect(items.filter((i) => i.variant_id === null)).toHaveLength(2);
  });

  it("una riga di variante richiede una variante del SUO pasto", async () => {
    const { planId, meal, pasta } = await seedLunch();
    const altro = await must(
      repo.createMeal({ plan_id: planId, weekday: 2, name: "Cena" }),
    );
    const varAltrui = await must(
      repo.createVariant({ meal_id: altro.id, name: "Variante B" }),
    );
    const r = await repo.createItem({
      meal_id: meal.id,
      variant_id: varAltrui.id,
      food_id: pasta.id,
      qty: 50,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("not_found");
  });

  it("cascade della variante: le sue righe muoiono e rivivono con lei", async () => {
    const { meal } = await seedLunch();
    const variante = await must(repo.createVariantFromBase(meal.id));
    await must(repo.softDeleteVariant(variante.id));
    expect(await repo.listVariants(meal.id)).toHaveLength(0);
    expect(
      (await repo.listItems(meal.id)).filter((i) => i.variant_id !== null),
    ).toHaveLength(0);
    await must(repo.restoreVariant(variante.id));
    expect(await repo.listVariants(meal.id)).toHaveLength(1);
    expect(
      (await repo.listItems(meal.id)).filter(
        (i) => i.variant_id === variante.id,
      ),
    ).toHaveLength(2);
  });
});

describe("LocalDietRepo — log del giorno (id derivato)", () => {
  it("logMeal fa upsert sulla riga derivata; s-mangiare la riusa", async () => {
    const { meal } = await seedLunch();
    const eaten = await must(repo.logMeal(meal.id, "2026-07-13", true));
    expect(eaten.id).toBe(await mealLogId(meal.id, "2026-07-13"));
    expect(eaten.eaten).toBe(true);

    const undone = await must(repo.logMeal(meal.id, "2026-07-13", false));
    expect(undone.id).toBe(eaten.id); // STESSA riga: l'annullamento viaggia
    expect(undone.eaten).toBe(false);
    expect(await db.meal_logs.count()).toBe(1);
  });

  it("setVariant preserva eaten e valida l'appartenenza al pasto", async () => {
    const { planId, meal } = await seedLunch();
    const variante = await must(repo.createVariantFromBase(meal.id));
    await must(repo.logMeal(meal.id, "2026-07-13", true));
    const log = await must(
      repo.setVariant(meal.id, "2026-07-13", variante.id),
    );
    expect(log.eaten).toBe(true);
    expect(log.variant_id).toBe(variante.id);
    // Torna alla base sulla stessa riga.
    const base = await must(repo.setVariant(meal.id, "2026-07-13", null));
    expect(base.variant_id).toBeNull();
    expect(await db.meal_logs.count()).toBe(1);

    // Variante di un altro pasto: rifiutata.
    const altro = await must(
      repo.createMeal({ plan_id: planId, weekday: 2, name: "Cena" }),
    );
    const varAltrui = await must(
      repo.createVariant({ meal_id: altro.id, name: "X" }),
    );
    const r = await repo.setVariant(meal.id, "2026-07-13", varAltrui.id);
    expect(r.ok).toBe(false);
  });

  it("una tombstone del giorno viene rianimata: loggare È l'intento", async () => {
    const { meal } = await seedLunch();
    await must(repo.logMeal(meal.id, "2026-07-13", true));
    const id = await mealLogId(meal.id, "2026-07-13");
    const row = await db.meal_logs.get(id);
    if (!row) throw new Error("fixture rotta");
    await db.meal_logs.put({ ...row, deleted_at: row.updated_at });
    expect(await repo.getMealLog(meal.id, "2026-07-13")).toBeNull();
    const revived = await must(repo.logMeal(meal.id, "2026-07-13", true));
    expect(revived.id).toBe(id);
    expect(revived.deleted_at).toBeNull();
  });
});

describe("LocalDietRepo — extra", () => {
  it("aut-aut normalizzato: via libreria azzera la voce libera e viceversa", async () => {
    const f = await must(
      repo.createFood({ name: "Yogurt", basis: "per100g", kcal: 60 }),
    );
    const daLibreria = await must(
      repo.addExtra({
        date: "2026-07-13",
        food_id: f.id,
        qty: 125,
        name: "residuo",
        kcal: 999,
      }),
    );
    expect(daLibreria.name).toBeNull();
    expect(daLibreria.kcal).toBeNull();

    const libera = await must(
      repo.addExtra({ date: "2026-07-13", name: "Gelato", kcal: 320 }),
    );
    expect(libera.food_id).toBeNull();
    expect(libera.qty).toBeNull();

    // Né l'uno né l'altro: rifiutato dallo schema di creazione.
    const r = await repo.addExtra({ date: "2026-07-13", name: "Solo nome" });
    expect(r.ok).toBe(false);

    // Due spuntini = due righe vere (append-only).
    expect(await repo.dayExtras("2026-07-13")).toHaveLength(2);
  });

  it("dayExtras risolve gli alimenti e calcola i totali", async () => {
    const f = await must(
      repo.createFood({
        name: "Yogurt",
        basis: "per100g",
        kcal: 60,
        protein_g: 10,
      }),
    );
    await must(repo.addExtra({ date: "2026-07-13", food_id: f.id, qty: 125 }));
    const views = await repo.dayExtras("2026-07-13");
    expect(views[0].food?.id).toBe(f.id);
    expect(views[0].totals).toEqual({
      kcal: 75,
      protein_dg: 125,
      carbs_dg: 0,
      fat_dg: 0,
    });
  });

  it("delete + undo", async () => {
    const e = await must(
      repo.addExtra({ date: "2026-07-13", name: "Gelato", kcal: 320 }),
    );
    await must(repo.softDeleteExtra(e.id));
    expect(await repo.dayExtras("2026-07-13")).toHaveLength(0);
    await must(repo.restoreExtra(e.id));
    expect(await repo.dayExtras("2026-07-13")).toHaveLength(1);
  });
});

describe("LocalDietRepo — dayDiet", () => {
  it("compone la giornata: pasti del weekday, totali, stato del log", async () => {
    const { meal } = await seedLunch();
    await must(repo.logMeal(meal.id, "2026-07-13", true));

    // 2026-07-13 è lunedì: il pranzo c'è.
    const day = await repo.dayDiet("2026-07-13");
    expect(day.weekday).toBe(1);
    expect(day.plan?.name).toBe("Dieta");
    expect(day.meals).toHaveLength(1);
    const m = day.meals[0];
    expect(m.eaten).toBe(true);
    // Pasta 80 g (282 kcal) + pollo 150 g (165 kcal) = 447.
    expect(m.selectionTotals.kcal).toBe(447);
    expect(m.selectionTotals.protein_dg).toBe(108 + 345);

    // Martedì: nessun pasto.
    const tue = await repo.dayDiet("2026-07-14");
    expect(tue.meals).toHaveLength(0);
  });

  it("senza piano attivo: giorno vuoto e piano null, mai un throw", async () => {
    const day = await repo.dayDiet("2026-07-13");
    expect(day.plan).toBeNull();
    expect(day.meals).toEqual([]);
  });
});

describe("LocalDietRepo — consumedByDay (run-12, /stats)", () => {
  it("solo i giorni con pasti mangiati o extra; stessi totali della composizione", async () => {
    const { meal, pasta } = await seedLunch();
    // Lunedì: pranzo mangiato. Martedì: solo un extra. Mercoledì: nulla.
    await must(repo.logMeal(meal.id, "2026-07-13", true));
    await must(
      repo.addExtra({ date: "2026-07-14", food_id: pasta.id, qty: 100 }),
    );
    // Lunedì successivo: pasto previsto ma NON mangiato → fuori.
    await must(repo.logMeal(meal.id, "2026-07-20", false));

    const days = await repo.consumedByDay("2026-07-13", "2026-07-20");
    expect(days.map((d) => d.date)).toEqual(["2026-07-13", "2026-07-14"]);
    // Pasta 80 g (353 kcal/100) = 282 + pollo 150 g (110) = 165 → 447;
    // proteine 13,5·0,8 = 10,8 g (108 dg) + 23·1,5 = 34,5 g (345 dg).
    expect(days[0]).toEqual({
      date: "2026-07-13",
      kcal: 447,
      protein_dg: 453,
    });
    expect(days[1].kcal).toBe(353);
  });
});
