"use client";

/**
 * Tab "Oggi" di /dieta — la giornata alimentare:
 *   1. Header quieto: consumato vs obiettivi (kcal ember, proteine
 *      salvia; oltre il +10% il colore vira a segnale, mai la copy).
 *   2. Card pasto: variante a chip (tap cicla; >2 opzioni = scelta
 *      esplicita), righe della selezione, UN TAP "Fatto" con undo.
 *   3. Extra: aggiunta veloce (libreria o voce libera), lista con
 *      elimina + undo.
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  EmptyState,
  Input,
  Modal,
  ProgressBar,
  Skeleton,
  cx,
  useToast,
} from "@/ui";
import {
  dayTotals,
  remainingVsTarget,
  type DayDiet,
  type DayDietMeal,
  type DietExtraView,
} from "@/data/diet";
import { calorieTargetKcal, proteinTargetG } from "@/data/derived";
import {
  appRepos,
  useActiveProgram,
  useDayDiet,
  useDayExtras,
  useGymSessionsByDay,
  useLatestBody,
  useProgramDays,
  useSettings,
} from "@/data/hooks";
import type { Food, IsoDay } from "@/data/schemas";
import { IconCheck, IconPlus } from "../_components/icons";
import { useIsDesktop, useToday } from "../_components/tasks/screen-hooks";
import { FoodPickerInline } from "./food-picker";
import {
  barTone,
  cycleSelection,
  defaultQtyFor,
  formatGramsFromDg,
  formatInt,
  formatQty,
  isTrainingDay,
  kcalProteinLine,
  parseKcalInput,
  parseMacroInput,
  trainingVariantFor,
} from "./logic";
import { QtyStepper } from "./qty-stepper";

export function OggiTab({ onGoToPiano }: { onGoToPiano: () => void }) {
  const today = useToday();
  const day = useDayDiet(today);
  const extras = useDayExtras(today);
  // CROSS-02 (run-11 P5b): il giorno sa se è di allenamento — dal piano
  // palestra (weekday del giorno-scheda) o da una sessione già esistente.
  const gymProgram = useActiveProgram();
  const gymDays = useProgramDays(gymProgram?.id ?? null);
  const gymSessions = useGymSessionsByDay(today);
  const training =
    day !== undefined &&
    isTrainingDay(day.weekday, gymDays ?? [], (gymSessions ?? []).length);

  if (day === undefined || extras === undefined) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (day.plan === null) {
    return (
      <div className="pt-4">
        <EmptyState
          heading="Nessun piano attivo"
          text="Scrivi il tuo piano settimanale una volta (pasti e varianti): il giorno si spunta a colpi di pollice."
          action={
            <Button type="button" variant="primary" onClick={onGoToPiano}>
              Crea il piano
            </Button>
          }
        />
        <ExtrasCard date={today} extras={extras} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {training ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          <span className="rounded-full bg-[var(--em-surface-2)] px-2.5 py-1 shadow-[0_0_0_1px_var(--em-hairline)]">
            Giorno di allenamento
          </span>
        </p>
      ) : null}
      <TotalsHeader day={day} extras={extras} today={today} />
      {day.meals.length === 0 ? (
        <EmptyState
          compact
          heading="Niente in piano per oggi"
          text="Questo giorno feriale non ha pasti: si aggiungono dal tab Piano."
        />
      ) : (
        <section aria-label="Pasti di oggi" className="flex flex-col gap-3">
          {day.meals.map((m) => (
            <MealCard key={m.meal.id} m={m} date={today} training={training} />
          ))}
        </section>
      )}
      <ExtrasCard date={today} extras={extras} />
    </div>
  );
}

/* ── Header dei totali ───────────────────────────────────────────────── */

function TotalsHeader({
  day,
  extras,
  today,
}: {
  day: DayDiet;
  extras: DietExtraView[];
  today: IsoDay;
}) {
  const settings = useSettings();
  const latest = useLatestBody();

  const totals = dayTotals(day, extras);
  // Obiettivi dal profilo: kcal di MANTENIMENTO (come l'anteprima del
  // profilo, run-07) e proteine ~1,8 g/kg. Senza profilo: solo il
  // consumato, mai barre inventate.
  const todayYear = Number(today.slice(0, 4));
  const kcalTarget =
    settings === undefined || latest === undefined
      ? null
      : calorieTargetKcal(
          {
            weightKg: latest?.weight_kg ?? null,
            heightCm: settings.height_cm,
            birthYear: settings.birth_year,
            sex: settings.sex,
            activityLevel: settings.activity_level,
          },
          todayYear,
          "maintain",
        );
  const protTarget =
    latest === undefined ? null : proteinTargetG(latest?.weight_kg ?? null);
  const vs = remainingVsTarget(totals, kcalTarget, protTarget);

  return (
    <section aria-label="Totali del giorno" className="em-card flex flex-col gap-2.5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="em-body font-medium text-[var(--em-text)]">
          {vs.kcal
            ? `${formatInt(vs.kcal.consumed)} / ${formatInt(vs.kcal.target)} kcal`
            : `${formatInt(totals.kcal)} kcal`}
        </p>
        <p className="em-body-sm text-[var(--em-text-3)]">
          {vs.protein_dg
            ? `${formatGramsFromDg(vs.protein_dg.consumed)} / ${formatGramsFromDg(vs.protein_dg.target)} g proteine`
            : `${formatGramsFromDg(totals.protein_dg)} g proteine`}
        </p>
      </div>
      {vs.kcal ? (
        <ProgressBar
          value={vs.kcal.consumed}
          max={vs.kcal.target}
          tone={barTone("ember", vs.kcal.consumed, vs.kcal.target)}
          label="Calorie di oggi"
        />
      ) : null}
      {vs.protein_dg ? (
        <ProgressBar
          value={vs.protein_dg.consumed}
          max={vs.protein_dg.target}
          tone={barTone("salvia", vs.protein_dg.consumed, vs.protein_dg.target)}
          label="Proteine di oggi"
        />
      ) : null}
      {!vs.kcal && !vs.protein_dg ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Con profilo e pesata (Impostazioni, Corpo) qui compaiono gli
          obiettivi.
        </p>
      ) : null}
    </section>
  );
}

/* ── Card pasto ──────────────────────────────────────────────────────── */

function MealCard({
  m,
  date,
  training,
}: {
  m: DayDietMeal;
  date: IsoDay;
  training: boolean;
}) {
  const toast = useToast();
  const [choosing, setChoosing] = useState(false);
  const variantIds = m.variants.map((v) => v.variant.id);
  // CROSS-02 fase 2: nei giorni di allenamento la variante marcata
  // viene PROPOSTA (mai imposta) finché il pasto non è fatto.
  const proposta = training && !m.eaten
    ? trainingVariantFor(m.variants, m.chosenVariantId)
    : null;

  async function setEaten(eaten: boolean, withUndo: boolean) {
    const r = await appRepos().diet.logMeal(m.meal.id, date, eaten);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    if (withUndo) {
      toast.show({
        message: `${m.meal.name}: fatto.`,
        tone: "success",
        action: {
          label: "Annulla",
          onClick: () => void appRepos().diet.logMeal(m.meal.id, date, false),
        },
      });
    }
  }

  async function choose(variantId: string | null) {
    const r = await appRepos().diet.setVariant(m.meal.id, date, variantId);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  /** Applica la variante proposta: un tap, con undo alla selezione di
   *  prima (run-11 P5b — proposta, mai imposta). */
  async function applyProposta(id: string, name: string) {
    const previous = m.chosenVariantId;
    const r = await appRepos().diet.setVariant(m.meal.id, date, id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message: `${m.meal.name}: variante ${name}.`,
      tone: "success",
      action: {
        label: "Annulla",
        onClick: () =>
          void appRepos().diet.setVariant(m.meal.id, date, previous),
      },
    });
  }

  function tapVariantChip() {
    // Con più di due opzioni (base + 2 varianti) il ciclo alla cieca
    // confonde: si apre la scelta esplicita.
    if (variantIds.length >= 2) setChoosing(true);
    else void choose(cycleSelection(m.chosenVariantId, variantIds));
  }

  const chosenName =
    m.variants.find((v) => v.variant.id === m.chosenVariantId)?.variant.name ??
    "Base";

  return (
    <article
      className={cx(
        "em-card flex flex-col gap-2 p-4",
        m.eaten && "shadow-[0_0_0_1px_var(--em-salvia)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
          {m.meal.name}
        </h3>
        {m.variants.length > 0 ? (
          <button
            type="button"
            onClick={tapVariantChip}
            aria-label={`Variante di ${m.meal.name}: ${chosenName}. Tocca per cambiare.`}
            className="em-body-sm min-h-11 shrink-0 rounded-full bg-[var(--em-surface-2)] px-3 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            {chosenName}
          </button>
        ) : null}
      </div>

      {proposta !== null ? (
        <div className="flex items-center justify-between gap-2 rounded-[var(--em-r-sm)] bg-[var(--em-surface-2)] px-3 py-1.5">
          <p className="em-body-sm min-w-0 truncate text-[var(--em-text-2)]">
            Giorno di allenamento: variante «{proposta.name}»?
          </p>
          <button
            type="button"
            onClick={() => void applyProposta(proposta.id, proposta.name)}
            className="em-body-sm min-h-9 shrink-0 font-medium text-[var(--em-text)] transition-opacity duration-[var(--em-dur-tap)] hover:opacity-80"
          >
            Applica
          </button>
        </div>
      ) : null}

      {m.selectionItems.length === 0 ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessun alimento in questa composizione.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {m.selectionItems.map((iv) => (
            <li
              key={iv.item.id}
              className="em-body-sm flex items-baseline justify-between gap-3 text-[var(--em-text-2)]"
            >
              {iv.food ? (
                <>
                  <span className="min-w-0 truncate">{iv.food.name}</span>
                  <span className="em-num shrink-0 text-[var(--em-text-3)]">
                    {formatQty(iv.item.qty, iv.food.basis)}
                  </span>
                </>
              ) : (
                <span className="text-[var(--em-text-3)]">
                  Alimento eliminato (fuori dai conti)
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="em-body-sm em-num text-[var(--em-text-3)]">
          {kcalProteinLine(m.selectionTotals)}
        </p>
        {m.eaten ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void setEaten(false, false)}
          >
            <IconCheck className="h-4 w-4 text-[var(--em-salvia)]" /> Fatto
          </Button>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void setEaten(true, true)}
          >
            Fatto
          </Button>
        )}
      </div>

      <VariantChooser
        m={m}
        open={choosing}
        onClose={() => setChoosing(false)}
        onChoose={(id) => {
          setChoosing(false);
          void choose(id);
        }}
      />
    </article>
  );
}

/** Scelta esplicita della composizione (base + varianti, coi totali). */
function VariantChooser({
  m,
  open,
  onClose,
  onChoose,
}: {
  m: DayDietMeal;
  open: boolean;
  onClose: () => void;
  onChoose: (variantId: string | null) => void;
}) {
  const isDesktop = useIsDesktop();
  const options: Array<{
    id: string | null;
    name: string;
    kcal: number;
    protein_dg: number;
  }> = [
    {
      id: null,
      name: "Base",
      kcal: m.baseTotals.kcal,
      protein_dg: m.baseTotals.protein_dg,
    },
    ...m.variants.map((v) => ({
      id: v.variant.id as string | null,
      name: v.variant.name,
      kcal: v.totals.kcal,
      protein_dg: v.totals.protein_dg,
    })),
  ];

  const body = (
    <ul className="flex flex-col">
      {options.map((o) => {
        const selected = o.id === m.chosenVariantId;
        return (
          <li key={o.id ?? "base"}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onChoose(o.id)}
              className={cx(
                "flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0",
                selected
                  ? "text-[var(--em-text)]"
                  : "text-[var(--em-text-2)] hover:text-[var(--em-text)]",
              )}
            >
              <span className="em-body flex min-w-0 items-center gap-2 font-medium">
                {selected ? (
                  <IconCheck className="h-4 w-4 shrink-0 text-[var(--em-ember)]" />
                ) : null}
                <span className="truncate">{o.name}</span>
              </span>
              <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
                {formatInt(o.kcal)} kcal · {formatGramsFromDg(o.protein_dg)} g
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );

  const title = `${m.meal.name}: composizione`;
  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title={title}>
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {open ? body : <span />}
    </BottomSheet>
  );
}

/* ── Extra del giorno ────────────────────────────────────────────────── */

function ExtrasCard({
  date,
  extras,
}: {
  date: IsoDay;
  extras: DietExtraView[];
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  async function remove(view: DietExtraView) {
    const r = await appRepos().diet.softDeleteExtra(view.extra.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    const label = view.food?.name ?? view.extra.name ?? "Extra";
    toast.show({
      message: `"${label}" eliminato.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.restoreExtra(view.extra.id),
      },
    });
  }

  return (
    <section aria-label="Extra di oggi" className="em-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="em-eyebrow">Extra</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setAdding(true)}
        >
          <IconPlus className="h-4 w-4" /> Aggiungi
        </Button>
      </div>
      {extras.length === 0 ? (
        <p className="em-body-sm mt-2 text-[var(--em-text-3)]">
          Fuori piano? Si scrive qui, senza giudizio: conta nei totali.
        </p>
      ) : (
        <ul className="mt-1 flex flex-col">
          {extras.map((view) => (
            <li
              key={view.extra.id}
              className="flex min-h-11 items-center gap-3 border-b border-[var(--em-hairline)] py-1.5 last:border-b-0"
            >
              <span className="em-body min-w-0 flex-1 truncate text-[var(--em-text)]">
                {view.food?.name ?? view.extra.name ?? "Extra"}
                {view.food && view.extra.qty !== null ? (
                  <span className="em-body-sm em-num ml-2 text-[var(--em-text-3)]">
                    {formatQty(view.extra.qty, view.food.basis)}
                  </span>
                ) : null}
              </span>
              <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
                {view.totals ? `${formatInt(view.totals.kcal)} kcal` : "—"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Elimina ${view.food?.name ?? view.extra.name ?? "extra"}`}
                onClick={() => void remove(view)}
              >
                Elimina
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ExtraSheet date={date} open={adding} onClose={() => setAdding(false)} />
    </section>
  );
}

/** Aggiunta veloce: dalla libreria (autocomplete + quantità) o libera. */
function ExtraSheet({
  date,
  open,
  onClose,
}: {
  date: IsoDay;
  open: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const body = open ? <ExtraSheetBody date={date} onClose={onClose} /> : null;
  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Aggiungi un extra">
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Aggiungi un extra">
      {body ?? <span />}
    </BottomSheet>
  );
}

function ExtraSheetBody({
  date,
  onClose,
}: {
  date: IsoDay;
  onClose: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"libreria" | "libera">("libreria");
  const [picked, setPicked] = useState<Food | null>(null);
  const [qty, setQty] = useState(1);
  // Voce libera.
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");

  async function addFromFood() {
    if (!picked) return;
    const r = await appRepos().diet.addExtra({
      date,
      food_id: picked.id,
      qty,
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
  }

  const kcalValue = parseKcalInput(kcal);
  const freeValid = name.trim() !== "" && kcalValue !== null;

  async function addFree() {
    if (!freeValid || kcalValue === null) return;
    const proteinValue =
      protein.trim() === "" ? null : parseMacroInput(protein);
    const r = await appRepos().diet.addExtra({
      date,
      name: name.trim(),
      kcal: kcalValue,
      ...(proteinValue !== null && { protein_g: proteinValue }),
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
  }

  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Tipo di extra" className="flex gap-1.5">
        {(
          [
            { value: "libreria", label: "Dalla libreria" },
            { value: "libera", label: "Voce libera" },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={mode === o.value}
            onClick={() => setMode(o.value)}
            className={cx(
              "em-body-sm h-11 rounded-[var(--em-r-sm)] px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
              mode === o.value
                ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {mode === "libreria" ? (
        picked === null ? (
          <FoodPickerInline
            onPick={(food) => {
              setPicked(food);
              setQty(defaultQtyFor(food));
            }}
            onCancel={onClose}
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className="em-body min-w-0 truncate font-medium text-[var(--em-text)]">
                {picked.name}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPicked(null)}
              >
                cambia
              </Button>
            </div>
            <QtyStepper
              qty={qty}
              basis={picked.basis}
              onChange={setQty}
              label={`Quantità di ${picked.name}`}
            />
            <Button
              type="button"
              variant="primary"
              className="self-end"
              onClick={() => void addFromFood()}
            >
              Aggiungi
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="em-eyebrow">Nome</span>
            <Input
              autoFocus
              value={name}
              maxLength={120}
              placeholder="Gelato al bar"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="em-eyebrow">kcal</span>
              <Input
                inputMode="numeric"
                value={kcal}
                placeholder="320"
                onChange={(e) => setKcal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addFree();
                }}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="em-eyebrow">Proteine g (opz.)</span>
              <Input
                inputMode="decimal"
                value={protein}
                placeholder="4,5"
                onChange={(e) => setProtein(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addFree();
                }}
              />
            </label>
          </div>
          <Button
            type="button"
            variant="primary"
            disabled={!freeValid}
            className="self-end"
            onClick={() => void addFree()}
          >
            Aggiungi
          </Button>
        </div>
      )}
    </div>
  );
}
