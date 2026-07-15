"use client";

/**
 * Tab "Alimenti" di /dieta — la libreria PERSONALE: ricerca, scheda di
 * creazione/modifica (basis SOLO alla creazione: cambierebbe il senso
 * delle quantità già scritte), archivio con undo. NESSUN seed: una
 * dieta personale non ha default onesti — lo starter spiega il setup.
 */

import { useMemo, useState } from "react";
import {
  BottomSheet,
  Button,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  useToast,
} from "@/ui";
import { appRepos, useFoods } from "@/data/hooks";
import type { Food, FoodBasis } from "@/data/schemas";
import { IconChevronRight, IconPlus } from "../_components/icons";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { BasisChips, normalizeFoodName } from "./food-picker";
import {
  formatGramsFromDg,
  formatInt,
  parseKcalInput,
  parseMacroInput,
  parseQtyInput,
  qtyUnit,
} from "./logic";
import { toDg } from "@/data/diet";

export function AlimentiTab() {
  const foods = useFoods({ includeArchived: true });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Food | "new" | null>(null);

  const filtered = useMemo(() => {
    const q = normalizeFoodName(query);
    return (foods ?? []).filter(
      (f) => q === "" || normalizeFoodName(f.name).includes(q),
    );
  }, [foods, query]);
  const active = filtered.filter((f) => f.archived_at === null);
  const archived = filtered.filter((f) => f.archived_at !== null);

  if (foods === undefined) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3 pt-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {foods.length === 0 ? (
        <EmptyState
          heading="La tua libreria, i tuoi numeri"
          text="Niente database pubblico: crei i TUOI alimenti una volta, dall'etichetta (kcal e macro per 100 g o al pezzo). Due minuti per i primi cinque, poi i pasti li riusano per sempre."
          action={
            <Button
              type="button"
              variant="primary"
              onClick={() => setEditing("new")}
            >
              Crea il primo alimento
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cerca"
              aria-label="Cerca un alimento"
              autoComplete="off"
              className="min-w-0 flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing("new")}
            >
              <IconPlus className="h-4 w-4" /> Nuovo
            </Button>
          </div>

          {active.length === 0 && archived.length === 0 ? (
            <EmptyState
              compact
              heading="Nessun risultato"
              text="Prova un altro nome, o crealo: è la TUA libreria."
            />
          ) : (
            <ul className="flex flex-col">
              {active.map((f) => (
                <FoodRow key={f.id} food={f} onOpen={() => setEditing(f)} />
              ))}
            </ul>
          )}

          {archived.length > 0 ? (
            <details>
              <summary className="em-body-sm cursor-pointer text-[var(--em-text-3)]">
                Archiviati ({archived.length})
              </summary>
              <ul className="mt-1 flex flex-col">
                {archived.map((f) => (
                  <FoodRow
                    key={f.id}
                    food={f}
                    archived
                    onOpen={() => setEditing(f)}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </>
      )}

      <FoodSheet
        food={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function FoodRow({
  food,
  archived = false,
  onOpen,
}: {
  food: Food;
  archived?: boolean;
  onOpen: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-11 w-full items-center gap-3 border-b border-[var(--em-hairline)] py-2 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
      >
        <span className="em-body min-w-0 flex-1 truncate font-medium text-[var(--em-text)]">
          {food.name}
        </span>
        {archived ? (
          <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)]">
            archiviato
          </span>
        ) : null}
        <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
          {formatInt(food.kcal)} kcal ·{" "}
          {formatGramsFromDg(toDg(food.protein_g))} g /{" "}
          {food.basis === "per100g" ? "100 g" : "pz"}
        </span>
        <IconChevronRight className="shrink-0 text-[var(--em-text-3)]" />
      </button>
    </li>
  );
}

/* ── Scheda alimento (crea + modifica) ───────────────────────────────── */

function FoodSheet({
  food,
  open,
  onClose,
}: {
  /** null = creazione. */
  food: Food | null;
  open: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const title = food ? food.name : "Nuovo alimento";
  const body = open ? (
    <FoodSheetBody key={food?.id ?? "new"} food={food} onClose={onClose} />
  ) : null;
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

function FoodSheetBody({
  food,
  onClose,
}: {
  food: Food | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(food?.name ?? "");
  const [basis, setBasis] = useState<FoodBasis>(food?.basis ?? "per100g");
  const [kcal, setKcal] = useState(food ? String(food.kcal) : "");
  const [protein, setProtein] = useState(
    food ? String(food.protein_g).replace(".", ",") : "",
  );
  const [carbs, setCarbs] = useState(
    food ? String(food.carbs_g).replace(".", ",") : "",
  );
  const [fat, setFat] = useState(
    food ? String(food.fat_g).replace(".", ",") : "",
  );
  const [defaultQty, setDefaultQty] = useState(
    food?.default_qty !== null && food?.default_qty !== undefined
      ? String(food.default_qty).replace(".", ",")
      : "",
  );

  const kcalValue = parseKcalInput(kcal);
  const valid = name.trim() !== "" && kcalValue !== null;

  function macroOrZero(raw: string): number {
    return raw.trim() === "" ? 0 : (parseMacroInput(raw) ?? 0);
  }

  async function save() {
    if (!valid || kcalValue === null) return;
    const fields = {
      name: name.trim(),
      kcal: kcalValue,
      protein_g: macroOrZero(protein),
      carbs_g: macroOrZero(carbs),
      fat_g: macroOrZero(fat),
      default_qty: defaultQty.trim() === "" ? null : parseQtyInput(defaultQty),
    };
    const r = food
      ? await appRepos().diet.updateFood(food.id, fields)
      : await appRepos().diet.createFood({ ...fields, basis });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
  }

  async function archive() {
    if (!food) return;
    const r = await appRepos().diet.archiveFood(food.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${food.name}" archiviato: sparisce dalle ricerche, la storia resta.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.unarchiveFood(food.id),
      },
    });
  }

  async function unarchive() {
    if (!food) return;
    const r = await appRepos().diet.unarchiveFood(food.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    else onClose();
  }

  async function remove() {
    if (!food) return;
    const r = await appRepos().diet.softDeleteFood(food.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onClose();
    toast.show({
      message: `"${food.name}" eliminato: le righe che lo usano escono dai conti.`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().diet.restoreFood(food.id),
      },
    });
  }

  const unit = qtyUnit(basis);

  return (
    <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto">
      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nome</span>
        <Input
          autoFocus={food === null}
          value={name}
          maxLength={120}
          placeholder="Pasta, Petto di pollo…"
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      {food === null ? (
        <BasisChips value={basis} onChange={setBasis} />
      ) : (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Valori {basis === "per100g" ? "per 100 g" : "al pezzo"} — la base
          non si cambia: cambierebbe il senso delle quantità già nei pasti.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">
            kcal {basis === "per100g" ? "/100 g" : "/pz"}
          </span>
          <Input
            inputMode="numeric"
            value={kcal}
            placeholder="353"
            onChange={(e) => setKcal(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Proteine g</span>
          <Input
            inputMode="decimal"
            value={protein}
            placeholder="13,5"
            onChange={(e) => setProtein(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Carboidrati g</span>
          <Input
            inputMode="decimal"
            value={carbs}
            placeholder="70,2"
            onChange={(e) => setCarbs(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Grassi g</span>
          <Input
            inputMode="decimal"
            value={fat}
            placeholder="1,8"
            onChange={(e) => setFat(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Quantità proposta ({unit}, opz.)</span>
        <Input
          inputMode="decimal"
          value={defaultQty}
          placeholder={basis === "per100g" ? "80" : "2"}
          onChange={(e) => setDefaultQty(e.target.value)}
        />
      </label>

      <div className="flex items-center justify-between gap-3 pt-1">
        {food ? (
          <span className="flex gap-2">
            {food.archived_at === null ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => void archive()}>
                Archivia
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => void unarchive()}>
                Ripristina
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => void remove()}>
              Elimina
            </Button>
          </span>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="primary"
          disabled={!valid}
          onClick={() => void save()}
        >
          {food ? "Salva" : "Crea alimento"}
        </Button>
      </div>
    </div>
  );
}
