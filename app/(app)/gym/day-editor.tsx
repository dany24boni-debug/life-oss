"use client";

/**
 * Editor del giorno (run-07 prompt 2) — LA TABELLA, veloce come il
 * foglio: righe = slot raggruppati sotto le intestazioni di sezione
 * (chips FORZA / IPERTROFIA / CORE + custom dalla scheda riga), colonne
 * Esercizio (autocomplete + creazione inline) · Variante · Serie
 * (stepper) · Reps (testo "3–5") · RIR (testo "1–2 o 2/1/0") · Rec
 * (input "4'30"; chips nella scheda) · corpo libero, drag per
 * riordinare, duplica riga, elimina con undo.
 *
 * Desktop: Invio conferma e scende alla stessa colonna della riga sotto
 * (flusso-foglio). Mobile: la riga si apre in una scheda compatta
 * (BottomSheet) con target 44px e chips per i recuperi.
 */

import { useRef, useState } from "react";
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
import {
  appRepos,
  useExercises,
  useProgramDay,
  useProgramSlots,
  usePrograms,
} from "@/data/hooks";
import type { GymProgramSlot } from "@/data/schemas";
import { useIsDesktop } from "../_components/tasks/screen-hooks";
import { ExercisePicker } from "./exercise-picker";
import {
  REST_CHOICES,
  SECTION_SUGGESTIONS,
  formatRestShort,
  normalizePrescriptionInput,
  parseRestInput,
  sectionGroups,
  slotSummary,
} from "./program-parse";
import { BackButton, GripIcon, IconButton } from "./programs-panel";
import { useRowDrag, moveIndex } from "./use-row-drag";

const WEEKDAYS = [
  { value: 1, short: "L", full: "lunedì" },
  { value: 2, short: "M", full: "martedì" },
  { value: 3, short: "M", full: "mercoledì" },
  { value: 4, short: "G", full: "giovedì" },
  { value: 5, short: "V", full: "venerdì" },
  { value: 6, short: "S", full: "sabato" },
  { value: 7, short: "D", full: "domenica" },
] as const;

/** Colonne della tabella desktop (grip · esercizio · … · azioni). */
const GRID_COLS =
  "32px minmax(150px,1.7fr) minmax(84px,1fr) 100px 84px 100px 76px 64px 132px";

type PendingAdd = { section: string | null; afterSortOrder: number | null };

export function DayEditor({
  dayId,
  onBack,
}: {
  dayId: string;
  onBack: () => void;
}) {
  const toast = useToast();
  const isDesktop = useIsDesktop();
  const day = useProgramDay(dayId);
  const slots = useProgramSlots(dayId);
  const programs = usePrograms();
  const exercises = useExercises();
  const tableRef = useRef<HTMLDivElement | null>(null);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [openSlot, setOpenSlot] = useState<GymProgramSlot | null>(null);
  const [replacingSlot, setReplacingSlot] = useState<GymProgramSlot | null>(
    null,
  );

  const list = slots ?? [];
  const nameOf = (id: string) =>
    exercises?.find((e) => e.id === id)?.name ?? "Esercizio rimosso";
  const programName =
    programs?.find((p) => p.id === day?.program_id)?.name ?? "Programma";

  const { drag, startDrag, rowTransform, setRowRef } = useRowDrag(
    list.length,
    (from, to) => {
      void appRepos().gym.reorderProgramSlots(
        dayId,
        moveIndex(
          list.map((s) => s.id),
          from,
          to,
        ),
      );
    },
  );

  async function patchSlot(
    slot: GymProgramSlot,
    patch: Parameters<ReturnType<typeof appRepos>["gym"]["updateProgramSlot"]>[1],
  ) {
    const r = await appRepos().gym.updateProgramSlot(slot.id, patch);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function duplicateSlot(slot: GymProgramSlot) {
    const r = await appRepos().gym.duplicateProgramSlot(slot.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function removeSlot(slot: GymProgramSlot) {
    const r = await appRepos().gym.softDeleteProgramSlot(slot.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    setOpenSlot((cur) => (cur?.id === slot.id ? null : cur));
    toast.show({
      message: `Tolto: ${nameOf(slot.exercise_id)}`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().gym.restoreProgramSlot(slot.id),
      },
    });
  }

  async function addSlot(exerciseId: string) {
    if (!pendingAdd) return;
    const r = await appRepos().gym.createProgramSlot({
      day_id: dayId,
      exercise_id: exerciseId,
      section: pendingAdd.section,
      ...(pendingAdd.afterSortOrder !== null && {
        sort_order: pendingAdd.afterSortOrder + 0.5,
      }),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
    setPendingAdd(null);
  }

  async function replaceExercise(slot: GymProgramSlot, exerciseId: string) {
    await patchSlot(slot, { exercise_id: exerciseId });
    setReplacingSlot(null);
  }

  /** Invio su una cella: conferma e scende alla stessa colonna sotto. */
  function onCellKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const target = e.currentTarget;
    const cell = target.dataset.cell;
    const row = Number(target.dataset.row);
    target.blur();
    const next = tableRef.current?.querySelector<HTMLInputElement>(
      `[data-cell="${cell}"][data-row="${row + 1}"]`,
    );
    next?.focus();
  }

  async function patchDay(patch: { name?: string; subtitle?: string | null }) {
    if (!day) return;
    const name = patch.name?.trim();
    const r = await appRepos().gym.updateProgramDay(day.id, {
      ...(name !== undefined && name !== "" && { name }),
      ...(patch.subtitle !== undefined && { subtitle: patch.subtitle }),
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  if (day === undefined || slots === undefined || exercises === undefined) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (day === null) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BackButton label={programName} onClick={onBack} />
        <p className="em-body-sm text-[var(--em-text-3)]">
          Questo giorno non c&apos;è più.
        </p>
      </div>
    );
  }

  const groups = sectionGroups(list);
  // Indice GLOBALE di riga (attraverso le sezioni): guida drag e
  // navigazione con Invio.
  const rowIndexOf = new Map(list.map((s, i) => [s.id, i]));

  return (
    <div className="flex flex-col gap-4">
      <BackButton label={programName} onClick={onBack} />

      <div className="flex flex-col gap-2">
        <Input
          key={`name:${day.id}:${day.name}`}
          defaultValue={day.name}
          aria-label="Nome del giorno"
          maxLength={120}
          onBlur={(e) => void patchDay({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="em-title font-semibold"
        />
        <Input
          key={`sub:${day.id}:${day.subtitle ?? ""}`}
          defaultValue={day.subtitle ?? ""}
          aria-label="Sottotitolo del giorno"
          placeholder="Petto + Schiena + Spalle + Core"
          maxLength={200}
          onBlur={(e) =>
            void patchDay({
              subtitle: e.target.value.trim() === "" ? null : e.target.value.trim(),
            })
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <WeekdayChips
          value={day.weekday}
          onChange={(weekday) =>
            void appRepos().gym.updateProgramDay(day.id, { weekday })
          }
        />
      </div>

      {list.length === 0 ? (
        <EmptyState
          compact
          heading="Nessun esercizio"
          text="Aggiungi la prima riga: una sezione è solo un'etichetta, come sul foglio."
        />
      ) : isDesktop ? (
        <div ref={tableRef} className="overflow-x-auto pb-1">
          <div className="min-w-[880px]">
            <div
              className="em-eyebrow grid items-center gap-x-2 px-1 pb-1 text-[var(--em-text-3)]"
              style={{ gridTemplateColumns: GRID_COLS }}
              aria-hidden="true"
            >
              <span />
              <span>Esercizio</span>
              <span>Variante</span>
              <span className="text-center">Serie</span>
              <span>Reps</span>
              <span>RIR</span>
              <span>Rec</span>
              <span className="text-center">Corpo</span>
              <span />
            </div>
            <div className="flex flex-col gap-1">
              {groups.map((group, gi) => (
                <div key={`g:${gi}`} className="flex flex-col gap-1">
                  <SectionHeader
                    section={group.section}
                    onAdd={() =>
                      setPendingAdd({
                        section: group.section,
                        afterSortOrder:
                          group.slots[group.slots.length - 1]?.sort_order ??
                          null,
                      })
                    }
                  />
                  {group.slots.map((slot) => {
                    const i = rowIndexOf.get(slot.id) ?? 0;
                    return (
                      <div
                        key={slot.id}
                        ref={setRowRef(i)}
                        style={{
                          transform: rowTransform(i),
                          gridTemplateColumns: GRID_COLS,
                        }}
                        className={cx(
                          "grid items-center gap-x-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-1 shadow-[0_0_0_1px_var(--em-hairline)]",
                          drag && i === drag.from
                            ? "relative z-10 shadow-[var(--em-e2)]"
                            : "transition-transform duration-[var(--em-dur-control)]",
                          drag && "select-none",
                        )}
                      >
                        <button
                          type="button"
                          aria-label={`Trascina ${nameOf(slot.exercise_id)} per riordinare`}
                          onPointerDown={
                            list.length > 1 ? (e) => startDrag(i, e) : undefined
                          }
                          className="grid h-10 w-7 cursor-grab touch-none place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)]"
                        >
                          <GripIcon />
                        </button>
                        <button
                          type="button"
                          onClick={() => setReplacingSlot(slot)}
                          className="em-body h-10 min-w-0 truncate rounded-[var(--em-r-sm)] px-2 text-left text-[var(--em-text)] transition-colors duration-[var(--em-dur-tap)] hover:bg-[color-mix(in_srgb,var(--em-text)_6%,transparent)]"
                        >
                          {nameOf(slot.exercise_id)}
                        </button>
                        <CellInput
                          cell="variante"
                          row={i}
                          slotKey={`${slot.id}:${slot.variant ?? ""}`}
                          defaultValue={slot.variant ?? ""}
                          placeholder="—"
                          ariaLabel={`Variante di ${nameOf(slot.exercise_id)}`}
                          maxLength={80}
                          onKeyDown={onCellKeyDown}
                          onCommit={(raw) => {
                            const v = raw.trim();
                            void patchSlot(slot, {
                              variant: v === "" ? null : v.slice(0, 80),
                            });
                          }}
                        />
                        <SetsStepper
                          value={slot.target_sets}
                          compact
                          exerciseName={nameOf(slot.exercise_id)}
                          onChange={(target_sets) =>
                            void patchSlot(slot, { target_sets })
                          }
                        />
                        <CellInput
                          cell="reps"
                          row={i}
                          slotKey={`${slot.id}:${slot.target_reps ?? ""}`}
                          defaultValue={slot.target_reps ?? ""}
                          placeholder="3–5"
                          ariaLabel={`Reps obiettivo di ${nameOf(slot.exercise_id)}`}
                          maxLength={20}
                          onKeyDown={onCellKeyDown}
                          onCommit={(raw) =>
                            void patchSlot(slot, {
                              target_reps: normalizePrescriptionInput(raw),
                            })
                          }
                        />
                        <CellInput
                          cell="rir"
                          row={i}
                          slotKey={`${slot.id}:${slot.target_rir ?? ""}`}
                          defaultValue={slot.target_rir ?? ""}
                          placeholder="1–2 o 2/1/0"
                          ariaLabel={`RIR obiettivo di ${nameOf(slot.exercise_id)}`}
                          maxLength={20}
                          onKeyDown={onCellKeyDown}
                          onCommit={(raw) =>
                            void patchSlot(slot, {
                              target_rir: normalizePrescriptionInput(raw),
                            })
                          }
                        />
                        <CellInput
                          cell="rec"
                          row={i}
                          slotKey={`${slot.id}:${slot.rest_seconds ?? ""}`}
                          defaultValue={formatRestShort(slot.rest_seconds)
                            .replace("—", "")}
                          placeholder="4'30"
                          ariaLabel={`Recupero di ${nameOf(slot.exercise_id)}`}
                          maxLength={6}
                          onKeyDown={onCellKeyDown}
                          onCommit={(raw, input) => {
                            if (raw.trim() === "") {
                              void patchSlot(slot, { rest_seconds: null });
                              return;
                            }
                            const parsed = parseRestInput(raw);
                            if (parsed === null) {
                              input.value = formatRestShort(
                                slot.rest_seconds,
                              ).replace("—", "");
                              return;
                            }
                            void patchSlot(slot, { rest_seconds: parsed });
                          }}
                        />
                        <div className="flex justify-center">
                          <BodyweightChip
                            active={slot.bodyweight}
                            exerciseName={nameOf(slot.exercise_id)}
                            onToggle={() =>
                              void patchSlot(slot, {
                                bodyweight: !slot.bodyweight,
                              })
                            }
                          />
                        </div>
                        <div className="flex items-center justify-end">
                          <IconButton
                            label={`Duplica ${nameOf(slot.exercise_id)}`}
                            onClick={() => void duplicateSlot(slot)}
                          >
                            <path d="M8 8h10v12H8z" />
                            <path d="M6 16H4V4h12v2" />
                          </IconButton>
                          <IconButton
                            label={`Altro su ${nameOf(slot.exercise_id)}`}
                            onClick={() => setOpenSlot(slot)}
                          >
                            <circle cx="5" cy="12" r="1.6" />
                            <circle cx="12" cy="12" r="1.6" />
                            <circle cx="19" cy="12" r="1.6" />
                          </IconButton>
                          <IconButton
                            label={`Elimina ${nameOf(slot.exercise_id)}`}
                            onClick={() => void removeSlot(slot)}
                          >
                            <path d="M6 6l12 12M18 6L6 18" />
                          </IconButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {groups.map((group, gi) => (
            <div key={`g:${gi}`} className="flex flex-col gap-1.5">
              <SectionHeader
                section={group.section}
                onAdd={() =>
                  setPendingAdd({
                    section: group.section,
                    afterSortOrder:
                      group.slots[group.slots.length - 1]?.sort_order ?? null,
                  })
                }
              />
              {group.slots.map((slot) => {
                const i = rowIndexOf.get(slot.id) ?? 0;
                return (
                  <div
                    key={slot.id}
                    ref={setRowRef(i)}
                    style={{ transform: rowTransform(i) }}
                    className={cx(
                      "flex items-center gap-1 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-1.5 shadow-[0_0_0_1px_var(--em-hairline)]",
                      drag && i === drag.from
                        ? "relative z-10 shadow-[var(--em-e2)]"
                        : "transition-transform duration-[var(--em-dur-control)]",
                      drag && "select-none",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Trascina ${nameOf(slot.exercise_id)} per riordinare`}
                      onPointerDown={
                        list.length > 1 ? (e) => startDrag(i, e) : undefined
                      }
                      className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)]"
                    >
                      <GripIcon />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenSlot(slot)}
                      className="min-h-11 min-w-0 flex-1 py-1 text-left"
                    >
                      <span className="em-body block truncate text-[var(--em-text)]">
                        {nameOf(slot.exercise_id)}
                        {slot.variant ? (
                          <span className="text-[var(--em-text-3)]">
                            {" "}
                            · {slot.variant}
                          </span>
                        ) : null}
                      </span>
                      <span className="em-body-sm em-num block truncate text-[var(--em-text-3)]">
                        {slotSummary(slot)}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setPendingAdd({
              section: list[list.length - 1]?.section ?? null,
              afterSortOrder: null,
            })
          }
        >
          + Esercizio
        </Button>
        {SECTION_SUGGESTIONS.filter(
          (s) => !list.some((slot) => slot.section === s),
        ).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPendingAdd({ section: s, afterSortOrder: null })}
            className="em-body-sm h-11 rounded-full bg-[var(--em-surface-2)] px-3 font-medium text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
          >
            + {s}
          </button>
        ))}
      </div>

      <ExercisePicker
        open={pendingAdd !== null || replacingSlot !== null}
        allowCreate
        onClose={() => {
          setPendingAdd(null);
          setReplacingSlot(null);
        }}
        onPick={(e) => {
          if (replacingSlot) {
            void replaceExercise(replacingSlot, e.id);
          } else {
            void addSlot(e.id);
          }
        }}
      />

      <SlotSheet
        slot={openSlot ? (list.find((s) => s.id === openSlot.id) ?? null) : null}
        exerciseName={openSlot ? nameOf(openSlot.exercise_id) : ""}
        onClose={() => setOpenSlot(null)}
        onPatch={(slot, patch) => void patchSlot(slot, patch)}
        onReplaceExercise={(slot) => {
          setOpenSlot(null);
          setReplacingSlot(slot);
        }}
        onDuplicate={(slot) => {
          setOpenSlot(null);
          void duplicateSlot(slot);
        }}
        onRemove={(slot) => void removeSlot(slot)}
      />
    </div>
  );
}

/* ── Pezzi della tabella ─────────────────────────────────────────────── */

function SectionHeader({
  section,
  onAdd,
}: {
  section: string | null;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pt-2">
      <p className="em-eyebrow text-[var(--em-ember-text)]">
        {section ?? "Senza sezione"}
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="em-body-sm flex h-8 items-center rounded-full px-2.5 font-medium text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
      >
        + aggiungi qui
      </button>
    </div>
  );
}

/**
 * Cella testuale non controllata: commit su blur, key legata al valore
 * salvato (la normalizzazione riappare al remount senza rubare il focus).
 */
function CellInput({
  cell,
  row,
  slotKey,
  defaultValue,
  placeholder,
  ariaLabel,
  maxLength,
  onCommit,
  onKeyDown,
}: {
  cell: string;
  row: number;
  slotKey: string;
  defaultValue: string;
  placeholder: string;
  ariaLabel: string;
  maxLength: number;
  onCommit: (raw: string, input: HTMLInputElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <Input
      key={`${cell}:${slotKey}`}
      defaultValue={defaultValue}
      placeholder={placeholder}
      aria-label={ariaLabel}
      maxLength={maxLength}
      data-cell={cell}
      data-row={row}
      autoComplete="off"
      onBlur={(e) => onCommit(e.target.value, e.target)}
      onKeyDown={onKeyDown}
      className="h-10 px-2 text-[length:var(--em-fs-body-sm)]"
    />
  );
}

export function SetsStepper({
  value,
  onChange,
  exerciseName,
  compact = false,
}: {
  value: number;
  onChange: (next: number) => void;
  exerciseName: string;
  compact?: boolean;
}) {
  const btn = compact ? "h-10 w-8" : "h-11 w-11";
  return (
    <div className="flex items-center justify-center gap-0.5">
      <button
        type="button"
        aria-label={`Meno serie per ${exerciseName}`}
        disabled={value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className={cx(
          btn,
          "grid shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface)] text-base font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] disabled:opacity-30",
        )}
      >
        −
      </button>
      <span className="em-body em-num w-6 text-center font-medium text-[var(--em-text)]">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Più serie per ${exerciseName}`}
        disabled={value >= 10}
        onClick={() => onChange(Math.min(10, value + 1))}
        className={cx(
          btn,
          "grid shrink-0 place-items-center rounded-[var(--em-r-sm)] bg-[var(--em-surface)] text-base font-semibold text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] active:bg-[var(--em-ember-tint)] disabled:opacity-30",
        )}
      >
        +
      </button>
    </div>
  );
}

function BodyweightChip({
  active,
  onToggle,
  exerciseName,
}: {
  active: boolean;
  onToggle: () => void;
  exerciseName: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={`Corpo libero per ${exerciseName}`}
      onClick={onToggle}
      className={cx(
        "em-body-sm h-10 rounded-full px-2.5 font-medium transition-colors duration-[var(--em-dur-tap)]",
        active
          ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          : "bg-[var(--em-surface)] text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
      )}
    >
      corpo
    </button>
  );
}

function WeekdayChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-1"
      aria-label="Giorno della settimana (facoltativo)"
    >
      {WEEKDAYS.map((d) => (
        <button
          key={d.value}
          type="button"
          aria-pressed={value === d.value}
          aria-label={d.full}
          onClick={() => onChange(value === d.value ? null : d.value)}
          className={cx(
            "em-body-sm grid h-8 w-8 place-items-center rounded-full font-medium transition-colors duration-[var(--em-dur-tap)]",
            value === d.value
              ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
              : "bg-[var(--em-surface-2)] text-[var(--em-text-3)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
          )}
        >
          {d.short}
        </button>
      ))}
    </div>
  );
}

/* ── La scheda riga (mobile sempre; desktop per sezione/note) ────────── */

function SlotSheet({
  slot,
  exerciseName,
  onClose,
  onPatch,
  onReplaceExercise,
  onDuplicate,
  onRemove,
}: {
  slot: GymProgramSlot | null;
  exerciseName: string;
  onClose: () => void;
  onPatch: (
    slot: GymProgramSlot,
    patch: {
      variant?: string | null;
      section?: string | null;
      target_sets?: number;
      target_reps?: string | null;
      target_rir?: string | null;
      rest_seconds?: number | null;
      bodyweight?: boolean;
      notes?: string | null;
    },
  ) => void;
  onReplaceExercise: (slot: GymProgramSlot) => void;
  onDuplicate: (slot: GymProgramSlot) => void;
  onRemove: (slot: GymProgramSlot) => void;
}) {
  const isDesktop = useIsDesktop();
  const open = slot !== null;

  const body =
    slot === null ? null : (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => onReplaceExercise(slot)}
          className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--em-r-md)] bg-[var(--em-surface)] px-3 text-left shadow-[0_0_0_1px_var(--em-hairline)] transition-colors duration-[var(--em-dur-tap)] hover:shadow-[0_0_0_1px_var(--em-hairline-strong)]"
        >
          <span className="em-body min-w-0 truncate font-medium text-[var(--em-text)]">
            {exerciseName}
          </span>
          <span className="em-eyebrow shrink-0 text-[var(--em-text-3)]">
            cambia
          </span>
        </button>

        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Variante</span>
          <Input
            key={`v:${slot.id}:${slot.variant ?? ""}`}
            defaultValue={slot.variant ?? ""}
            placeholder="Bilanciere, Macchina…"
            maxLength={80}
            onBlur={(e) => {
              const v = e.target.value.trim();
              onPatch(slot, { variant: v === "" ? null : v.slice(0, 80) });
            }}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Sezione</span>
          <SectionChips
            value={slot.section}
            onChange={(section) => onPatch(slot, { section })}
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="em-eyebrow">Serie</span>
          <SetsStepper
            value={slot.target_sets}
            exerciseName={exerciseName}
            onChange={(target_sets) => onPatch(slot, { target_sets })}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="em-eyebrow">Reps</span>
            <Input
              key={`r:${slot.id}:${slot.target_reps ?? ""}`}
              defaultValue={slot.target_reps ?? ""}
              placeholder="3–5"
              maxLength={20}
              inputMode="numeric"
              autoComplete="off"
              onBlur={(e) =>
                onPatch(slot, {
                  target_reps: normalizePrescriptionInput(e.target.value),
                })
              }
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="em-eyebrow">RIR</span>
            <Input
              key={`rir:${slot.id}:${slot.target_rir ?? ""}`}
              defaultValue={slot.target_rir ?? ""}
              placeholder="1–2 o 2/1/0"
              maxLength={20}
              autoComplete="off"
              onBlur={(e) =>
                onPatch(slot, {
                  target_rir: normalizePrescriptionInput(e.target.value),
                })
              }
            />
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Recupero</span>
          <RestChips
            value={slot.rest_seconds}
            onChange={(rest_seconds) => onPatch(slot, { rest_seconds })}
          />
        </div>

        <Switch
          label="Corpo libero"
          description="Niente colonna carico nella griglia (la zavorra resta possibile)."
          checked={slot.bodyweight}
          onChange={(bodyweight) => onPatch(slot, { bodyweight })}
        />

        <label className="flex flex-col gap-1.5">
          <span className="em-eyebrow">Note</span>
          <Input
            key={`n:${slot.id}:${slot.notes ?? ""}`}
            defaultValue={slot.notes ?? ""}
            placeholder="Fermo al petto, presa larga…"
            maxLength={280}
            onBlur={(e) => {
              const v = e.target.value.trim();
              onPatch(slot, { notes: v === "" ? null : v });
            }}
          />
        </label>

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={() => onDuplicate(slot)}>
            Duplica riga
          </Button>
          <Button type="button" variant="ghost" onClick={() => onRemove(slot)}>
            Elimina riga
          </Button>
        </div>
      </div>
    );

  if (isDesktop) {
    return (
      <Modal open={open} onClose={onClose} title="Riga della scheda">
        {body}
      </Modal>
    );
  }
  return (
    <BottomSheet open={open} onClose={onClose} title="Riga della scheda">
      {body ?? <span />}
    </BottomSheet>
  );
}

function SectionChips({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (next: string | null) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const isSuggested =
    value === null ||
    (SECTION_SUGGESTIONS as readonly string[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SECTION_SUGGESTIONS.map((s) => (
        <SectionChip
          key={s}
          label={s}
          active={value === s}
          onClick={() => onChange(value === s ? null : s)}
        />
      ))}
      {!isSuggested && value !== null ? (
        <SectionChip label={value} active onClick={() => onChange(null)} />
      ) : null}
      {customOpen ? (
        <Input
          autoFocus
          placeholder="Altra sezione…"
          maxLength={40}
          className="h-11 w-40"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setCustomOpen(false);
          }}
          onBlur={(e) => {
            const v = e.target.value.trim().toUpperCase();
            if (v !== "") onChange(v.slice(0, 40));
            setCustomOpen(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="em-body-sm h-11 rounded-full px-3 font-medium text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          altra…
        </button>
      )}
    </div>
  );
}

function SectionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cx(
        "em-body-sm h-11 rounded-full px-3.5 font-medium transition-colors duration-[var(--em-dur-tap)]",
        active
          ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
          : "bg-[var(--em-surface)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
      )}
    >
      {label}
    </button>
  );
}

export function RestChips({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const isChoice = value === null || (REST_CHOICES as readonly number[]).includes(value);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REST_CHOICES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(value === s ? null : s)}
          className={cx(
            "em-body-sm em-num h-11 rounded-full px-3 font-medium transition-colors duration-[var(--em-dur-tap)]",
            value === s
              ? "bg-[var(--em-ember-tint)] text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
              : "bg-[var(--em-surface)] text-[var(--em-text-2)] shadow-[0_0_0_1px_var(--em-hairline)] hover:text-[var(--em-text)]",
          )}
        >
          {formatRestShort(s)}
        </button>
      ))}
      {!isChoice && value !== null ? (
        <button
          type="button"
          aria-pressed
          onClick={() => onChange(null)}
          className="em-body-sm em-num h-11 rounded-full bg-[var(--em-ember-tint)] px-3 font-medium text-[var(--em-text)] shadow-[0_0_0_1px_var(--em-hairline-strong)]"
        >
          {formatRestShort(value)}
        </button>
      ) : null}
      {customOpen ? (
        <Input
          autoFocus
          placeholder="1'30"
          maxLength={6}
          inputMode="numeric"
          className="h-11 w-24"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setCustomOpen(false);
          }}
          onBlur={(e) => {
            const parsed = parseRestInput(e.target.value);
            if (parsed !== null) onChange(parsed);
            setCustomOpen(false);
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCustomOpen(true)}
          className="em-body-sm h-11 rounded-full px-3 font-medium text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
        >
          altro…
        </button>
      )}
    </div>
  );
}
