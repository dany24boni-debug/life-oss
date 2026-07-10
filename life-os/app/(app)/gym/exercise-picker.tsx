"use client";

/**
 * Selettore esercizi (sessione e piani): ricerca per nome + filtro gruppo,
 * lista dal catalogo (seminato + custom). BottomSheet su touch, Modal da
 * md in su. Righe alte 44px+ — si usa col telefono in mano tra un set e
 * l'altro.
 */

import { useMemo, useState } from "react";
import { BottomSheet, Input, Modal, cx } from "@/ui";
import { useExercises } from "@/data/hooks";
import type { GymExercise, MuscleGroup } from "@/data/schemas";
import { MuscleGroupSchema } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { normalizeExerciseName } from "./importer";

const GROUP_LABELS: Record<MuscleGroup, string> = {
  petto: "Petto",
  schiena: "Schiena",
  gambe: "Gambe",
  spalle: "Spalle",
  braccia: "Braccia",
  addominali: "Addominali",
  cardio: "Cardio",
  altro: "Altro",
};

export const MUSCLE_GROUPS = MuscleGroupSchema.options;

export function groupLabel(group: MuscleGroup): string {
  return GROUP_LABELS[group];
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: GymExercise) => void;
}) {
  const isDesktop = useIsDesktop();
  const exercises = useExercises();
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroup | null>(null);

  const filtered = useMemo(() => {
    const all = exercises ?? [];
    const q = normalizeExerciseName(query);
    return all.filter(
      (e) =>
        (group === null || e.muscle_group === group) &&
        (q === "" || normalizeExerciseName(e.name).includes(q)),
    );
  }, [exercises, query, group]);

  const body = (
    <div className="flex max-h-[60vh] flex-col gap-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Cerca un esercizio"
        aria-label="Cerca un esercizio"
        autoComplete="off"
      />
      <div className="flex flex-wrap gap-1.5" aria-label="Gruppi muscolari">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setGroup((cur) => (cur === g ? null : g))}
            aria-pressed={group === g}
            className={cx(
              "em-body-sm h-8 rounded-full px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
              group === g
                ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
                : "bg-[var(--em-surface-2)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
            )}
          >
            {groupLabel(g)}
          </button>
        ))}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => onPick(e)}
              className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-[var(--em-hairline)] py-2.5 text-left transition-colors duration-[var(--em-dur-tap)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--em-text)_5%,transparent)]"
            >
              <span className="em-body min-w-0 truncate text-[var(--em-text)]">
                {e.name}
              </span>
              <span className="em-eyebrow shrink-0 text-[var(--em-text-3)]">
                {groupLabel(e.muscle_group)}
              </span>
            </button>
          </li>
        ))}
        {filtered.length === 0 ? (
          <li className="em-body-sm py-4 text-[var(--em-text-3)]">
            Nessun esercizio trovato. Crealo dalla Libreria.
          </li>
        ) : null}
      </ul>
    </div>
  );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Scegli un esercizio">
        {open ? body : null}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Scegli un esercizio">
      {open ? body : <span />}
    </BottomSheet>
  );
}
