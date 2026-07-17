"use client";

/**
 * Editor del profilo attrezzatura (run-12 P2, PROP-gym-03) — bilanciere
 * + dischi posseduti, le due colonne P1 su Settings (sincronizzate: la
 * palestra è la stessa da ogni dispositivo). Vive DENTRO il micro-editor
 * del set (swap di contenuto, niente sheet sopra sheet): si apre dal
 * link quieto del calcolatore, si salva con undo, si torna alla serie.
 */

import { useState } from "react";
import { Button, useToast } from "@/ui";
import { appRepos } from "@/data/hooks";
import type { GymPlate, Settings } from "@/data/schemas";
import { formatKgShort } from "./progression";

/** Tagli comuni proposti come chip d'aggiunta (n=2 al primo tap). */
const COMMON_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

const BAR_MIN = 2.5;
const BAR_MAX = 100;

export function EquipmentEditor({
  settings,
  onDone,
}: {
  settings: Settings;
  onDone: () => void;
}) {
  const toast = useToast();
  const [barKg, setBarKg] = useState<number>(settings.gym_bar_kg ?? 20);
  const [plates, setPlates] = useState<GymPlate[]>(
    settings.gym_plates ?? [],
  );

  const sorted = [...plates].sort((a, b) => b.kg - a.kg);
  const missing = COMMON_PLATES.filter(
    (kg) => !plates.some((p) => p.kg === kg),
  );

  function stepBar(direction: 1 | -1) {
    setBarKg((b) =>
      Math.min(BAR_MAX, Math.max(BAR_MIN, b + direction * 2.5)),
    );
  }

  function stepCount(kg: number, direction: 1 | -1) {
    setPlates((prev) => {
      const cur = prev.find((p) => p.kg === kg);
      if (!cur) return prev;
      const n = cur.n + direction;
      // Sotto 1 il taglio si toglie (il "meno" finale è la rimozione).
      if (n < 1) return prev.filter((p) => p.kg !== kg);
      return prev.map((p) => (p.kg === kg ? { ...p, n: Math.min(40, n) } : p));
    });
  }

  async function save() {
    const prev = {
      gym_bar_kg: settings.gym_bar_kg,
      gym_plates: settings.gym_plates,
    };
    const r = await appRepos().settings.update({
      gym_bar_kg: barKg,
      gym_plates: plates.length > 0 ? plates : null,
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message: "Attrezzatura salvata.",
      action: {
        label: "Annulla",
        onClick: () => {
          void appRepos().settings.update(prev);
        },
      },
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="em-body-sm text-[var(--em-text-3)]">
        Bilanciere e dischi che possiedi: il calcolatore mostra i dischi
        per lato a ogni peso. Sincronizzato su tutti i dispositivi.
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="em-eyebrow">Bilanciere</span>
        <div className="flex items-center gap-1">
          <EquipBtn ariaLabel="Meno bilanciere" onClick={() => stepBar(-1)}>
            −
          </EquipBtn>
          <span className="em-body em-num w-24 text-center font-semibold text-[var(--em-text)]">
            {formatKgShort(barKg)} kg
          </span>
          <EquipBtn ariaLabel="Più bilanciere" onClick={() => stepBar(1)}>
            +
          </EquipBtn>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="em-eyebrow">Dischi (totali posseduti)</span>
        {sorted.length === 0 ? (
          <p className="em-body-sm text-[var(--em-text-3)]">
            Nessun disco: aggiungi i tagli qui sotto.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {sorted.map((p) => (
              <li
                key={p.kg}
                className="flex items-center justify-between gap-3"
              >
                <span className="em-body em-num text-[var(--em-text)]">
                  {formatKgShort(p.kg)} kg
                </span>
                <div className="flex items-center gap-1">
                  <EquipBtn
                    ariaLabel={`Un disco da ${formatKgShort(p.kg)} in meno`}
                    onClick={() => stepCount(p.kg, -1)}
                  >
                    −
                  </EquipBtn>
                  <span className="em-body-sm em-num w-10 text-center text-[var(--em-text-2)]">
                    ×{p.n}
                  </span>
                  <EquipBtn
                    ariaLabel={`Un disco da ${formatKgShort(p.kg)} in più`}
                    onClick={() => stepCount(p.kg, 1)}
                  >
                    +
                  </EquipBtn>
                </div>
              </li>
            ))}
          </ul>
        )}
        {missing.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {missing.map((kg) => (
              <button
                key={kg}
                type="button"
                onClick={() =>
                  setPlates((prev) => [...prev, { kg, n: 2 }])
                }
                className="em-body-sm em-num h-11 rounded-full bg-[var(--em-surface)] px-3 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
              >
                + {formatKgShort(kg)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onDone}>
          Indietro
        </Button>
        <Button type="button" variant="primary" onClick={() => void save()}>
          Salva
        </Button>
      </div>
    </div>
  );
}

function EquipBtn({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface)] text-lg font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] active:text-[var(--em-text)]"
    >
      {children}
    </button>
  );
}
