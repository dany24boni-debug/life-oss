"use client";

/**
 * Piani di allenamento (B2.3): template con nome ed esercizi ordinati
 * (target serie × ripetizioni). L'ordine dell'array È l'ordine del piano:
 * frecce su/giù, niente drag — funziona anche col pollice. Vale come
 * creazione (plan = null).
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  Field,
  Input,
  Modal,
  useToast,
} from "@/ui";
import { appRepos, useExercises } from "@/data/hooks";
import type { GymPlan, GymPlanEntry } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { ExercisePicker } from "./exercise-picker";

export function PlanEditorSheet({
  plan,
  createOpen,
  onClose,
}: {
  plan: GymPlan | null;
  createOpen?: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const open = plan !== null || createOpen === true;
  const title = plan ? "Piano" : "Nuovo piano";
  // key: cambiando piano il form rimonta con lo stato giusto.
  const body = open ? (
    <PlanForm key={plan?.id ?? "nuovo"} plan={plan} onDone={onClose} />
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

function PlanForm({
  plan,
  onDone,
}: {
  plan: GymPlan | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const exercises = useExercises();
  const [name, setName] = useState(plan?.name ?? "");
  const [entries, setEntries] = useState<GymPlanEntry[]>(plan?.entries ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);

  const nameOf = (id: string) =>
    exercises?.find((e) => e.id === id)?.name ?? "Esercizio rimosso";

  function move(index: number, delta: -1 | 1) {
    setEntries((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }

  function patchEntry(index: number, patch: Partial<GymPlanEntry>) {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, ...patch } : e)),
    );
  }

  async function save() {
    const trimmed = name.trim();
    if (trimmed === "") {
      toast.show({ message: "Serve un nome per il piano.", tone: "error" });
      return;
    }
    const repo = appRepos().gym;
    const r = plan
      ? await repo.updatePlan(plan.id, { name: trimmed, entries })
      : await repo.createPlan({ name: trimmed, entries });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDone();
  }

  async function remove() {
    if (!plan) return;
    const r = await appRepos().gym.softDeletePlan(plan.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDone();
    toast.show({ message: `Eliminato: ${plan.name}` });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Nome" hint='es. "Giorno A", "Push", "Gambe"'>
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        )}
      </Field>

      <div className="flex flex-col gap-2" aria-label="Esercizi del piano">
        {entries.map((entry, i) => (
          <div
            key={`${entry.exercise_id}-${i}`}
            className="flex items-center gap-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-2 shadow-[0_0_0_1px_var(--em-hairline)]"
          >
            <div className="flex shrink-0 flex-col">
              <ArrowButton
                label="Sposta su"
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <path d="M6 14l6-6 6 6" />
              </ArrowButton>
              <ArrowButton
                label="Sposta giù"
                disabled={i === entries.length - 1}
                onClick={() => move(i, 1)}
              >
                <path d="M6 10l6 6 6-6" />
              </ArrowButton>
            </div>
            <span className="em-body min-w-0 flex-1 truncate text-[var(--em-text)]">
              {nameOf(entry.exercise_id)}
            </span>
            <label className="em-body-sm flex shrink-0 items-center gap-1 text-[var(--em-text-3)]">
              <span aria-hidden="true">serie</span>
              <Input
                value={String(entry.target_sets)}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value || "0", 10);
                  patchEntry(i, {
                    target_sets: Math.max(1, Math.min(20, v || 1)),
                  });
                }}
                inputMode="numeric"
                aria-label="Serie obiettivo"
                className="w-12 text-center"
              />
            </label>
            <label className="em-body-sm flex shrink-0 items-center gap-1 text-[var(--em-text-3)]">
              <span aria-hidden="true">×</span>
              <Input
                value={entry.target_reps === null ? "" : String(entry.target_reps)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  patchEntry(i, {
                    target_reps:
                      raw === ""
                        ? null
                        : Math.max(1, Math.min(100, Number.parseInt(raw, 10))),
                  });
                }}
                inputMode="numeric"
                aria-label="Ripetizioni obiettivo"
                placeholder="—"
                className="w-12 text-center"
              />
            </label>
            <button
              type="button"
              aria-label={`Togli ${nameOf(entry.exercise_id)} dal piano`}
              onClick={() =>
                setEntries((prev) => prev.filter((_, j) => j !== i))
              }
              className="grid h-11 w-9 shrink-0 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
        + Aggiungi esercizio al piano
      </Button>

      <div className="flex items-center justify-between">
        {plan ? (
          <Button type="button" variant="ghost" onClick={() => void remove()}>
            Elimina piano
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary">
          {plan ? "Salva piano" : "Crea piano"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setPickerOpen(false);
          setEntries((prev) => [
            ...prev,
            {
              exercise_id: e.id,
              target_sets: 3,
              target_reps: 10,
              note: null,
            },
          ]);
        }}
      />
    </form>
  );
}

function ArrowButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-6 w-8 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)] disabled:opacity-30"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
