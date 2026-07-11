"use client";

/**
 * Editor delle sessioni PASSATE (run-07: la seduta viva è la griglia,
 * session-grid.tsx — questa superficie resta per correggere lo storico,
 * v1 comprese). Stepper ±2,5 kg / ±1 rep, duplica ultima serie, note
 * commit-on-blur. NIENTE timer qui: il recupero quieto vive nella
 * griglia della seduta in corso.
 */

import { useMemo, useState } from "react";
import { Button, Skeleton, useToast } from "@/ui";
import {
  appRepos,
  useExercises,
  usePlans,
  useSetsBySession,
} from "@/data/hooks";
import type { GymExercise, GymSession, GymSet } from "@/data/schemas";
import { formatKg, stepReps, stepWeight, totalVolumeKg } from "./logic";
import { ExercisePicker } from "./exercise-picker";

export function SessionRunner({ session }: { session: GymSession }) {
  const toast = useToast();
  const sets = useSetsBySession(session.id);
  const exercises = useExercises();
  const plans = usePlans();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [notes, setNotes] = useState(session.notes ?? "");

  const byId = useMemo(
    () => new Map((exercises ?? []).map((e) => [e.id, e] as const)),
    [exercises],
  );

  // Gruppi della sessione: esercizi del piano v1 (in ordine) + quelli
  // con set. Le sessioni nate da un giorno di programma mostrano
  // semplicemente i loro set (la griglia è la superficie viva).
  const plan = (plans ?? []).find((p) => p.id === session.plan_id) ?? null;
  const groups = useMemo(() => {
    const ordered: string[] = [];
    const seen = new Set<string>();
    for (const entry of plan?.entries ?? []) {
      if (!seen.has(entry.exercise_id)) {
        seen.add(entry.exercise_id);
        ordered.push(entry.exercise_id);
      }
    }
    for (const s of sets ?? []) {
      if (!seen.has(s.exercise_id)) {
        seen.add(s.exercise_id);
        ordered.push(s.exercise_id);
      }
    }
    return ordered;
  }, [plan, sets]);

  async function logSet(exercise: GymExercise, from?: GymSet) {
    const repo = appRepos().gym;
    let weight = from?.weight_kg ?? null;
    let reps = from?.reps ?? 8;
    if (!from) {
      // Prima serie dell'esercizio: riparti dall'ultima della storia.
      const history = await repo.listSetsByExercise(exercise.id, { limit: 1 });
      if (history.length > 0) {
        weight = history[0].weight_kg;
        reps = history[0].reps;
      }
    }
    const r = await repo.addSet({
      session_id: session.id,
      exercise_id: exercise.id,
      weight_kg: weight,
      reps,
      done_at: null,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function patchSet(set: GymSet, patch: { weight_kg?: number | null; reps?: number }) {
    const r = await appRepos().gym.updateSet(set.id, patch);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function removeSet(set: GymSet) {
    const r = await appRepos().gym.softDeleteSet(set.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function commitNotes() {
    const value = notes.trim() === "" ? null : notes;
    if (value === session.notes) return;
    const r = await appRepos().gym.updateSession(session.id, { notes: value });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  if (sets === undefined || exercises === undefined) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.length === 0 ? (
        <p className="em-body-sm text-[var(--em-text-3)]">
          Nessuna serie in questa sessione. Aggiungi un esercizio per
          correggerla.
        </p>
      ) : null}

      {groups.map((exerciseId) => {
        const exercise = byId.get(exerciseId);
        const exerciseSets = sets.filter((s) => s.exercise_id === exerciseId);
        const target = plan?.entries.find((e) => e.exercise_id === exerciseId);
        return (
          <section key={exerciseId} aria-label={exercise?.name ?? "Esercizio"}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="em-body font-semibold text-[var(--em-text)]">
                {exercise?.name ?? "Esercizio rimosso"}
              </h3>
              {target ? (
                <span className="em-body-sm em-num text-[var(--em-text-3)]">
                  obiettivo {target.target_sets}
                  {target.target_reps ? `×${target.target_reps}` : ""}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {exerciseSets.map((set) => (
                <SetRow
                  key={set.id}
                  set={set}
                  onPatch={(p) => void patchSet(set, p)}
                  onRemove={() => void removeSet(set)}
                />
              ))}
              {exercise ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={() =>
                    void logSet(exercise, exerciseSets.at(-1) ?? undefined)
                  }
                  className="justify-start"
                >
                  {exerciseSets.length > 0
                    ? "Duplica ultima serie"
                    : "Registra la prima serie"}
                </Button>
              ) : null}
            </div>
          </section>
        );
      })}

      <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)}>
        + Aggiungi esercizio
      </Button>

      <div>
        <label htmlFor="session-notes" className="em-eyebrow">
          Note della sessione
        </label>
        <textarea
          id="session-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={() => void commitNotes()}
          rows={2}
          maxLength={2000}
          className="em-body mt-1.5 w-full rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-3 text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline)] outline-none transition-shadow duration-[var(--em-dur-control)] placeholder:text-[var(--em-text-3)] focus:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          placeholder="Com'è andata?"
        />
      </div>

      <p className="em-body-sm text-[var(--em-text-3)]">
        Volume della sessione: {formatKg(totalVolumeKg(sets))}
      </p>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(e) => {
          setPickerOpen(false);
          void logSet(e);
        }}
      />
    </div>
  );
}

/* ── Riga di un set: stepper grandi, tap sicuri ──────────────────────── */

function SetRow({
  set,
  onPatch,
  onRemove,
}: {
  set: GymSet;
  onPatch: (patch: { weight_kg?: number | null; reps?: number }) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-2 shadow-[0_0_0_1px_var(--em-hairline)]">
      <span className="em-eyebrow w-7 shrink-0 text-center">{set.set_number}</span>

      <Stepper
        label="peso"
        display={set.weight_kg !== null ? formatKg(set.weight_kg) : "corpo"}
        onMinus={() => onPatch({ weight_kg: stepWeight(set.weight_kg, -1) })}
        onPlus={() => onPatch({ weight_kg: stepWeight(set.weight_kg, 1) })}
      />
      <Stepper
        label="reps"
        display={`× ${set.reps}`}
        onMinus={() => onPatch({ reps: stepReps(set.reps, -1) })}
        onPlus={() => onPatch({ reps: stepReps(set.reps, 1) })}
      />

      <button
        type="button"
        aria-label={`Elimina la serie ${set.set_number}`}
        onClick={onRemove}
        className="ml-auto grid h-11 w-9 shrink-0 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function Stepper({
  label,
  display,
  onMinus,
  onPlus,
}: {
  label: string;
  display: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <StepButton ariaLabel={`Meno ${label}`} onClick={onMinus}>
        −
      </StepButton>
      <span className="em-body em-num min-w-0 flex-1 truncate text-center font-medium text-[var(--em-text)]">
        {display}
      </span>
      <StepButton ariaLabel={`Più ${label}`} onClick={onPlus}>
        +
      </StepButton>
    </div>
  );
}

function StepButton({
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
