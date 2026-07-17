"use client";

/**
 * Selettore alimenti INLINE (niente sheet sopra sheet): ricerca nella
 * libreria personale + creazione al volo «Crea "query"» con la scheda
 * minima (basis, kcal, macro facoltative). Vive dentro il meal editor
 * e dentro la scheda Extra.
 */

import { useMemo, useState } from "react";
import { Button, Input, Skeleton, cx, useToast } from "@/ui";
import { appRepos, useFoods } from "@/data/hooks";
import type { Food, FoodBasis } from "@/data/schemas";
import { formatInt, parseKcalInput, parseMacroInput } from "./logic";

export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

export function FoodPickerInline({
  onPick,
  onCancel,
}: {
  onPick: (food: Food) => void;
  onCancel: () => void;
}) {
  const foods = useFoods();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = normalizeFoodName(query);
    return (foods ?? []).filter(
      (f) => q === "" || normalizeFoodName(f.name).includes(q),
    );
  }, [foods, query]);

  if (creating) {
    return (
      <FoodQuickCreate
        initialName={query.trim()}
        onCreated={onPick}
        onCancel={() => setCreating(false)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca un alimento"
        aria-label="Cerca un alimento"
        autoComplete="off"
      />
      <ul className="max-h-56 min-h-0 overflow-y-auto">
        {filtered.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              onClick={() => onPick(f)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body min-w-0 truncate text-[var(--em-text)]">
                {f.name}
              </span>
              <span className="em-body-sm em-num shrink-0 text-[var(--em-text-3)]">
                {formatInt(f.kcal)} kcal/
                {f.basis === "per100g" ? "100 g" : "pz"}
              </span>
            </button>
          </li>
        ))}
        {query.trim() !== "" ? (
          <li>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex min-h-11 w-full items-center gap-2 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body font-medium text-[var(--em-ember-text)]">
                + Crea «{query.trim()}»
              </span>
              <span className="em-eyebrow text-[var(--em-text-3)]">
                nuovo alimento
              </span>
            </button>
          </li>
        ) : null}
        {foods === undefined ? (
          <li aria-busy="true" className="py-2">
            <Skeleton className="h-9 w-full" />
          </li>
        ) : filtered.length === 0 && query.trim() === "" ? (
          <li className="em-body-sm py-4 text-[var(--em-text-3)]">
            La libreria è vuota: scrivi un nome per creare il primo alimento.
          </li>
        ) : null}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={onCancel}
      >
        Annulla
      </Button>
    </div>
  );
}

/** Chips della basis (mai un select nativo). */
export function BasisChips({
  value,
  onChange,
}: {
  value: FoodBasis;
  onChange: (basis: FoodBasis) => void;
}) {
  const options: Array<{ value: FoodBasis; label: string }> = [
    { value: "per100g", label: "Per 100 g" },
    { value: "per_piece", label: "Al pezzo" },
  ];
  return (
    <div role="group" aria-label="Base di misura" className="flex gap-1.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            "em-body-sm h-11 rounded-[var(--em-r-sm)] px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
            value === o.value
              ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
              : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Creazione al volo: nome + basis + kcal bastano; le macro si affinano
 * dopo, dalla libreria. Consegna l'alimento appena creato a onCreated.
 */
function FoodQuickCreate({
  initialName,
  onCreated,
  onCancel,
}: {
  initialName: string;
  onCreated: (food: Food) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [basis, setBasis] = useState<FoodBasis>("per100g");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");

  const kcalValue = parseKcalInput(kcal);
  const valid = name.trim() !== "" && kcalValue !== null;

  async function create() {
    if (!valid || kcalValue === null) return;
    const r = await appRepos().diet.createFood({
      name: name.trim(),
      basis,
      kcal: kcalValue,
      protein_g: protein.trim() === "" ? 0 : (parseMacroInput(protein) ?? 0),
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onCreated(r.data);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="em-eyebrow">Nome</span>
        <Input
          autoFocus={initialName === ""}
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <BasisChips value={basis} onChange={setBasis} />
      <div className="flex gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="em-eyebrow">
            kcal {basis === "per100g" ? "per 100 g" : "al pezzo"}
          </span>
          <Input
            inputMode="numeric"
            autoFocus={initialName !== ""}
            value={kcal}
            placeholder="353"
            onChange={(e) => setKcal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="em-eyebrow">Proteine g (opz.)</span>
          <Input
            inputMode="decimal"
            value={protein}
            placeholder="13,5"
            onChange={(e) => setProtein(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void create();
            }}
          />
        </label>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          ‹ Ricerca
        </Button>
        <Button
          type="button"
          variant="primary"
          disabled={!valid}
          onClick={() => void create()}
        >
          Crea e usa
        </Button>
      </div>
    </div>
  );
}
