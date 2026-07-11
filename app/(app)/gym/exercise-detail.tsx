"use client";

/**
 * Scheda esercizio (B2.3 "Progress"): modifica (nome, gruppo, recupero
 * predefinito, nota) + la storia — sparkline del miglior carico per
 * giorno, PR calcolati DAI SET alla lettura (mai cache) e 1RM stimato
 * (lib/fitness, Brzycki). Vale anche come creazione (exercise = null).
 */

import { useState } from "react";
import {
  BottomSheet,
  Button,
  ChartFrame,
  Field,
  Input,
  Modal,
  Select,
  useToast,
} from "@/ui";
import {
  appRepos,
  useActiveProgramSlots,
  useGymSessionsRange,
  useSetsByExercise,
} from "@/data/hooks";
import type { GymExercise, GymSession, MuscleGroup } from "@/data/schemas";
import { addMonths, todayLocal } from "@/ui/calendar-core";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { MUSCLE_GROUPS, groupLabel } from "./exercise-picker";
import {
  computePRs,
  exerciseTrend,
  formatKg,
  sparklinePath,
} from "./logic";
import { ProgressTable } from "./progress-table";
import { verdictForSlot, verdictLabel } from "./progression";

export function ExerciseDetailSheet({
  exercise,
  createOpen,
  onClose,
}: {
  /** Esercizio da mostrare/modificare; null col flag create = nuovo. */
  exercise: GymExercise | null;
  createOpen?: boolean;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktop();
  const open = exercise !== null || createOpen === true;
  const title = exercise ? "Esercizio" : "Nuovo esercizio";

  const body = open ? (
    <div className="flex flex-col gap-5">
      {/* key: cambiando esercizio il form rimonta con lo stato giusto. */}
      <ExerciseForm
        key={exercise?.id ?? "nuovo"}
        exercise={exercise}
        onDone={onClose}
      />
      {exercise ? <ExerciseProgress exercise={exercise} /> : null}
    </div>
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

function ExerciseForm({
  exercise,
  onDone,
}: {
  exercise: GymExercise | null;
  onDone: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(exercise?.name ?? "");
  const [group, setGroup] = useState<MuscleGroup>(
    exercise?.muscle_group ?? "altro",
  );
  const [rest, setRest] = useState(
    exercise?.default_rest_seconds?.toString() ?? "",
  );

  async function save() {
    const trimmed = name.trim();
    if (trimmed === "") {
      toast.show({ message: "Serve un nome per l'esercizio.", tone: "error" });
      return;
    }
    const restParsed =
      rest.trim() === "" ? null : Number.parseInt(rest.trim(), 10);
    const restValue =
      restParsed === null || Number.isNaN(restParsed)
        ? null
        : Math.max(0, Math.min(900, restParsed));

    const repo = appRepos().gym;
    const r = exercise
      ? await repo.updateExercise(exercise.id, {
          name: trimmed,
          muscle_group: group,
          default_rest_seconds: restValue,
        })
      : await repo.createExercise({
          name: trimmed,
          muscle_group: group,
          default_rest_seconds: restValue,
          is_custom: true,
        });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDone();
  }

  async function remove() {
    if (!exercise) return;
    const r = await appRepos().gym.softDeleteExercise(exercise.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onDone();
    // Niente undo qui: il port non ha restoreExercise e la libreria è un
    // contesto calmo (non il mid-workout) — un ri-crea manuale basta.
    toast.show({ message: `Eliminato: ${exercise.name}` });
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field label="Nome">
        {(fieldProps) => (
          <Input
            {...fieldProps}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gruppo">
          {(fieldProps) => (
            <Select
              id={fieldProps.id}
              value={group}
              onChange={(v) => setGroup(v as MuscleGroup)}
              options={MUSCLE_GROUPS.map((g) => ({
                value: g,
                label: groupLabel(g),
              }))}
            />
          )}
        </Field>
        <Field label="Recupero" hint="secondi tra i set">
          {(fieldProps) => (
            <Input
              {...fieldProps}
              value={rest}
              onChange={(e) => setRest(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="90"
              maxLength={3}
            />
          )}
        </Field>
      </div>
      <div className="flex items-center justify-between">
        {exercise ? (
          <Button type="button" variant="ghost" onClick={() => void remove()}>
            Elimina
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" variant="primary">
          {exercise ? "Salva" : "Crea esercizio"}
        </Button>
      </div>
    </form>
  );
}

/* ── Storia e PR ─────────────────────────────────────────────────────── */

function ExerciseProgress({ exercise }: { exercise: GymExercise }) {
  const today = todayLocal();
  const sets = useSetsByExercise(exercise.id, 500);
  const sessions = useGymSessionsRange(addMonths(today, -12), today);

  const loading = sets === undefined || sessions === undefined;
  const prs = computePRs(sets ?? []);
  const days = new Map((sessions ?? []).map((s) => [s.id, s.date] as const));
  const trend = exerciseTrend(sets ?? [], days);
  const path = sparklinePath(trend, 280, 48);

  return (
    <div className="flex flex-col gap-3 border-t border-[var(--em-hairline)] pt-4">
      <ExerciseVerdict exercise={exercise} sessions={sessions ?? []} />
      <ChartFrame
        label="Progressi"
        title="Miglior carico per giorno"
        state={loading ? "loading" : trend.length > 0 ? "ready" : "empty"}
        emptyText="Ancora nessun set con peso: la storia parte dal primo."
        minHeight={72}
        caption="Ultimi 12 mesi. PR e 1RM calcolati dai set, mai memorizzati."
      >
        {trend.length > 0 ? (
          <svg
            viewBox="0 0 280 48"
            className="h-12 w-full"
            role="img"
            aria-label={`Andamento del carico: da ${formatKg(trend[0].topWeightKg)} a ${formatKg(trend[trend.length - 1].topWeightKg)}`}
          >
            <polyline
              points={path}
              fill="none"
              stroke="var(--em-ember)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </ChartFrame>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
        <PrLine label="Peso massimo" value={prs.maxWeightKg !== null ? formatKg(prs.maxWeightKg) : "—"} />
        <PrLine label="Ripetizioni max" value={prs.maxReps !== null ? String(prs.maxReps) : "—"} />
        <PrLine label="Volume migliore" value={prs.maxSessionVolumeKg !== null ? formatKg(prs.maxSessionVolumeKg) : "—"} />
        <PrLine label="1RM stimato" value={prs.best1RmKg !== null ? formatKg(prs.best1RmKg) : "—"} />
      </dl>

      <div className="flex flex-col gap-1.5 pt-1">
        <p className="em-eyebrow">Le ultime sedute</p>
        {loading ? null : <ProgressTable sets={sets ?? []} dateBySession={days} />}
      </div>
    </div>
  );
}

/**
 * Il verdetto AUMENTA/RESTA anche qui, se l'esercizio vive in uno slot
 * del programma attivo: giudica l'ultima seduta COMPLETATA del giorno.
 */
function ExerciseVerdict({
  exercise,
  sessions,
}: {
  exercise: GymExercise;
  sessions: GymSession[];
}) {
  const programSlots = useActiveProgramSlots();
  const sets = useSetsByExercise(exercise.id, 500);
  if (programSlots === undefined || sets === undefined) return null;

  for (const { day, slots } of programSlots) {
    const slot = slots.find((s) => s.exercise_id === exercise.id);
    if (!slot) continue;
    const lastCompleted = sessions
      .filter((s) => s.program_day_id === day.id && s.finished_at !== null)
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (b.started_at ?? b.created_at).localeCompare(
            a.started_at ?? a.created_at,
          ),
      )[0];
    if (!lastCompleted) continue;
    const lastSets = sets
      .filter((s) => s.session_id === lastCompleted.id)
      .sort((a, b) => a.set_number - b.set_number);
    const verdict = verdictForSlot(slot, lastSets);
    if (verdict === null) continue;
    return (
      <p className="em-body-sm flex items-center gap-2 text-[var(--em-text-3)]">
        <span
          className={
            verdict === "aumenta"
              ? "em-eyebrow rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-ember-text)]"
              : "em-eyebrow rounded-full bg-[var(--em-surface-2)] px-2 py-0.5 text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)]"
          }
        >
          {verdictLabel(verdict, slot.bodyweight)}
        </span>
        suggerimento dall&apos;ultima seduta di {day.name}
      </p>
    );
  }
  return null;
}

function PrLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="em-eyebrow">{label}</dt>
      <dd className="em-body em-num mt-0.5 font-medium text-[var(--em-text)]">
        {value}
      </dd>
    </div>
  );
}
