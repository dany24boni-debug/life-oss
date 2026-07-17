"use client";

/**
 * Tab "Piano" di /dieta — l'authoring del piano settimanale:
 *   1. Lista piani: attiva / apri / crea (pattern planner).
 *   2. Editor piano: rinomina inline, giorni a chips L-D con conteggio
 *      pasti, lista pasti del giorno coi totali live, "copia giorno
 *      su…", duplica/elimina con undo.
 *   3. Scheda pasto: nome, composizioni a chips (Base + varianti),
 *      righe alimento (autocomplete + crea al volo, stepper quantità,
 *      kcal auto), varianti (vuota / copia della base), "copia anche
 *      in…", elimina con undo. Totali vivi mentre scrivi.
 */

import { useMemo, useState } from "react";
import {
  BottomSheet,
  Button,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  Switch,
  cx,
  useToast,
} from "@/ui";
import { WEEKDAYS_IT } from "@/ui/calendar-core";
import { addTotals, ZERO_TOTALS, type MacroTotals } from "@/data/diet";
import {
  appRepos,
  useDietMeals,
  useDietPlans,
  useFoods,
  useMealItems,
  useMealVariants,
} from "@/data/hooks";
import type { DietMeal, DietPlan, Food, MealItem } from "@/data/schemas";
import { IconChevronRight, IconPlus } from "../_components/icons";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { FoodPickerInline } from "./food-picker";
import { defaultQtyFor, formatInt, kcalProteinLine, sumItemTotals } from "./logic";
import { QtyStepper } from "./qty-stepper";

const WEEKDAY_FULL = [
  "lunedì",
  "martedì",
  "mercoledì",
  "giovedì",
  "venerdì",
  "sabato",
  "domenica",
];

export function PianoTab() {
  const plans = useDietPlans();
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const openPlan = plans?.find((p) => p.id === openPlanId) ?? null;

  if (openPlan) {
    return <PlanEditor plan={openPlan} onBack={() => setOpenPlanId(null)} />;
  }
  return <PlanList plans={plans} onOpen={setOpenPlanId} />;
}

/* ── Lista piani ─────────────────────────────────────────────────────── */

function PlanList({
  plans,
  onOpen,
}: {
  plans: DietPlan[] | undefined;
  onOpen: (id: string) => void;
}) {
  const toast = useToast();

  async function create() {
    const r = await appRepos().diet.createPlan({
      name: "Nuovo piano",
      is_active: true,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else onOpen(r.data.id);
  }

  async function activate(plan: DietPlan) {
    const r = await appRepos().diet.updatePlan(plan.id, { is_active: true });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else toast.show({ message: `Attivo: ${plan.name}.`, tone: "success" });
  }

  if (plans === undefined) {
    return (
      <div aria-busy="true" className="pt-4">
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (plans.length === 0) {
    return (
      <div className="pt-4">
        <EmptyState
          heading="Nessun piano"
          text="Un piano è la tua settimana di pasti scritta una volta: ogni giorno la ritrovi pronta da spuntare."
          action={
            <Button type="button" variant="primary" onClick={() => void create()}>
              Crea il primo piano
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-4">
      <ul className="flex flex-col">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex items-center gap-2 border-b border-[var(--em-hairline)] py-1 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onOpen(plan.id)}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 py-1.5 text-left transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
                {plan.name}
              </span>
              {plan.is_active ? (
                <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-text-2)]">
                  attivo
                </span>
              ) : null}
              <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
            </button>
            {!plan.is_active ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void activate(plan)}
              >
                Attiva
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => void create()}
      >
        + Nuovo piano
      </Button>
    </div>
  );
}

/* ── Editor del piano ────────────────────────────────────────────────── */

function PlanEditor({ plan, onBack }: { plan: DietPlan; onBack: () => void }) {
  const toast = useToast();
  const meals = useDietMeals(plan.id);
  const foods = useFoods({ includeArchived: true });
  const [weekday, setWeekday] = useState(1);
  const [editingMealId, setEditingMealId] = useState<string | null>(null);

  const foodById = useMemo(
    () => new Map((foods ?? []).map((f) => [f.id, f])),
    [foods],
  );
  const dayMeals = useMemo(
    () => (meals ?? []).filter((m) => m.weekday === weekday),
    [meals, weekday],
  );
  const editingMeal = meals?.find((m) => m.id === editingMealId) ?? null;

  async function rename(name: string) {
    if (name.trim() === "" || name.trim() === plan.name) return;
    const r = await appRepos().diet.updatePlan(plan.id, { name: name.trim() });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function duplicate() {
    const r = await appRepos().diet.duplicatePlan(plan.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else toast.show({ message: `Duplicato: ${r.data.name}.`, tone: "success" });
  }

  async function remove() {
    const r = await appRepos().diet.softDeletePlan(plan.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onBack();
    toast.show({
      message: `"${plan.name}" eliminato con pasti e storia.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.restorePlan(plan.id),
      },
    });
  }

  async function addMeal(day: number) {
    const r = await appRepos().diet.createMeal({
      plan_id: plan.id,
      weekday: day,
      name: "Nuovo pasto",
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else setEditingMealId(r.data.id);
  }

  async function copyDayTo(target: number) {
    const r = await appRepos().diet.copyDayToWeekdays(plan.id, weekday, [
      target,
    ]);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message:
        r.data.length > 0
          ? r.data.length === 1
            ? `1 pasto copiato su ${WEEKDAYS_IT[target - 1]}.`
            : `${r.data.length} pasti copiati su ${WEEKDAYS_IT[target - 1]}.`
          : "Niente da copiare.",
      tone: r.data.length > 0 ? "success" : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ‹ Piani
        </Button>
        <Input
          key={plan.name}
          defaultValue={plan.name}
          maxLength={120}
          aria-label="Nome del piano"
          className="min-w-0 flex-1"
          onBlur={(e) => void rename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
        {plan.is_active ? (
          <span className="em-eyebrow rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-text-2)]">
            attivo
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              void appRepos().diet.updatePlan(plan.id, { is_active: true })
            }
          >
            Attiva
          </Button>
        )}
      </div>

      {/* Mobile: giorno a chips + lista del giorno (byte-intatto,
          nascosto da lg dove comanda la griglia — PROP-diet-05). */}
      <div className="flex flex-col gap-4 lg:hidden">
        <div role="group" aria-label="Giorno" className="flex flex-wrap gap-1.5">
          {WEEKDAYS_IT.map((label, i) => {
            const day = i + 1;
            const count = (meals ?? []).filter((m) => m.weekday === day).length;
            return (
              <button
                key={day}
                type="button"
                aria-pressed={weekday === day}
                onClick={() => setWeekday(day)}
                className={cx(
                  "em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] px-2 font-medium transition-colors duration-[var(--em-dur-tap)]",
                  weekday === day
                    ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                    : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
                )}
              >
                {label}
                {count > 0 ? (
                  <span className="em-num ml-1 text-[var(--em-text-3)]">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Pasti del giorno selezionato, coi totali live. */}
        {meals === undefined || foods === undefined ? (
          <div aria-busy="true">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : dayMeals.length === 0 ? (
          <EmptyState
            compact
            heading={`Niente di ${WEEKDAY_FULL[weekday - 1]}`}
            text="Aggiungi il primo pasto: un nome e due alimenti bastano."
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {dayMeals.map((meal) => (
                <MealRow
                  key={meal.id}
                  meal={meal}
                  foodById={foodById}
                  onOpen={() => setEditingMealId(meal.id)}
                />
              ))}
            </ul>
            <DayTotalsLine dayMeals={dayMeals} foodById={foodById} />
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void addMeal(weekday)}
          >
            <IconPlus className="h-4 w-4" /> Pasto di {WEEKDAY_FULL[weekday - 1]}
          </Button>
          {dayMeals.length > 0 ? (
            <CopyDayControl weekday={weekday} onCopy={copyDayTo} />
          ) : null}
        </div>
      </div>

      {/* Da lg: la settimana VERA, 7 giorni affiancati (PROP-diet-05) —
          la larghezza del P3 run-10 finalmente spesa nel builder. */}
      {meals === undefined || foods === undefined ? (
        <div aria-busy="true" className="hidden lg:block">
          <Skeleton className="h-40 w-full" />
        </div>
      ) : (
        <WeekGrid
          meals={meals}
          foodById={foodById}
          onOpenMeal={setEditingMealId}
          onAddMeal={(day) => void addMeal(day)}
        />
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[var(--em-hairline)] pt-3">
        <Button type="button" variant="ghost" size="sm" onClick={() => void duplicate()}>
          Duplica piano
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
          Elimina piano
        </Button>
      </div>

      <MealSheet
        meal={editingMeal}
        open={editingMeal !== null}
        onClose={() => setEditingMealId(null)}
      />
    </div>
  );
}

/* ── La griglia settimanale (run-12 P5a, PROP-diet-05, solo lg+) ─────── */

function WeekGrid({
  meals,
  foodById,
  onOpenMeal,
  onAddMeal,
}: {
  meals: DietMeal[];
  foodById: ReadonlyMap<string, Food>;
  onOpenMeal: (id: string) => void;
  onAddMeal: (day: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Piano della settimana"
      className="hidden gap-2 lg:grid lg:grid-cols-7"
    >
      {WEEKDAYS_IT.map((label, i) => {
        const day = i + 1;
        const dayMeals = meals.filter((m) => m.weekday === day);
        return (
          <section
            key={day}
            aria-label={WEEKDAY_FULL[i]}
            className="flex min-w-0 flex-col gap-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-2 shadow-[0_0_0_1px_var(--em-hairline)]"
          >
            <p className="em-eyebrow flex items-baseline justify-between gap-1">
              <span>{label}</span>
              {dayMeals.length > 0 ? (
                <span className="em-num text-[var(--em-text-3)]">
                  {dayMeals.length}
                </span>
              ) : null}
            </p>
            <ul className="flex min-w-0 flex-1 flex-col gap-1">
              {dayMeals.map((meal) => (
                <GridMealCell
                  key={meal.id}
                  meal={meal}
                  foodById={foodById}
                  onOpen={() => onOpenMeal(meal.id)}
                />
              ))}
            </ul>
            {dayMeals.length > 0 ? (
              <GridDayKcal dayMeals={dayMeals} foodById={foodById} />
            ) : null}
            <button
              type="button"
              onClick={() => onAddMeal(day)}
              aria-label={`Aggiungi un pasto di ${WEEKDAY_FULL[i]}`}
              className="em-body grid h-11 place-items-center rounded-[var(--em-r-sm)] font-semibold text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)] hover:text-[var(--em-text)]"
            >
              +
            </button>
          </section>
        );
      })}
    </div>
  );
}

/** Cella pasto della griglia: nome + kcal base, tap = scheda pasto. */
function GridMealCell({
  meal,
  foodById,
  onOpen,
}: {
  meal: DietMeal;
  foodById: ReadonlyMap<string, Food>;
  onOpen: () => void;
}) {
  const items = useMealItems(meal.id);
  const baseTotals = sumItemTotals(
    (items ?? []).filter((i) => i.variant_id === null),
    foodById,
  );
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-[var(--em-r-sm)] bg-[var(--em-surface)] px-2 py-1.5 text-left shadow-[0_0_0_1px_var(--em-hairline)] transition-shadow duration-[var(--em-dur-tap)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
      >
        <span className="em-body-sm block truncate font-medium text-[var(--em-text)]">
          {meal.name}
        </span>
        <span className="em-eyebrow em-num block text-[var(--em-text-3)]">
          {formatInt(baseTotals.kcal)} kcal
        </span>
      </button>
    </li>
  );
}

/** Somma kcal del giorno in fondo alla colonna (ricorsione di hook come
 *  DayTotalsLine, resa compatta per la colonna stretta). */
function GridDayKcal({
  dayMeals,
  foodById,
  acc = ZERO_TOTALS,
}: {
  dayMeals: DietMeal[];
  foodById: ReadonlyMap<string, Food>;
  acc?: MacroTotals;
}) {
  if (dayMeals.length === 0) {
    return (
      <p className="em-eyebrow em-num text-right text-[var(--em-text-2)]">
        {formatInt(acc.kcal)} kcal
      </p>
    );
  }
  return (
    <GridDayKcalStep
      key={dayMeals[0].id}
      meal={dayMeals[0]}
      rest={dayMeals.slice(1)}
      foodById={foodById}
      acc={acc}
    />
  );
}

function GridDayKcalStep({
  meal,
  rest,
  foodById,
  acc,
}: {
  meal: DietMeal;
  rest: DietMeal[];
  foodById: ReadonlyMap<string, Food>;
  acc: MacroTotals;
}) {
  const items = useMealItems(meal.id);
  const totals = sumItemTotals(
    (items ?? []).filter((i) => i.variant_id === null),
    foodById,
  );
  return (
    <GridDayKcal
      dayMeals={rest}
      foodById={foodById}
      acc={addTotals(acc, totals)}
    />
  );
}

/** Riga pasto nella lista del giorno: nome, varianti, kcal base live. */
function MealRow({
  meal,
  foodById,
  onOpen,
}: {
  meal: DietMeal;
  foodById: ReadonlyMap<string, Food>;
  onOpen: () => void;
}) {
  const items = useMealItems(meal.id);
  const variants = useMealVariants(meal.id);
  const baseTotals = sumItemTotals(
    (items ?? []).filter((i) => i.variant_id === null),
    foodById,
  );
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--em-hairline)] py-2 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
      >
        <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
          {meal.name}
        </span>
        {(variants ?? []).length > 0 ? (
          <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)]">
            {(variants ?? []).length + 1} varianti
          </span>
        ) : null}
        <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
          {formatInt(baseTotals.kcal)} kcal
        </span>
        <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
      </button>
    </li>
  );
}

/**
 * Totali del giorno (composizioni base) — vivi mentre scrivi. La somma
 * è una RICORSIONE di componenti: ogni passo tiene UN hook (numero di
 * hook stabile per istanza, regole di React rispettate) e passa
 * l'accumulo alla coda; l'ultimo anello rende la riga.
 */
function DayTotalsLine({
  dayMeals,
  foodById,
  acc = ZERO_TOTALS,
}: {
  dayMeals: DietMeal[];
  foodById: ReadonlyMap<string, Food>;
  acc?: MacroTotals;
}) {
  if (dayMeals.length === 0) {
    return (
      <p className="em-body-sm em-num text-right text-[var(--em-text-3)]">
        Giorno (base): {kcalProteinLine(acc)}
      </p>
    );
  }
  return (
    <DayTotalsStep
      key={dayMeals[0].id}
      meal={dayMeals[0]}
      rest={dayMeals.slice(1)}
      foodById={foodById}
      acc={acc}
    />
  );
}

function DayTotalsStep({
  meal,
  rest,
  foodById,
  acc,
}: {
  meal: DietMeal;
  rest: DietMeal[];
  foodById: ReadonlyMap<string, Food>;
  acc: MacroTotals;
}) {
  const items = useMealItems(meal.id);
  const totals = sumItemTotals(
    (items ?? []).filter((i) => i.variant_id === null),
    foodById,
  );
  return (
    <DayTotalsLine
      dayMeals={rest}
      foodById={foodById}
      acc={addTotals(acc, totals)}
    />
  );
}

/** "Copia giorno su…" — chips dei giorni bersaglio. */
function CopyDayControl({
  weekday,
  onCopy,
}: {
  weekday: number;
  onCopy: (target: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Copia giorno su…
      </Button>
    );
  }
  return (
    <span role="group" aria-label="Copia giorno su" className="flex flex-wrap gap-1.5">
      {WEEKDAYS_IT.map((label, i) => {
        const day = i + 1;
        if (day === weekday) return null;
        return (
          <button
            key={day}
            type="button"
            onClick={() => {
              setOpen(false);
              void onCopy(day);
            }}
            className="em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-2 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            {label}
          </button>
        );
      })}
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Annulla
      </Button>
    </span>
  );
}

/* ── Scheda pasto (l'editor vero) ────────────────────────────────────── */

function MealSheet({
  meal,
  open,
  onClose,
}: {
  meal: DietMeal | null;
  open: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const body =
    open && meal ? (
      <MealSheetBody key={meal.id} meal={meal} onClose={onClose} />
    ) : null;
  const title = meal
    ? `${meal.name} · ${WEEKDAY_FULL[meal.weekday - 1]}`
    : "Pasto";
  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body ?? <span />}
    </BottomSheet>
  );
}

function MealSheetBody({
  meal,
  onClose,
}: {
  meal: DietMeal;
  onClose: () => void;
}) {
  const toast = useToast();
  const items = useMealItems(meal.id);
  const variants = useMealVariants(meal.id);
  const foods = useFoods({ includeArchived: true });
  /** null = base; altrimenti l'id della variante selezionata. */
  const [selected, setSelected] = useState<string | null>(null);
  const [addingFood, setAddingFood] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const foodById = useMemo(
    () => new Map((foods ?? []).map((f) => [f.id, f])),
    [foods],
  );
  const selectedVariant =
    (variants ?? []).find((v) => v.id === selected) ?? null;
  // La selezione può morire (variante eliminata): torna alla base.
  const effectiveSelected = selectedVariant?.id ?? null;
  const selectionItems = (items ?? []).filter(
    (i) => i.variant_id === effectiveSelected,
  );
  const selectionTotals = sumItemTotals(selectionItems, foodById);

  async function rename(name: string) {
    if (name.trim() === "" || name.trim() === meal.name) return;
    const r = await appRepos().diet.updateMeal(meal.id, { name: name.trim() });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function addItem(food: Food) {
    setAddingFood(false);
    const r = await appRepos().diet.createItem({
      meal_id: meal.id,
      variant_id: effectiveSelected,
      food_id: food.id,
      qty: defaultQtyFor(food),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function removeItem(item: MealItem, foodName: string) {
    const r = await appRepos().diet.softDeleteItem(item.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message: `"${foodName}" tolto.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.restoreItem(item.id),
      },
    });
  }

  async function addVariant(fromBase: boolean) {
    const diet = appRepos().diet;
    const r = fromBase
      ? await diet.createVariantFromBase(meal.id)
      : await diet.createVariant({
          meal_id: meal.id,
          name: `Variante ${String.fromCharCode(66 + Math.min((variants ?? []).length, 24))}`,
        });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else setSelected(r.data.id);
  }

  async function renameVariant(name: string) {
    if (!selectedVariant || name.trim() === "") return;
    const r = await appRepos().diet.updateVariant(selectedVariant.id, {
      name: name.trim(),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  /** CROSS-02 (run-11 P5b): marca la variante da giorno di allenamento
   *  — nei giorni giusti /dieta la PROPONE, mai la impone. */
  async function setVariantTraining(checked: boolean) {
    if (!selectedVariant) return;
    const r = await appRepos().diet.updateVariant(selectedVariant.id, {
      training: checked ? true : null,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function removeVariant() {
    if (!selectedVariant) return;
    const r = await appRepos().diet.softDeleteVariant(selectedVariant.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    setSelected(null);
    toast.show({
      message: `"${selectedVariant.name}" eliminata con le sue righe.`,
      action: {
        label: "Annulla",
        onClick: () =>
          void appRepos().diet.restoreVariant(selectedVariant.id),
      },
    });
  }

  async function copyMealTo(target: number) {
    const r = await appRepos().diet.copyMealToWeekdays(meal.id, [target]);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message: `"${meal.name}" copiato su ${WEEKDAYS_IT[target - 1]}.`,
      tone: "success",
    });
  }

  async function removeMeal() {
    const r = await appRepos().diet.softDeleteMeal(meal.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${meal.name}" eliminato con varianti e storia.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.restoreMeal(meal.id),
      },
    });
  }

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nome del pasto</span>
        <Input
          key={meal.name}
          defaultValue={meal.name}
          maxLength={120}
          onBlur={(e) => void rename(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </label>

      {/* Composizioni: base + varianti a chips, coi kcal live. */}
      <div
        role="group"
        aria-label="Composizione"
        className="flex flex-wrap gap-1.5"
      >
        <CompositionChip
          label="Base"
          active={effectiveSelected === null}
          items={(items ?? []).filter((i) => i.variant_id === null)}
          foodById={foodById}
          onClick={() => setSelected(null)}
        />
        {(variants ?? []).map((v) => (
          <CompositionChip
            key={v.id}
            label={v.name}
            active={effectiveSelected === v.id}
            items={(items ?? []).filter((i) => i.variant_id === v.id)}
            foodById={foodById}
            onClick={() => setSelected(v.id)}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void addVariant(false)}
        >
          + Variante vuota
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void addVariant(true)}
        >
          + Copia della base
        </Button>
      </div>

      {selectedVariant ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              key={selectedVariant.id + selectedVariant.name}
              defaultValue={selectedVariant.name}
              maxLength={120}
              aria-label="Nome della variante"
              className="min-w-0 flex-1"
              onBlur={(e) => void renameVariant(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void removeVariant()}
            >
              Elimina variante
            </Button>
          </div>
          <Switch
            label="Variante da giorno di allenamento"
            checked={selectedVariant.training === true}
            onChange={(checked) => void setVariantTraining(checked)}
          />
        </div>
      ) : null}

      {/* Righe della composizione selezionata. */}
      {items === undefined || foods === undefined ? (
        <div aria-busy="true">
          <Skeleton className="h-12 w-full" />
        </div>
      ) : selectionItems.length === 0 ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessun alimento qui: aggiungi il primo.
        </p>
      ) : (
        <ul className="flex flex-col">
          {selectionItems.map((item) => {
            const food = foodById.get(item.food_id) ?? null;
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 border-b border-[var(--em-hairline)] py-2 last:border-b-0"
              >
                <span className="em-body min-w-0 flex-1 truncate text-[var(--em-text)]">
                  {food?.name ?? "Alimento eliminato"}
                </span>
                {food ? (
                  <QtyStepper
                    qty={item.qty}
                    basis={food.basis}
                    label={`Quantità di ${food.name}`}
                    onChange={(qty) =>
                      void appRepos()
                        .diet.updateItem(item.id, { qty })
                        .then((r) => {
                          if (!r.ok)
                            toast.show({
                              message: r.error.message,
                              tone: "error",
                            });
                        })
                    }
                  />
                ) : null}
                <span className="em-body-sm em-num w-20 shrink-0 text-right text-[var(--em-text-3)]">
                  {food
                    ? `${formatInt(sumItemTotals([item], foodById).kcal)} kcal`
                    : "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Togli ${food?.name ?? "riga"}`}
                  onClick={() =>
                    void removeItem(item, food?.name ?? "questa riga")
                  }
                >
                  Togli
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {addingFood ? (
        <FoodPickerInline
          onPick={(food) => void addItem(food)}
          onCancel={() => setAddingFood(false)}
        />
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => setAddingFood(true)}
        >
          <IconPlus className="h-4 w-4" /> Alimento
        </Button>
      )}

      <p className="em-body-sm em-num text-right text-[var(--em-text-3)]">
        {effectiveSelected === null ? "Base" : selectedVariant?.name}:{" "}
        {kcalProteinLine(selectionTotals)}
      </p>

      {/* Copia del pasto in altri giorni + elimina. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--em-hairline)] pt-3">
        {copyOpen ? (
          <span
            role="group"
            aria-label="Copia il pasto in"
            className="flex flex-wrap gap-1.5"
          >
            {WEEKDAYS_IT.map((label, i) => {
              const day = i + 1;
              if (day === meal.weekday) return null;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    setCopyOpen(false);
                    void copyMealTo(day);
                  }}
                  className="em-body-sm h-11 min-w-11 rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-2 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
                >
                  {label}
                </button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCopyOpen(false)}
            >
              Annulla
            </Button>
          </span>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setCopyOpen(true)}
          >
            Copia il pasto in…
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void removeMeal()}
        >
          Elimina pasto
        </Button>
      </div>
    </div>
  );
}

/** Chip di composizione col kcal live della SUA lista di righe. */
function CompositionChip({
  label,
  active,
  items,
  foodById,
  onClick,
}: {
  label: string;
  active: boolean;
  items: MealItem[];
  foodById: ReadonlyMap<string, Food>;
  onClick: () => void;
}) {
  const totals = sumItemTotals(items, foodById);
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "em-body-sm h-11 rounded-[var(--em-r-sm)] px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
        active
          ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
      )}
    >
      {label}
      <span className="em-num ml-1.5 text-[var(--em-text-3)]">
        {formatInt(totals.kcal)}
      </span>
    </button>
  );
}
