"use client";

/**
 * Area "Programmi" di /gym (run-07 prompt 2) — la casa dell'authoring:
 * lista programmi (attiva / duplica / rinomina / elimina + undo),
 * editor del programma = card-giorno riordinabili (drag dalla maniglia,
 * frecce come fallback tastiera), e da lì l'editor del giorno (la
 * tabella-foglio, day-editor.tsx). Navigazione a drill-down dentro il
 * tab: niente modali per superfici grandi.
 */

import { useState } from "react";
import { Button, EmptyState, Input, Skeleton, cx, useToast } from "@/ui";
import {
  appRepos,
  useProgramDays,
  useProgramSlots,
  usePrograms,
} from "@/data/hooks";
import { getDb, hasIndexedDb } from "@/data/db";
import { seedTorsoA } from "@/data/gym-programs";
import type { GymProgram, GymProgramDay } from "@/data/schemas";
import { DayEditor } from "./day-editor";
import { useRowDrag, moveIndex } from "./use-row-drag";

type View =
  | { kind: "list" }
  | { kind: "program"; programId: string }
  | { kind: "day"; programId: string; dayId: string };

export function ProgramsPanel() {
  const [view, setView] = useState<View>({ kind: "list" });

  if (view.kind === "program") {
    return (
      <ProgramEditor
        programId={view.programId}
        onBack={() => setView({ kind: "list" })}
        onOpenDay={(dayId) =>
          setView({ kind: "day", programId: view.programId, dayId })
        }
      />
    );
  }
  if (view.kind === "day") {
    return (
      <DayEditor
        dayId={view.dayId}
        onBack={() =>
          setView({ kind: "program", programId: view.programId })
        }
      />
    );
  }
  return (
    <ProgramsList
      onOpen={(programId) => setView({ kind: "program", programId })}
    />
  );
}

/* ── Lista programmi ─────────────────────────────────────────────────── */

function ProgramsList({ onOpen }: { onOpen: (programId: string) => void }) {
  const toast = useToast();
  const programs = usePrograms();

  async function importTorsoA() {
    if (!hasIndexedDb()) return;
    const inserted = await seedTorsoA(getDb());
    toast.show({
      message:
        inserted > 0
          ? "Importata: Torso A, la tua scheda d'esempio."
          : "Torso A è già qui — niente doppioni.",
      tone: inserted > 0 ? "success" : "neutral",
    });
  }

  async function createProgram() {
    const r = await appRepos().gym.createProgram({ name: "Nuova scheda" });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onOpen(r.data.id);
  }

  if (programs === undefined) return <Skeleton className="h-24 w-full" />;

  if (programs.length === 0) {
    return (
      <EmptyState
        heading="Nessun programma"
        text="Un programma è la tua scheda: giorni («Torso A») fatti di esercizi con serie, reps e RIR come sul foglio."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" variant="primary" size="sm" onClick={() => void createProgram()}>
              Nuovo programma
            </Button>
            <Button type="button" size="sm" onClick={() => void importTorsoA()}>
              Importa esempio: Torso A (la tua scheda)
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col">
        {programs.map((p) => (
          <ProgramRow key={p.id} program={p} onOpen={() => onOpen(p.id)} />
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => void createProgram()}>
          + Nuovo programma
        </Button>
        <Button type="button" variant="ghost" onClick={() => void importTorsoA()}>
          Importa esempio: Torso A
        </Button>
      </div>
    </div>
  );
}

function ProgramRow({
  program,
  onOpen,
}: {
  program: GymProgram;
  onOpen: () => void;
}) {
  const toast = useToast();
  const days = useProgramDays(program.id);

  async function activate() {
    const r = await appRepos().gym.updateProgram(program.id, {
      is_active: true,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  return (
    <li className="flex min-h-11 items-center gap-3 border-b border-[var(--em-hairline)] py-2.5 last:border-b-0">
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="em-body flex items-center gap-2 text-[var(--em-text)]">
          <span className="truncate">{program.name}</span>
          {program.is_active ? (
            <span className="em-eyebrow shrink-0 rounded-full bg-[var(--em-ember-tint)] px-2 py-0.5 text-[var(--em-ember-text)]">
              attiva
            </span>
          ) : null}
        </span>
        <span className="em-body-sm text-[var(--em-text-3)]">
          {days === undefined
            ? "…"
            : `${days.length} ${days.length === 1 ? "giorno" : "giorni"}`}
        </span>
      </button>
      {!program.is_active ? (
        <Button type="button" size="sm" onClick={() => void activate()}>
          Attiva
        </Button>
      ) : null}
    </li>
  );
}

/* ── Editor del programma: card-giorno riordinabili ──────────────────── */

function ProgramEditor({
  programId,
  onBack,
  onOpenDay,
}: {
  programId: string;
  onBack: () => void;
  onOpenDay: (dayId: string) => void;
}) {
  const toast = useToast();
  const programs = usePrograms();
  const program = programs?.find((p) => p.id === programId) ?? null;
  const days = useProgramDays(programId);
  const list = days ?? [];

  const { drag, startDrag, rowTransform, setRowRef } = useRowDrag(
    list.length,
    (from, to) => {
      void appRepos().gym.reorderProgramDays(
        programId,
        moveIndex(
          list.map((d) => d.id),
          from,
          to,
        ),
      );
    },
  );

  async function moveDay(index: number, delta: -1 | 1) {
    await appRepos().gym.reorderProgramDays(
      programId,
      moveIndex(
        list.map((d) => d.id),
        index,
        index + delta,
      ),
    );
  }

  async function rename(name: string) {
    if (!program) return;
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === program.name) return;
    const r = await appRepos().gym.updateProgram(program.id, { name: trimmed });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function activate() {
    if (!program) return;
    const r = await appRepos().gym.updateProgram(program.id, {
      is_active: true,
    });
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function duplicate() {
    if (!program) return;
    const r = await appRepos().gym.duplicateProgram(program.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({ message: `Duplicata: ${r.data.name}`, tone: "success" });
    onBack();
  }

  async function remove() {
    if (!program) return;
    const doomed = program;
    const r = await appRepos().gym.softDeleteProgram(doomed.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onBack();
    toast.show({
      message: `Eliminata: ${doomed.name}`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().gym.restoreProgram(doomed.id),
      },
    });
  }

  async function addDay() {
    const r = await appRepos().gym.createProgramDay({
      program_id: programId,
      name: `Giorno ${list.length + 1}`,
    });
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    onOpenDay(r.data.id);
  }

  async function duplicateDay(day: GymProgramDay) {
    const r = await appRepos().gym.duplicateProgramDay(day.id);
    if (!r.ok) toast.show({ message: r.error.message, tone: "error" });
  }

  async function removeDay(day: GymProgramDay) {
    const r = await appRepos().gym.softDeleteProgramDay(day.id);
    if (!r.ok) {
      toast.show({ message: r.error.message, tone: "error" });
      return;
    }
    toast.show({
      message: `Eliminato: ${day.name}`,
      action: {
        label: "Annulla",
        onClick: () => void appRepos().gym.restoreProgramDay(day.id),
      },
    });
  }

  if (programs === undefined || days === undefined) {
    return <Skeleton className="h-24 w-full" />;
  }
  if (!program) {
    return (
      <div className="flex flex-col items-start gap-3">
        <BackButton label="Programmi" onClick={onBack} />
        <p className="em-body-sm text-[var(--em-text-3)]">
          Questo programma non c&apos;è più.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <BackButton label="Programmi" onClick={onBack} />
        <div className="flex items-center gap-1.5">
          {program.is_active ? (
            <span className="em-eyebrow rounded-full bg-[var(--em-ember-tint)] px-2.5 py-1 text-[var(--em-ember-text)]">
              attiva
            </span>
          ) : (
            <Button type="button" size="sm" onClick={() => void activate()}>
              Attiva
            </Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={() => void duplicate()}>
            Duplica
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void remove()}>
            Elimina
          </Button>
        </div>
      </div>

      <Input
        key={`${program.id}:${program.name}`}
        defaultValue={program.name}
        aria-label="Nome del programma"
        maxLength={120}
        onBlur={(e) => void rename(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="em-title font-semibold"
      />

      {list.length === 0 ? (
        <EmptyState
          compact
          heading="Nessun giorno"
          text="Un giorno è una pagina della scheda: «Torso A», «Gambe»…"
          action={
            <Button type="button" size="sm" variant="primary" onClick={() => void addDay()}>
              Nuovo giorno
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {list.map((day, i) => (
              <li
                key={day.id}
                ref={setRowRef(i)}
                style={{ transform: rowTransform(i) }}
                className={cx(
                  drag && i === drag.from
                    ? "relative z-10 shadow-[var(--em-e2)]"
                    : "transition-transform duration-[var(--em-dur-control)]",
                  drag && "select-none",
                )}
              >
                <DayCard
                  day={day}
                  onOpen={() => onOpenDay(day.id)}
                  onDuplicate={() => void duplicateDay(day)}
                  onRemove={() => void removeDay(day)}
                  onMoveUp={i > 0 ? () => void moveDay(i, -1) : undefined}
                  onMoveDown={
                    i < list.length - 1 ? () => void moveDay(i, 1) : undefined
                  }
                  onDragStart={
                    list.length > 1 ? (e) => startDrag(i, e) : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" onClick={() => void addDay()}>
            + Nuovo giorno
          </Button>
        </>
      )}
    </div>
  );
}

function DayCard({
  day,
  onOpen,
  onDuplicate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
}: {
  day: GymProgramDay;
  onOpen: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDragStart?: (e: React.PointerEvent<HTMLElement>) => void;
}) {
  const slots = useProgramSlots(day.id);
  return (
    <div className="flex items-center gap-2 rounded-[var(--em-r-md)] bg-[var(--em-surface-2)] p-2 shadow-[0_0_0_1px_var(--em-hairline)]">
      {onDragStart ? (
        <button
          type="button"
          aria-label={`Trascina ${day.name} per riordinare`}
          onPointerDown={onDragStart}
          className="grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)]"
        >
          <GripIcon />
        </button>
      ) : (
        <span className="w-2" aria-hidden="true" />
      )}
      <button type="button" onClick={onOpen} className="min-h-11 min-w-0 flex-1 text-left">
        <span className="em-body block truncate font-medium text-[var(--em-text)]">
          {day.name}
        </span>
        <span className="em-body-sm block truncate text-[var(--em-text-3)]">
          {day.subtitle ? `${day.subtitle} · ` : ""}
          {slots === undefined
            ? "…"
            : `${slots.length} ${slots.length === 1 ? "esercizio" : "esercizi"}`}
        </span>
      </button>
      <div className="flex shrink-0 flex-col">
        <ArrowButton label={`Sposta su ${day.name}`} disabled={!onMoveUp} onClick={onMoveUp}>
          <path d="M6 14l6-6 6 6" />
        </ArrowButton>
        <ArrowButton label={`Sposta giù ${day.name}`} disabled={!onMoveDown} onClick={onMoveDown}>
          <path d="M6 10l6 6 6-6" />
        </ArrowButton>
      </div>
      <IconButton label={`Duplica ${day.name}`} onClick={onDuplicate}>
        <path d="M8 8h10v12H8z" />
        <path d="M6 16H4V4h12v2" />
      </IconButton>
      <IconButton label={`Elimina ${day.name}`} onClick={onRemove}>
        <path d="M6 6l12 12M18 6L6 18" />
      </IconButton>
    </div>
  );
}

/* ── Piccoli condivisi del builder ───────────────────────────────────── */

export function BackButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="em-body-sm flex min-h-11 items-center gap-1 rounded-[var(--em-r-sm)] pr-2 font-medium text-[var(--em-text-2)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {label}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-9 shrink-0 place-items-center rounded-[var(--em-r-sm)] text-[var(--em-text-3)] transition-colors duration-[var(--em-dur-tap)] hover:text-[var(--em-text)]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
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
  onClick?: () => void;
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

export function GripIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}
